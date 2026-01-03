import logging
import time
from typing import List, Callable, Any, Optional, Dict
from sqlalchemy.future import select
from datetime import datetime, timezone, timedelta
from app.models.alert import Alert
from app.models.alert_trigger import AlertTrigger
from app.core.enums import AlertCondition, AlertTriggerMode

logger = logging.getLogger(__name__)

# Performance budget for alert evaluation (500ms per Constitution)
ALERT_EVALUATION_BUDGET_MS = 500
# Threshold for enabling batch evaluation
BATCH_EVALUATION_THRESHOLD = 1000
# T110a: Minimum cooldown to prevent rapid signal oscillations (in seconds)
# Note: Frontend sends cooldown in minutes, backend converts to seconds for internal use
MINIMUM_COOLDOWN_SECONDS = 60  # 1 minute minimum


class AlertEngine:
    def __init__(self, db_session_factory: Callable[[], Any]):
        self.db_session_factory = db_session_factory
        # Track last triggered time for each alert to respect cooldown
        self._last_triggered: dict[int, datetime] = {}

    async def evaluate_symbol_alerts(
        self,
        symbol_id: int,
        current_price: float,
        previous_price: Optional[float] = None,
        indicator_data: Optional[dict] = None,
        indicator_data_map: Optional[Dict[int, dict]] = None,
        bar_timestamp: Optional[datetime] = None
    ) -> List[Alert]:
        """
        Evaluate alerts for a symbol based on price changes.

        T106a: Implement alert evaluation timing measurement (enforce 500ms budget)
        T106b: Implement batch evaluation for high alert volumes (>1000)

        Clarified semantics:
        - above: Triggers when current > threshold AND previous <= threshold
        - below: Triggers when current < threshold AND previous >= threshold
        - crosses_up: Triggers when previous < threshold AND current >= threshold
        - crosses_down: Triggers when previous > threshold AND current <= threshold

        Trigger modes:
        - once: Alert fires once and is automatically disabled
        - once_per_bar: Alert fires at most once per bar update
        - once_per_bar_close: Alert fires at most once per bar close (respects bar timestamps)

        Args:
            symbol_id: The symbol ID to evaluate alerts for
            current_price: The current price
            previous_price: The previous price (required for above/below/crosses conditions)
            indicator_data: Optional indicator data for indicator-based alerts (legacy, per-symbol)
            indicator_data_map: Optional per-alert indicator data dict {alert_id: indicator_data} (new, custom indicators)
            bar_timestamp: The timestamp of the current bar (for bar-based trigger modes)

        Returns:
            List of triggered Alert objects
        """
        # T106a: Start timing measurement
        start_time = time.perf_counter()
        triggered_alerts = []

        async with self.db_session_factory() as session:
            # Fetch active alerts for this symbol
            result = await session.execute(
                select(Alert).filter(
                    Alert.symbol_id == symbol_id,
                    Alert.is_active == True
                )
            )
            active_alerts = result.scalars().all()

            # T106b: Use batch evaluation for high alert volumes
            if len(active_alerts) >= BATCH_EVALUATION_THRESHOLD:
                triggered_alerts = await self._evaluate_alerts_batch(
                    active_alerts, current_price, previous_price, indicator_data, indicator_data_map, bar_timestamp, session
                )
            else:
                for alert in active_alerts:
                    is_triggered = False

                    # TXXX: Trigger mode checks - BEFORE cooldown check
                    trigger_mode = alert.trigger_mode or AlertTriggerMode.ONCE_PER_BAR_CLOSE.value

                    # "once" mode: skip if already triggered
                    if trigger_mode == AlertTriggerMode.ONCE.value and alert.last_triggered_at:
                        logger.debug(f"Alert {alert.id} already triggered (once mode), skipping")
                        continue

                    # "once_per_bar" and "once_per_bar_close" modes: skip if already triggered for this bar
                    if trigger_mode in [AlertTriggerMode.ONCE_PER_BAR.value, AlertTriggerMode.ONCE_PER_BAR_CLOSE.value]:
                        if bar_timestamp and alert.last_triggered_bar_timestamp == bar_timestamp:
                            logger.debug(f"Alert {alert.id} already triggered for this bar, skipping")
                            continue

                    # Check cooldown (convert minutes to seconds)
                    # T110a: Enforce minimum cooldown to prevent rapid signal oscillations
                    effective_cooldown_seconds = (alert.cooldown or 1) * 60  # minutes -> seconds
                    effective_cooldown_seconds = max(effective_cooldown_seconds, MINIMUM_COOLDOWN_SECONDS)

                    if alert.id in self._last_triggered:
                        elapsed = (datetime.now(timezone.utc) - self._last_triggered[alert.id]).total_seconds()
                        if elapsed < effective_cooldown_seconds:
                            logger.debug(f"Alert {alert.id} in cooldown ({effective_cooldown_seconds}s), skipping")
                            continue

                    # Evaluate based on condition type
                    condition = alert.condition
                    threshold = alert.threshold

                    if condition == AlertCondition.ABOVE.value:
                        # Triggers when current > threshold AND previous <= threshold
                        if previous_price is not None:
                            is_triggered = (current_price > threshold) and (previous_price <= threshold)
                        else:
                            # Backward compatible: if no previous_price, just check current
                            is_triggered = current_price > threshold

                    elif condition == AlertCondition.BELOW.value:
                        # Triggers when current < threshold AND previous >= threshold
                        if previous_price is not None:
                            is_triggered = (current_price < threshold) and (previous_price >= threshold)
                        else:
                            # Backward compatible: if no previous_price, just check current
                            is_triggered = current_price < threshold

                    elif condition == AlertCondition.CROSSES_UP.value:
                        # Triggers when previous < threshold AND current >= threshold
                        if previous_price is not None:
                            is_triggered = (previous_price < threshold) and (current_price >= threshold)
                        else:
                            # Fallback: just check if current >= threshold
                            is_triggered = current_price >= threshold

                    elif condition == AlertCondition.CROSSES_DOWN.value:
                        # Triggers when previous > threshold AND current <= threshold
                        if previous_price is not None:
                            is_triggered = (previous_price > threshold) and (current_price <= threshold)
                        else:
                            # Fallback: just check if current <= threshold
                            is_triggered = current_price <= threshold

                    elif condition == "price_above":
                        # Legacy condition name - map to ABOVE
                        if previous_price is not None:
                            is_triggered = (current_price > threshold) and (previous_price <= threshold)
                        else:
                            is_triggered = current_price > threshold

                    elif condition == "price_below":
                        # Legacy condition name - map to BELOW
                        if previous_price is not None:
                            is_triggered = (current_price < threshold) and (previous_price >= threshold)
                        else:
                            is_triggered = current_price < threshold

                    elif condition == "crsi_band_cross":
                        # Get indicator data for this alert (prefer per-alert data, fall back to legacy)
                        alert_indicator_data = indicator_data_map.get(alert.id) if indicator_data_map else None
                        if not alert_indicator_data:
                            alert_indicator_data = indicator_data

                        if alert_indicator_data:
                            # Indicator-based alert (existing logic)
                            crsi = alert_indicator_data.get("crsi")
                            upper = alert_indicator_data.get("crsi_upper") or alert_indicator_data.get("upper_band")
                            lower = alert_indicator_data.get("crsi_lower") or alert_indicator_data.get("lower_band")
                            prev_crsi = alert_indicator_data.get("prev_crsi")
                            prev_upper = alert_indicator_data.get("prev_crsi_upper") or alert_indicator_data.get("prev_upper_band")
                            prev_lower = alert_indicator_data.get("prev_crsi_lower") or alert_indicator_data.get("prev_lower_band")

                            if all(v is not None for v in [crsi, upper, lower, prev_crsi, prev_upper, prev_lower]):
                                # Cross Above Upper Band
                                if prev_crsi <= prev_upper and crsi > upper:
                                    is_triggered = True
                                # Cross Below Lower Band
                                elif prev_crsi >= prev_lower and crsi < lower:
                                    is_triggered = True

                    elif condition == AlertCondition.CRSI_BAND_EXTREMES.value:
                        # cRSI band extremes - triggers when cRSI is above upper OR below lower band
                        # Get indicator data for this alert (prefer per-alert data, fall back to legacy)
                        alert_indicator_data = indicator_data_map.get(alert.id) if indicator_data_map else None
                        if not alert_indicator_data:
                            alert_indicator_data = indicator_data

                        if alert_indicator_data:
                            # Feature 001: Indicator-based alerts with direction-specific messages
                            triggers = self._evaluate_indicator_condition_with_direction(
                                alert, condition, alert_indicator_data, threshold, session
                            )
                        if triggers:
                            triggered_alerts.append(alert)
                            # Record trigger time for cooldown (alert-level, not per-condition)
                            now = datetime.now(timezone.utc)
                            self._last_triggered[alert.id] = now

                            # Update alert state based on trigger mode
                            alert.last_triggered_at = now

                            # "once" mode: disable alert after trigger
                            if trigger_mode == AlertTriggerMode.ONCE.value:
                                alert.is_active = False
                                logger.info(f"Alert {alert.id} disabled (once mode)")

                            # Bar modes: track bar timestamp
                            if trigger_mode in [AlertTriggerMode.ONCE_PER_BAR.value, AlertTriggerMode.ONCE_PER_BAR_CLOSE.value]:
                                if bar_timestamp:
                                    alert.last_triggered_bar_timestamp = bar_timestamp
                        # Skip the default trigger creation below since we handle it with direction info
                        continue

                    # T074 [US5] [P]: Add indicator condition evaluation
                    elif condition.startswith("indicator_"):
                        # Get indicator data for this alert (prefer per-alert data, fall back to legacy)
                        alert_indicator_data = indicator_data_map.get(alert.id) if indicator_data_map else None
                        if not alert_indicator_data:
                            alert_indicator_data = indicator_data

                        if alert_indicator_data:
                            # Feature 001: Indicator-based alerts with direction-specific messages
                            # T032: Implement cRSI band-cross detection using current + previous values
                            # T037: Handle multi-trigger edge case (both upper and lower in same cycle)
                            triggers = self._evaluate_indicator_condition_with_direction(
                                alert, condition, alert_indicator_data, threshold, session
                            )
                        if triggers:
                            triggered_alerts.append(alert)
                            # Record trigger time for cooldown (alert-level, not per-condition)
                            now = datetime.now(timezone.utc)
                            self._last_triggered[alert.id] = now

                            # Update alert state based on trigger mode
                            alert.last_triggered_at = now

                            # "once" mode: disable alert after trigger
                            if trigger_mode == AlertTriggerMode.ONCE.value:
                                alert.is_active = False
                                logger.info(f"Alert {alert.id} disabled (once mode)")

                            # Bar modes: track bar timestamp
                            if trigger_mode in [AlertTriggerMode.ONCE_PER_BAR.value, AlertTriggerMode.ONCE_PER_BAR_CLOSE.value]:
                                if bar_timestamp:
                                    alert.last_triggered_bar_timestamp = bar_timestamp
                        # Skip the default trigger creation below since we handle it with direction info
                        continue

                    if is_triggered:
                        logger.info(f"ALERT TRIGGERED: {alert.id} ({condition}) for symbol {symbol_id} at {current_price}")
                        triggered_alerts.append(alert)

                        # Record trigger time for cooldown
                        now = datetime.now(timezone.utc)
                        self._last_triggered[alert.id] = now

                        # Update alert state based on trigger mode
                        alert.last_triggered_at = now

                        # "once" mode: disable alert after trigger
                        if trigger_mode == AlertTriggerMode.ONCE.value:
                            alert.is_active = False
                            logger.info(f"Alert {alert.id} disabled (once mode)")

                        # Bar modes: track bar timestamp
                        if trigger_mode in [AlertTriggerMode.ONCE_PER_BAR.value, AlertTriggerMode.ONCE_PER_BAR_CLOSE.value]:
                            if bar_timestamp:
                                alert.last_triggered_bar_timestamp = bar_timestamp

                        # Create AlertTrigger record
                        # T084 [US5]: Update alert trigger creation to include indicator_value
                        trigger_data = {
                            "alert_id": alert.id,
                            "triggered_at": now,
                            "observed_price": current_price
                        }

                        # Add indicator value if this is an indicator-based alert
                        if condition.startswith("indicator_") and indicator_data:
                            indicator_field = alert.indicator_field
                            if indicator_field and indicator_field in indicator_data:
                                trigger_data["indicator_value"] = float(indicator_data[indicator_field])

                        trigger = AlertTrigger(**trigger_data)
                        session.add(trigger)

            if triggered_alerts:
                await session.commit()

        # T106a: Log timing measurement
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        if elapsed_ms > ALERT_EVALUATION_BUDGET_MS:
            logger.warning(
                f"Alert evaluation for {len(active_alerts)} alerts took {elapsed_ms:.2f}ms, "
                f"exceeding budget of {ALERT_EVALUATION_BUDGET_MS}ms"
            )
        else:
            logger.debug(
                f"Alert evaluation for {len(active_alerts)} alerts completed in {elapsed_ms:.2f}ms"
            )

        return triggered_alerts

    async def _evaluate_alerts_batch(
        self,
        alerts: List[Alert],
        current_price: float,
        previous_price: Optional[float],
        indicator_data: Optional[dict],
        indicator_data_map: Optional[Dict[int, dict]],
        bar_timestamp: Optional[datetime],
        session
    ) -> List[Alert]:
        """
        T106b: Batch evaluation for high alert volumes (>1000).

        This method processes alerts in batches to maintain performance
        when dealing with large numbers of alerts. It uses the same
        evaluation logic as the single alert path but optimized for bulk.

        Args:
            alerts: List of Alert objects to evaluate
            current_price: The current price
            previous_price: The previous price
            indicator_data: Optional indicator data for indicator-based alerts (legacy, per-symbol)
            indicator_data_map: Optional per-alert indicator data dict {alert_id: indicator_data} (new, custom indicators)
            bar_timestamp: The timestamp of the current bar (for bar-based trigger modes)
            session: Database session

        Returns:
            List of triggered Alert objects
        """
        triggered_alerts = []
        now = datetime.now(timezone.utc)

        # T110a: Filter out alerts in cooldown and trigger mode skips (batch operation)
        # Enforce minimum cooldown to prevent rapid signal oscillations
        active_alerts = []
        for alert in alerts:
            trigger_mode = alert.trigger_mode or AlertTriggerMode.ONCE_PER_BAR_CLOSE.value

            # "once" mode: skip if already triggered
            if trigger_mode == AlertTriggerMode.ONCE.value and alert.last_triggered_at:
                continue

            # "once_per_bar" and "once_per_bar_close" modes: skip if already triggered for this bar
            if trigger_mode in [AlertTriggerMode.ONCE_PER_BAR.value, AlertTriggerMode.ONCE_PER_BAR_CLOSE.value]:
                if bar_timestamp and alert.last_triggered_bar_timestamp == bar_timestamp:
                    continue

            # Check cooldown (convert minutes to seconds)
            effective_cooldown_seconds = (alert.cooldown or 1) * 60  # minutes -> seconds
            effective_cooldown_seconds = max(effective_cooldown_seconds, MINIMUM_COOLDOWN_SECONDS)

            if alert.id in self._last_triggered:
                elapsed = (now - self._last_triggered[alert.id]).total_seconds()
                if elapsed < effective_cooldown_seconds:
                    continue  # Skip alerts in cooldown
            active_alerts.append(alert)

        logger.info(f"Batch evaluation: {len(active_alerts)}/{len(alerts)} alerts after cooldown filter")

        # Evaluate each alert
        for alert in active_alerts:
            is_triggered = False
            condition = alert.condition
            threshold = alert.threshold

            if condition == AlertCondition.ABOVE.value:
                is_triggered = (previous_price is not None and
                               (current_price > threshold and previous_price <= threshold))
            elif condition == AlertCondition.BELOW.value:
                is_triggered = (previous_price is not None and
                               (current_price < threshold and previous_price >= threshold))
            elif condition == AlertCondition.CROSSES_UP.value:
                is_triggered = (previous_price is not None and
                               previous_price < threshold and current_price >= threshold)
            elif condition == AlertCondition.CROSSES_DOWN.value:
                is_triggered = (previous_price is not None and
                               previous_price > threshold and current_price <= threshold)
            elif condition.startswith("indicator_"):
                # Get indicator data for this alert (prefer per-alert data, fall back to legacy)
                alert_indicator_data = indicator_data_map.get(alert.id) if indicator_data_map else None
                if not alert_indicator_data:
                    alert_indicator_data = indicator_data

                if alert_indicator_data:
                    is_triggered = self._evaluate_indicator_condition(
                        condition, alert_indicator_data, threshold
                    )

            if is_triggered:
                triggered_alerts.append(alert)
                self._last_triggered[alert.id] = now

                # Update alert state based on trigger mode
                trigger_mode = alert.trigger_mode or AlertTriggerMode.ONCE_PER_BAR_CLOSE.value
                alert.last_triggered_at = now

                # "once" mode: disable alert after trigger
                if trigger_mode == AlertTriggerMode.ONCE.value:
                    alert.is_active = False

                # Bar modes: track bar timestamp
                if trigger_mode in [AlertTriggerMode.ONCE_PER_BAR.value, AlertTriggerMode.ONCE_PER_BAR_CLOSE.value]:
                    if bar_timestamp:
                        alert.last_triggered_bar_timestamp = bar_timestamp

                # Create trigger
                trigger_data = {
                    "alert_id": alert.id,
                    "triggered_at": now,
                    "observed_price": current_price
                }
                if condition.startswith("indicator_") and indicator_data:
                    indicator_field = alert.indicator_field
                    if indicator_field and indicator_field in indicator_data:
                        trigger_data["indicator_value"] = float(indicator_data[indicator_field])

                trigger = AlertTrigger(**trigger_data)
                session.add(trigger)

        return triggered_alerts

    def _evaluate_indicator_condition(
        self,
        condition: str,
        indicator_data: dict,
        threshold: float
    ) -> bool:
        """
        Evaluate indicator-based alert conditions.

        T075 [US5]: Implement indicator_crosses_upper condition
        T076 [US5]: Implement indicator_crosses_lower condition
        T077 [US5]: Implement indicator_turns_positive condition
        T078 [US5]: Implement indicator_turns_negative condition
        T079 [US5]: Implement indicator_slope_bullish condition
        T080 [US5]: Implement indicator_slope_bearish condition

        cRSI Band Conditions:
        - indicator_above_upper: cRSI is above upper band (sell signal)
        - indicator_below_lower: cRSI is below lower band (buy signal)

        Args:
            condition: The alert condition type
            indicator_data: Dict with 'value', 'prev_value', and band keys
            threshold: The threshold value for comparison

        Returns:
            True if the condition is triggered, False otherwise
        """
        current_value = indicator_data.get("value")
        prev_value = indicator_data.get("prev_value")

        if current_value is None:
            return False

        # cRSI band conditions - use band values from indicator_data
        if condition == AlertCondition.INDICATOR_ABOVE_UPPER.value:
            # Triggers when cRSI is above upper band (sell signal)
            upper_band = indicator_data.get("upper_band") or indicator_data.get("crsi_upper")
            if upper_band is not None:
                return current_value > upper_band
            return False

        elif condition == AlertCondition.INDICATOR_BELOW_LOWER.value:
            # Triggers when cRSI is below lower band (buy signal)
            lower_band = indicator_data.get("lower_band") or indicator_data.get("crsi_lower")
            if lower_band is not None:
                return current_value < lower_band
            return False

        elif condition == AlertCondition.INDICATOR_CROSSES_UPPER.value:
            # Triggers when indicator crosses above threshold
            if prev_value is not None:
                return prev_value < threshold and current_value >= threshold
            return current_value >= threshold

        elif condition == AlertCondition.INDICATOR_CROSSES_LOWER.value:
            # Triggers when indicator crosses below threshold
            if prev_value is not None:
                return prev_value > threshold and current_value <= threshold
            return current_value <= threshold

        elif condition == AlertCondition.INDICATOR_TURNS_POSITIVE.value:
            # Triggers when indicator enters positive zone (negative -> positive)
            if prev_value is not None:
                return prev_value <= 0 and current_value > 0
            return current_value > 0

        elif condition == AlertCondition.INDICATOR_TURNS_NEGATIVE.value:
            # Triggers when indicator enters negative zone (positive -> negative)
            if prev_value is not None:
                return prev_value >= 0 and current_value < 0
            return current_value < 0

        elif condition == AlertCondition.INDICATOR_SLOPE_BULLISH.value:
            # Triggers when indicator slope changes from negative/flat to positive
            if prev_value is not None:
                prev_slope = indicator_data.get("prev_slope", 0)
                current_slope = indicator_data.get("current_slope", 0)
                # Use slope values if available, otherwise compute from values
                if prev_slope == 0 and current_slope == 0:
                    prev_slope = 0
                    current_slope = current_value - prev_value
                return prev_slope <= 0 and current_slope > 0
            return False  # Need previous value to determine slope change

        elif condition == AlertCondition.INDICATOR_SLOPE_BEARISH.value:
            # Triggers when indicator slope changes from positive/flat to negative
            if prev_value is not None:
                prev_slope = indicator_data.get("prev_slope", 0)
                current_slope = indicator_data.get("current_slope", 0)
                # Use slope values if available, otherwise compute from values
                if prev_slope == 0 and current_slope == 0:
                    prev_slope = 0
                    current_slope = current_value - prev_value
                return prev_slope >= 0 and current_slope < 0
            return False  # Need previous value to determine slope change

        elif condition == AlertCondition.INDICATOR_SIGNAL_CHANGE.value:
            # Triggers when discrete signal value changes (e.g., 0 -> 1)
            if prev_value is not None:
                return current_value != prev_value
            return False

        elif condition == AlertCondition.CRSI_BAND_EXTREMES.value:
            # Triggers when cRSI is above upper band OR below lower band
            # Respects enabled_conditions for upper/lower
            upper_band = indicator_data.get("upper_band") or indicator_data.get("crsi_upper")
            lower_band = indicator_data.get("lower_band") or indicator_data.get("crsi_lower")
            if upper_band is None or lower_band is None:
                return False

            enabled_conditions = indicator_data.get("enabled_conditions") or {"upper": True, "lower": True}
            upper_enabled = enabled_conditions.get("upper", True)
            lower_enabled = enabled_conditions.get("lower", True)

            if upper_enabled and current_value > upper_band:
                return True
            if lower_enabled and current_value < lower_band:
                return True
            return False

        return False

    def _evaluate_indicator_condition_with_direction(
        self,
        alert: Alert,
        condition: str,
        indicator_data: dict,
        threshold: float,
        session
    ) -> List[AlertTrigger]:
        """
        Feature 001: Evaluate indicator-based alerts with direction-specific trigger messages.

        T032: Implement cRSI band-cross detection using current + previous values
        T033: Create trigger events for both upper and lower crosses independently
        T034: Store trigger_type ("upper" or "lower") with each AlertTrigger
        T035: Store trigger_message (direction-specific from Alert config) with each AlertTrigger
        T037: Handle multi-trigger edge case (both upper and lower can trigger in same cycle)

        For cRSI alerts with enabled_conditions:
        - Checks upper band cross: prev_value <= upper_band AND current_value > upper_band
        - Checks lower band cross: prev_value >= lower_band AND current_value < lower_band
        - Creates separate AlertTrigger for each condition that fires
        - Each trigger includes trigger_type and trigger_message

        Args:
            alert: The Alert object with enabled_conditions, message_upper, message_lower
            condition: The alert condition type (e.g., "indicator_crosses_upper")
            indicator_data: Dict with 'value', 'prev_value', and optionally 'upper_band', 'lower_band'
            threshold: The threshold value (not used for band-cross detection)
            session: Database session for creating triggers

        Returns:
            List of AlertTrigger objects created (may be 0, 1, or 2 for multi-trigger case)
        """
        triggers_created = []
        now = datetime.now(timezone.utc)

        # Get indicator values
        current_value = indicator_data.get("value")
        prev_value = indicator_data.get("prev_value")

        if current_value is None or prev_value is None:
            return triggers_created

        # For cRSI band-cross detection, we need band values
        upper_band = indicator_data.get("upper_band", indicator_data.get("crsi_upper", 70))
        lower_band = indicator_data.get("lower_band", indicator_data.get("crsi_lower", 30))

        # Check enabled_conditions from alert config
        enabled_conditions = alert.enabled_conditions or {"upper": True, "lower": True}
        upper_enabled = enabled_conditions.get("upper", True)
        lower_enabled = enabled_conditions.get("lower", True)

        # Direction-specific messages from alert config
        message_upper = alert.message_upper or "It's time to sell!"
        message_lower = alert.message_lower or "It's time to buy!"

        # Check upper band - use state check (not cross) for crsi_band_extremes
        if upper_enabled and condition == AlertCondition.CRSI_BAND_EXTREMES.value:
            # Triggers when cRSI is above upper band (sell signal) - STATE check, not cross
            if current_value > upper_band:
                trigger = AlertTrigger(
                    alert_id=alert.id,
                    triggered_at=now,
                    observed_price=indicator_data.get("price"),
                    indicator_value=float(current_value),
                    trigger_type="upper",
                    trigger_message=message_upper
                )
                session.add(trigger)
                triggers_created.append(trigger)
                logger.info(f"UPPER BAND EXTREME: Alert {alert.id} triggered at {current_value} > {upper_band}")

        # Check lower band - use state check (not cross) for crsi_band_extremes
        if lower_enabled and condition == AlertCondition.CRSI_BAND_EXTREMES.value:
            # Triggers when cRSI is below lower band (buy signal) - STATE check, not cross
            if current_value < lower_band:
                trigger = AlertTrigger(
                    alert_id=alert.id,
                    triggered_at=now,
                    observed_price=indicator_data.get("price"),
                    indicator_value=float(current_value),
                    trigger_type="lower",
                    trigger_message=message_lower
                )
                session.add(trigger)
                triggers_created.append(trigger)
                logger.info(f"LOWER BAND EXTREME: Alert {alert.id} triggered at {current_value} < {lower_band}")

        # Check upper band cross (if enabled) - for cross-based conditions
        if upper_enabled and condition in ["indicator_crosses_upper", "indicator_crosses_lower", "crsi_band_cross"]:
            # T032: prev_value <= upper_band AND current_value > upper_band
            if prev_value <= upper_band and current_value > upper_band:
                trigger = AlertTrigger(
                    alert_id=alert.id,
                    triggered_at=now,
                    observed_price=indicator_data.get("price"),
                    indicator_value=float(current_value),
                    trigger_type="upper",
                    trigger_message=message_upper
                )
                session.add(trigger)
                triggers_created.append(trigger)
                logger.info(f"UPPER BAND CROSS: Alert {alert.id} triggered at {current_value} > {upper_band}")

        # Check lower band cross (if enabled) - for cross-based conditions
        if lower_enabled and condition in ["indicator_crosses_upper", "indicator_crosses_lower", "crsi_band_cross"]:
            # T032: prev_value >= lower_band AND current_value < lower_band
            if prev_value >= lower_band and current_value < lower_band:
                trigger = AlertTrigger(
                    alert_id=alert.id,
                    triggered_at=now,
                    observed_price=indicator_data.get("price"),
                    indicator_value=float(current_value),
                    trigger_type="lower",
                    trigger_message=message_lower
                )
                session.add(trigger)
                triggers_created.append(trigger)
                logger.info(f"LOWER BAND CROSS: Alert {alert.id} triggered at {current_value} < {lower_band}")

        # Update alert's last_triggered_at timestamp if any triggers were created
        if triggers_created:
            alert.last_triggered_at = now

        return triggers_created
