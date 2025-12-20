from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.db.session import get_db
from app.models.alert import Alert
from app.schemas.alert import AlertCreate, AlertResponse

router = APIRouter()

@router.post("/", response_model=AlertResponse, status_code=201)
async def create_alert(alert_in: AlertCreate, db: AsyncSession = Depends(get_db)):
    alert = Alert(
        symbol_id=alert_in.symbol_id,
        condition=alert_in.condition,
        threshold=alert_in.threshold,
        is_active=alert_in.is_active
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    return alert

@router.get("/", response_model=List[AlertResponse])
async def list_alerts(db: AsyncSession = Depends(get_db)):
    # Simple list for now
    from sqlalchemy.future import select
    result = await db.execute(select(Alert))
    return result.scalars().all()
