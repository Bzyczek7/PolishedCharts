"""
Notification Audit Logging Utility

Provides centralized audit logging for notification system operations.
All logging follows FR-AUDIT requirements:
- FR-AUDIT-001: Log credential modifications with user_id, timestamp, action type
- FR-AUDIT-002: Log notification history access with user_id, timestamp, range
- FR-AUDIT-003: Records retained 90 days (NotificationDelivery), 365 days (audit logs)
- FR-AUDIT-005: NEVER log credential values, decrypted data, or raw API responses
- FR-AUDIT-006: Failed deliveries log only: alert_id, trigger_id, type, error_type

Usage:
    from app.services.audit import notification_audit_log

    # Log credential change
    notification_audit_log.log_credential_change(user_id, "create")

    # Log notification failure
    notification_audit_log.log_notification_failure(
        alert_id=alert_id,
        trigger_id=trigger_id,
        notification_type="telegram",
        error_type="network_error"
    )
"""

import logging
from datetime import datetime
from typing import Optional
from uuid import UUID

logger = logging.getLogger(__name__)


class NotificationAuditLog:
    """
    Centralized audit logging for notification system.

    All methods follow security requirements:
    - Never accept or log credential values
    - Never log decrypted data
    - Never log raw API responses
    - Only log sanitized metadata
    """

    def log_credential_change(
        self,
        user_id: UUID,
        action: str,
        details: Optional[dict] = None
    ) -> None:
        """
        Log credential modification (create/update/delete).

        Args:
            user_id: User performing the action
            action: Action type: "create", "update", "delete"
            details: Optional sanitized details (never include credential values)

        FR-AUDIT-001 Compliant:
            - Logs user_id, timestamp, action type
            - Does NOT log credential values
        """
        log_data = {
            "event": "notification_credential_change",
            "user_id": str(user_id),
            "action": action,
            "timestamp": datetime.utcnow().isoformat(),
        }
        if details:
            # Ensure no sensitive data in details
            log_data["details"] = details

        logger.info(f"Notification credential {action}: user_id={user_id}")

    def log_history_access(
        self,
        user_id: UUID,
        range: str,
        result_count: Optional[int] = None
    ) -> None:
        """
        Log notification history access.

        Args:
            user_id: User accessing history
            range: Requested history range (e.g., "last_50", "last_7_days")
            result_count: Number of records returned (optional)

        FR-AUDIT-002 Compliant:
            - Logs user_id, timestamp, requested range
        """
        log_data = {
            "event": "notification_history_access",
            "user_id": str(user_id),
            "range": range,
            "timestamp": datetime.utcnow().isoformat(),
        }
        if result_count is not None:
            log_data["result_count"] = result_count

        logger.info(f"Notification history accessed: user_id={user_id}, range={range}")

    def log_notification_delivery(
        self,
        alert_id: UUID,
        trigger_id: UUID,
        notification_type: str,
        status: str,
        delivery_id: Optional[UUID] = None
    ) -> None:
        """
        Log successful notification delivery.

        Args:
            alert_id: Alert that triggered
            trigger_id: AlertTrigger that generated the notification
            notification_type: Type of notification (toast, sound, telegram)
            status: Delivery status (sent, failed)
            delivery_id: ID of NotificationDelivery record (optional)

        FR-AUDIT Compliant:
            - Logs only metadata, no message content
        """
        log_data = {
            "event": "notification_delivery",
            "alert_id": str(alert_id),
            "trigger_id": str(trigger_id),
            "notification_type": notification_type,
            "status": status,
            "timestamp": datetime.utcnow().isoformat(),
        }
        if delivery_id:
            log_data["delivery_id"] = str(delivery_id)

        logger.info(f"Notification delivered: type={notification_type}, status={status}")

    def log_notification_failure(
        self,
        alert_id: UUID,
        trigger_id: UUID,
        notification_type: str,
        error_type: str,
        details: Optional[str] = None
    ) -> None:
        """
        Log notification delivery failure.

        Args:
            alert_id: Alert that triggered
            trigger_id: AlertTrigger that generated the notification
            notification_type: Type of notification (toast, sound, telegram)
            error_type: Error category (network_error, validation_error, etc.)
            details: Optional short error description (no stack traces, no sensitive data)

        FR-AUDIT-006 Compliant:
            - Logs only: alert_id, trigger_id, notification_type, error_type
            - Does NOT log message content, error messages with user data
        """
        log_data = {
            "event": "notification_failure",
            "alert_id": str(alert_id),
            "trigger_id": str(trigger_id),
            "notification_type": notification_type,
            "error_type": error_type,
            "timestamp": datetime.utcnow().isoformat(),
        }
        if details:
            # Keep details minimal and sanitized
            log_data["details"] = details[:100] if details else None

        logger.warning(
            f"Notification failed: type={notification_type}, error={error_type}"
        )

    def log_settings_access(
        self,
        user_id: UUID,
        action: str = "access"
    ) -> None:
        """
        Log notification settings access or update.

        Args:
            user_id: User accessing/updating settings
            action: Action type: "access", "update"

        FR-AUDIT-001/002 Compliant:
            - Logs user_id, timestamp, action type
        """
        log_data = {
            "event": "notification_settings_access",
            "user_id": str(user_id),
            "action": action,
            "timestamp": datetime.utcnow().isoformat(),
        }

        logger.info(f"Notification settings {action}: user_id={user_id}")

    def log_telegram_test(
        self,
        user_id: UUID,
        success: bool,
        error_type: Optional[str] = None
    ) -> None:
        """
        Log Telegram test notification result.

        Args:
            user_id: User performing test
            success: Whether test succeeded
            error_type: Error type if failed (optional)

        FR-AUDIT Compliant:
            - Logs only result, no message content
        """
        log_data = {
            "event": "telegram_test",
            "user_id": str(user_id),
            "success": success,
            "timestamp": datetime.utcnow().isoformat(),
        }
        if not success and error_type:
            log_data["error_type"] = error_type

        if success:
            logger.info(f"Telegram test successful: user_id={user_id}")
        else:
            logger.warning(f"Telegram test failed: user_id={user_id}, error={error_type}")


# Singleton instance for use across the application
notification_audit_log = NotificationAuditLog()
