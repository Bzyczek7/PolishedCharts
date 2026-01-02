# Data Model: Alarm Notification System

**Feature**: 013-alarm-notifications
**Created**: 2025-12-31
**Updated**: 2026-01-01

## Overview

This document defines the data structures for the notification system, including user preferences, notification history, Telegram credentials, and per-alert settings.

## Key Changes (2026-01-01)

- Renamed `AlertNotification` → `NotificationDelivery` (history records only)
- Created `AlertNotificationSettings` (per-alert notification overrides)
- Added `AlertTrigger` FK relationship to `NotificationDelivery`
- Added `NotificationPreference` entity (global user settings)
- Documented AES-256-GCM key management strategy

## Entities

### NotificationPreference

Global user notification preferences (one-to-one with User).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes | Preference identifier |
| `user_id` | UUID | Yes | Foreign key to User |
| `toast_enabled` | boolean | Yes | Show toast notifications |
| `sound_enabled` | boolean | Yes | Play sound notifications |
| `sound_type` | string | No | Sound identifier (bell, alert, chime) |
| `telegram_enabled` | boolean | Yes | Send Telegram messages |
| `telegram_token_encrypted` | string | No | Encrypted Telegram bot token |
| `telegram_chat_id_encrypted` | string | No | Encrypted Telegram chat ID |
| `created_at` | timestamp | Yes | Creation timestamp |
| `updated_at` | timestamp | Yes | Last update timestamp |

**Constraints**:
- One-to-one with User (user_id UNIQUE)
- `telegram_token_encrypted` and `telegram_chat_id_encrypted` are both required if `telegram_enabled` is true
- `sound_type` is required if `sound_enabled` is true
- Encryption: AES-256-GCM with key from `TELEGRAM_ENCRYPTION_KEY` env var

### AlertNotificationSettings

Per-alert notification overrides. When set, these override global `NotificationPreference` settings for a specific alert.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes | Settings identifier |
| `alert_id` | UUID | Yes | Foreign key to Alert |
| `toast_enabled` | boolean | No | Override global toast setting (null = use global) |
| `sound_enabled` | boolean | No | Override global sound setting (null = use global) |
| `sound_type` | string | No | Alert-specific sound (null = use global) |
| `telegram_enabled` | boolean | No | Override global Telegram setting (null = use global) |
| `created_at` | timestamp | Yes | Creation timestamp |
| `updated_at` | timestamp | Yes | Last update timestamp |

**Note**: When any field is null, the global `NotificationPreference` value is used.

### NotificationDelivery

Record of a notification that was sent (history). Multiple deliveries per AlertTrigger (one per notification type: toast, sound, Telegram).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes | Delivery identifier |
| `alert_trigger_id` | UUID | Yes | Foreign key to AlertTrigger (1:N relationship) |
| `alert_id` | UUID | Yes | Foreign key to Alert (denormalized for query efficiency) |
| `user_id` | UUID | Yes | User who owns the alert |
| `notification_type` | enum | Yes | TOAST, SOUND, TELEGRAM |
| `status` | enum | Yes | SENT, FAILED, PENDING |
| `triggered_at` | timestamp | Yes | When alert triggered |
| `message` | string | No | Content sent (for history display) |
| `error_message` | string | No | Error details if status is FAILED |

**Enums**:
- `NotificationType`: `TOAST`, `SOUND`, `TELEGRAM`
- `DeliveryStatus`: `SENT`, `FAILED`, `PENDING`

**Relationships**:
- FK to `AlertTrigger`: Each AlertTrigger can have multiple NotificationDelivery records
- FK to `Alert`: Denormalized for efficient querying without JOIN
- FK to `User`: For multi-tenant isolation

### TelegramCredentials (Internal Storage Only)

Encrypted credentials stored in database (never logged, never exposed via API).

| Field | Type | Storage | Description |
|-------|------|---------|-------------|
| `token_ciphertext` | bytes | AES-256-GCM | Encrypted bot token |
| `token_nonce` | bytes | 12 bytes | GCM nonce for token |
| `chat_id_ciphertext` | bytes | AES-256-GCM | Encrypted chat ID |
| `chat_id_nonce` | bytes | 12 bytes | GCM nonce for chat ID |

**Note**: This is internal storage format. API uses `NotificationPreference` with encrypted strings.

## Relationships

```
User (existing)
    ├── NotificationPreference (1:1)
    │       └── AlertNotificationSettings (0:1 per Alert)
    ├── Alert (1:N)
    │       └── AlertTrigger (1:N)
    │               └── NotificationDelivery (1:N per trigger)
    └── AlertNotificationSettings (0:1 per Alert)

Alert (existing)
    └── AlertNotificationSettings (0:1) - Optional override
```

## Encryption Strategy

### AES-256-GCM Key Management

**Key Source**: `TELEGRAM_ENCRYPTION_KEY` environment variable (32-byte key)

**Key Rotation**:
- MVP: No automatic rotation (manual key change required)
- If key changes: Old encrypted tokens become unrecoverable (users must re-enter credentials)

**Encryption Format**:
```
ciphertext = AES-256-GCM-Encrypt(plaintext, key, nonce)
stored = base64(nonce || ciphertext)
```

**Decryption**:
```
decrypted = AES-256-GCM-Decrypt(base64_decode(stored), key)
```

**Implementation** (`backend/app/core/encryption.py`):
```python
def encrypt(plaintext: str) -> str: ...
def decrypt(encrypted: str) -> str: ...
```

## Telegram Message Format

Telegram notifications use Markdown formatting:

```json
{
  "chat_id": "encrypted_chat_id",
  "text": "🔔 *Alert Triggered*\n\n*AAPL* - Price above $150.00\nCurrent: $151.23\n\n_Time: 2025-12-31 10:30:00 UTC_",
  "parse_mode": "Markdown"
}
```

## Storage Strategy

| Data | Storage | Reason |
|------|---------|--------|
| NotificationPreference | PostgreSQL | User preferences persistence |
| AlertNotificationSettings | PostgreSQL | Per-alert overrides |
| NotificationDelivery | PostgreSQL | History with AlertTrigger FK |
| TelegramCredentials | PostgreSQL (encrypted) | Security requirement |
| Guest preferences | localStorage | Offline/temporary access |

## Migration

**Database Changes Required**:
1. Create `notification_preferences` table (one-to-one with users)
2. Create `alert_notification_settings` table (one-to-zero/one with alerts)
3. Create `notification_deliveries` table with FK to `alert_triggers`
4. Add columns to existing tables for notification overrides

**No changes to existing Alert/AlertTrigger tables required** (using denormalized alert_id in NotificationDelivery for query efficiency).
