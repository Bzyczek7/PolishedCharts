"""
Alert delivery tasks with retry logic.

This module implements asynchronous alert notification delivery with
exponential backoff retry logic for handling transient failures.

T085 [P] [US5]: Create Celery task for alert delivery
T086 [US5]: Implement exponential backoff retry logic
T087 [US5]: Add delivery status update on failure
"""

import logging
from datetime import datetime, timezone
from typing import Optional
from celery import shared_task, current_task
from sqlalchemy.future import select
from app.db.session import AsyncSessionLocal
from app.models.alert_trigger import AlertTrigger

logger = logging.getLogger(__name__)


def get_db_session_factory():
    """Return a factory for creating database sessions."""
    return AsyncSessionLocal

# Retry schedule: 30s, 2min, 8min, 32min, 128min (exponential backoff)
RETRY_DELAYS = [30, 120, 480, 1920, 7680]  # seconds
MAX_RETRIES = len(RETRY_DELAYS)


@shared_task(
    bind=True,
    max_retries=MAX_RETRIES,
    default_retry_delay=RETRY_DELAYS[0],
    autoretry_for=(Exception,),  # Retry on any exception
    retry_backoff=True,  # Enable exponential backoff
    retry_backoff_max=7680,  # Max delay in seconds (128 minutes)
    retry_jitter=True,  # Add jitter to avoid thundering herd
)
def send_alert_notification(trigger_id: int) -> dict:
    """
    Send notification for an alert trigger with retry logic.

    This task attempts to deliver a notification for an alert trigger.
    On failure, it will retry with exponential backoff up to 5 times.

    T085 [P] [US5]: Create Celery task for alert delivery

    Args:
        trigger_id: The ID of the AlertTrigger to send notification for

    Returns:
        Dict with status and trigger_id

    Raises:
        Exception: Re-raises for Celery retry mechanism after max retries
    """
    db_session_factory = get_db_session_factory()

    with db_session_factory() as session:
        result = session.execute(
            select(AlertTrigger).filter(AlertTrigger.id == trigger_id)
        )
        trigger = result.scalar_one_or_none()

        if not trigger:
            logger.error(f"AlertTrigger {trigger_id} not found")
            return {"status": "error", "message": "Trigger not found", "trigger_id": trigger_id}

        if trigger.delivery_status == "delivered":
            logger.info(f"AlertTrigger {trigger_id} already delivered")
            return {"status": "already_delivered", "trigger_id": trigger_id}

        if trigger.retry_count and trigger.retry_count >= MAX_RETRIES:
            logger.error(f"AlertTrigger {trigger_id} exceeded max retries")
            trigger.delivery_status = "failed"
            session.commit()
            return {"status": "failed", "trigger_id": trigger_id}

        # Attempt delivery
        try:
            _send_notification(trigger)
            _update_delivery_status(trigger, session, "delivered")
            logger.info(f"Successfully delivered alert notification for trigger {trigger_id}")
            return {"status": "delivered", "trigger_id": trigger_id}

        except Exception as e:
            retry_count = (trigger.retry_count or 0) + 1

            # T086 [US5]: Implement exponential backoff retry logic
            if retry_count < MAX_RETRIES:
                # Update status to retrying
                _update_delivery_status(trigger, session, "retrying", retry_count)
                session.commit()

                # Calculate retry delay based on retry count
                retry_delay = RETRY_DELAYS[retry_count - 1]
                logger.warning(
                    f"Failed to deliver alert {trigger_id} (attempt {retry_count}/{MAX_RETRIES}): {e}. "
                    f"Retrying in {retry_delay}s..."
                )

                # Raise for Celery to retry with exponential backoff
                try:
                    current_task.retry(
                        exc=e,
                        countdown=retry_delay,
                    )
                except Exception as retry_error:
                    # Celery's retry raises a special exception that triggers retry
                    # We need to update the status before raising
                    trigger.last_retry_at = datetime.now(timezone.utc)
                    session.commit()
                    raise retry_error

            else:
                # T087 [US5]: Add delivery status update on failure (max retries exceeded)
                _update_delivery_status(trigger, session, "failed", retry_count)
                session.commit()
                logger.error(
                    f"Failed to deliver alert {trigger_id} after {retry_count} attempts: {e}"
                )
                return {"status": "failed", "trigger_id": trigger_id, "error": str(e)}


def _send_notification(trigger: AlertTrigger) -> None:
    """
    Send the actual notification.

    This is a placeholder for the actual notification delivery logic.
    In production, this would integrate with notification services like:
    - Email (SMTP, SendGrid, AWS SES)
    - Push notifications (Firebase Cloud Messaging)
    - Webhooks
    - SMS (Twilio)
    - In-app notifications

    Args:
        trigger: The AlertTrigger to send notification for

    Raises:
        Exception: If notification delivery fails
    """
    # TODO: Implement actual notification delivery
    # For now, we'll simulate a delivery that may fail

    import random

    # Simulate 80% success rate for testing
    if random.random() < 0.8:
        logger.debug(f"Notification sent successfully for trigger {trigger.id}")
    else:
        # Simulate a transient failure
        raise Exception("Simulated notification service error (transient)")


def _update_delivery_status(
    trigger: AlertTrigger,
    session,
    status: str,
    retry_count: Optional[int] = None
) -> None:
    """
    Update the delivery status of an alert trigger.

    Args:
        trigger: The AlertTrigger to update
        session: Database session
        status: New delivery status (pending, delivered, failed, retrying)
        retry_count: Optional retry count to update
    """
    trigger.delivery_status = status
    if retry_count is not None:
        trigger.retry_count = retry_count

    if status == "retrying":
        trigger.last_retry_at = datetime.now(timezone.utc)

    session.add(trigger)
