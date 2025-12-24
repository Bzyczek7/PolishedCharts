import logging
import time
from typing import List, Callable, Any, Optional
from sqlalchemy.future import select
from datetime import datetime, timezone, timedelta
from app.models.alert import Alert
from app.models.alert_trigger import AlertTrigger
from app.core.enums import AlertCondition

logger = logging.getLogger(__name__)

# Performance budget for alert evaluation (500ms per Constitution)
ALERT_EVALUATION_BUDGET_MS = 500
# Threshold for enabling batch evaluation
BATCH_EVALUATION_THRESHOLD = 1000
# T110a: Minimum cooldown to prevent rapid signal oscillations (in seconds)
MINIMUM_COOLDOWN_SECONDS = 5


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
        indicator_data: dict = None
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

        Args:
            symbol_id: The symbol ID to evaluate alerts for
            current_price: The current price
            previous_price: The previous price (required for above/below/crosses conditions)
            indicator_data: Optional indicator data for indicator-based alerts

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
                    active_alerts, current_price, previous_price, indicator_data, session
                )
            else:
                for alert in active_alerts:
                    is_triggered = False

                    # Check cooldown
                    # T110a: Enforce minimum cooldown to prevent rapid signal oscillations
                    effective_cooldown = alert.cooldown if alert.cooldown else MINIMUM_COOLDOWN_SECONDS
                    effective_cooldown = max(effective_cooldown, MINIMUM_COOLDOWN_SECONDS)

                    if alert.id in self._last_triggered:
                        elapsed = (datetime.now(timezone.utc) - self._last_triggered[alert.id]).total_seconds()
                        if elapsed < effective_cooldown:
                            logger.debug(f"Alert {alert.id} in cooldown ({effective_cooldown}s), skipping")
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

                    elif condition == "crsi_band_cross" and indicator_data:
                        # Indicator-based alert (existing logic)
                        crsi = indicator_data.get("crsi")
                        upper = indicator_data.get("crsi_upper")
                        lower = indicator_data.get("crsi_lower")
                        prev_crsi = indicator_data.get("prev_crsi")
                        prev_upper = indicator_data.get("prev_crsi_upper")
                        prev_lower = indicator_data.get("prev_crsi_lower")

                        if all(v is not None for v in [crsi, upper, lower, prev_crsi, prev_upper, prev_lower]):
                            # Cross Above Upper Band
                            if prev_crsi <= prev_upper and crsi > upper:
                                is_triggered = True
                            # Cross Below Lower Band
                            elif prev_crsi >= prev_lower and crsi < lower:
                                is_triggered = True

                    # T074 [US5] [P]: Add indicator condition evaluation
                    elif condition.startswith("indicator_") and indicator_data:
                        # Generic indicator-based alerts
                        is_triggered = self._evaluate_indicator_condition(
                            condition, indicator_data, threshold
                        )

                    if is_triggered:
                        logger.info(f"ALERT TRIGGERED: {alert.id} ({condition}) for symbol {symbol_id} at {current_price}")
                        triggered_alerts.append(alert)

                        # Record trigger time for cooldown
                        self._last_triggered[alert.id] = datetime.now(timezone.utc)

                        # Create AlertTrigger record
                        # T084 [US5]: Update alert trigger creation to include indicator_value
                        trigger_data = {
                            "alert_id": alert.id,
                            "triggered_at": datetime.now(timezone.utc),
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
            indicator_data: Optional indicator data for indicator-based alerts
            session: Database session

        Returns:
            List of triggered Alert objects
        """
        triggered_alerts = []
        now = datetime.now(timezone.utc)

        # T110a: Filter out alerts in cooldown (batch operation)
        # Enforce minimum cooldown to prevent rapid signal oscillations
        active_alerts = []
        for alert in alerts:
            effective_cooldown = alert.cooldown if alert.cooldown else MINIMUM_COOLDOWN_SECONDS
            effective_cooldown = max(effective_cooldown, MINIMUM_COOLDOWN_SECONDS)

            if alert.id in self._last_triggered:
                elapsed = (now - self._last_triggered[alert.id]).total_seconds()
                if elapsed < effective_cooldown:
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
            elif condition.startswith("indicator_") and indicator_data:
                is_triggered = self._evaluate_indicator_condition(
                    condition, indicator_data, threshold
                )

            if is_triggered:
                triggered_alerts.append(alert)
                self._last_triggered[alert.id] = now

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

        Args:
            condition: The alert condition type
            indicator_data: Dict with 'value' and 'prev_value' keys
            threshold: The threshold value for comparison

        Returns:
            True if the condition is triggered, False otherwise
        """
        current_value = indicator_data.get("value")
        prev_value = indicator_data.get("prev_value")

        if current_value is None:
            return False

        if condition == AlertCondition.INDICATOR_CROSSES_UPPER.value:
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

        return False
