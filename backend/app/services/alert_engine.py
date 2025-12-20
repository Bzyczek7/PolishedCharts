import logging
from typing import List, Callable, Any
from sqlalchemy.future import select
from app.models.alert import Alert

logger = logging.getLogger(__name__)

class AlertEngine:
    def __init__(self, db_session_factory: Callable[[], Any]):
        self.db_session_factory = db_session_factory

    async def evaluate_symbol_alerts(self, symbol_id: int, current_price: float) -> List[Alert]:
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
                
                if is_triggered:
                    logger.info(f"ALERT TRIGGERED: {alert.id} for symbol {symbol_id} at {current_price}")
                    # In a real system, we might mark it inactive or send a notification
                    # alert.is_active = False # Deactivate after trigger
                    # session.add(alert)
                    triggered_alerts.append(alert)
            
            # if triggered_alerts:
            #    await session.commit()
                
        return triggered_alerts
