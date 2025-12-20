import logging
from typing import List, Callable, Any
from sqlalchemy.future import select
from app.models.alert import Alert

logger = logging.getLogger(__name__)

class AlertEngine:
    def __init__(self, db_session_factory: Callable[[], Any]):
        self.db_session_factory = db_session_factory

    async def evaluate_symbol_alerts(
        self, 
        symbol_id: int, 
        current_price: float, 
        indicator_data: dict = None
    ) -> List[Alert]:
        triggered_alerts = []
        
        async with self.db_session_factory() as session:
            # Fetch active alerts for this symbol
            result = await session.execute(
                select(Alert).filter(Alert.symbol_id == symbol_id, Alert.is_active == True)
            )
            active_alerts = result.scalars().all()
            
            for alert in active_alerts:
                is_triggered = False
                if alert.condition == "price_above" and current_price > alert.threshold:
                    is_triggered = True
                elif alert.condition == "price_below" and current_price < alert.threshold:
                    is_triggered = True
                elif alert.condition == "crsi_band_cross" and indicator_data:
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
                
                if is_triggered:
                    logger.info(f"ALERT TRIGGERED: {alert.id} for symbol {symbol_id} at {current_price}")
                    triggered_alerts.append(alert)
            
            # if triggered_alerts:
            #    await session.commit()
                
        return triggered_alerts
