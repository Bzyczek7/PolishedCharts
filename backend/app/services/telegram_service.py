"""
Telegram Bot Service

Provides functions for:
- Validating Telegram credentials by testing Bot API connectivity
- Sending messages to Telegram chats
- Handling Telegram API errors

Usage:
    from app.services.telegram_service import (
        validate_telegram_credentials,
        send_telegram_message,
        TelegramError,
    )

    # Validate credentials
    is_valid, bot_username, error = await validate_telegram_credentials(token, chat_id)

    # Send a message
    message_id = await send_telegram_message(token, chat_id, "Hello!")
"""

import logging
from typing import Optional, Tuple

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class TelegramError(Exception):
    """Exception raised when Telegram API operations fail."""

    def __init__(self, message: str, error_code: Optional[int] = None):
        super().__init__(message)
        self.error_code = error_code
        self.message = message


async def validate_telegram_credentials(
    token: str,
    chat_id: str,
) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Validate Telegram bot token and chat ID.

    Tests connectivity to Telegram Bot API by fetching bot info.

    Args:
        token: Telegram bot token (format: 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11)
        chat_id: Telegram chat ID (numeric string or @channel_username)

    Returns:
        Tuple of (is_valid, bot_username, error_message)
        - is_valid: True if credentials are valid
        - bot_username: Bot's username if valid
        - error_message: Error description if not valid
    """
    try:
        # Test getMe endpoint to verify token
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"https://api.telegram.org/bot{token}/getMe"
            )
            data = response.json()

            if not data.get("ok"):
                error_desc = data.get("description", "Unknown error")
                logger.warning(f"Telegram validation failed: {error_desc}")
                return False, None, error_desc

            bot_info = data.get("result", {})
            bot_username = bot_info.get("username")
            logger.info(f"Telegram bot validated: @{bot_username}")
            return True, bot_username, None

    except httpx.TimeoutException:
        error = "Telegram API request timed out"
        logger.warning(f"Telegram validation timeout: {token[:10]}...")
        return False, None, error

    except httpx.RequestError as e:
        error = f"Network error: {str(e)}"
        logger.warning(f"Telegram validation network error: {e}")
        return False, None, error

    except Exception as e:
        error = f"Unexpected error: {str(e)}"
        logger.error(f"Telegram validation error: {e}")
        return False, None, error


async def send_telegram_message(
    token: str,
    chat_id: str,
    text: str,
    parse_mode: str = "HTML",
) -> int:
    """
    Send a message to a Telegram chat.

    Args:
        token: Telegram bot token
        chat_id: Telegram chat ID (numeric string or @channel_username)
        text: Message text (supports HTML formatting)
        parse_mode: Message formatting mode (HTML or Markdown)

    Returns:
        Message ID of the sent message

    Raises:
        TelegramError: If the message fails to send
    """
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                json={
                    "chat_id": chat_id,
                    "text": text,
                    "parse_mode": parse_mode,
                    "disable_web_page_preview": True,
                },
            )
            data = response.json()

            if not data.get("ok"):
                error_desc = data.get("description", "Unknown error")
                error_code = data.get("error_code")
                logger.warning(
                    f"Telegram send failed: {error_desc} (code: {error_code})"
                )
                raise TelegramError(error_desc, error_code)

            message_id = data.get("result", {}).get("message_id")
            logger.debug(
                f"Telegram message sent to {chat_id}: message_id={message_id}"
            )
            return message_id

    except httpx.TimeoutException:
        error = "Telegram API request timed out"
        logger.warning(f"Telegram send timeout: chat={chat_id}")
        raise TelegramError(error)

    except httpx.RequestError as e:
        error = f"Network error: {str(e)}"
        logger.warning(f"Telegram send network error: {e}")
        raise TelegramError(error)

    except TelegramError:
        # Re-raise TelegramError as-is
        raise

    except Exception as e:
        error = f"Unexpected error: {str(e)}"
        logger.error(f"Telegram send error: {e}")
        raise TelegramError(error)


async def send_telegram_photo(
    token: str,
    chat_id: str,
    photo_url: str,
    caption: Optional[str] = None,
) -> int:
    """
    Send a photo to a Telegram chat.

    Args:
        token: Telegram bot token
        chat_id: Telegram chat ID
        photo_url: URL or file_id of the photo
        caption: Optional photo caption

    Returns:
        Message ID of the sent photo

    Raises:
        TelegramError: If the photo fails to send
    """
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            payload = {
                "chat_id": chat_id,
                "photo": photo_url,
            }
            if caption:
                payload["caption"] = caption
                payload["parse_mode"] = "HTML"

            response = await client.post(
                f"https://api.telegram.org/bot{token}/sendPhoto",
                json=payload,
            )
            data = response.json()

            if not data.get("ok"):
                error_desc = data.get("description", "Unknown error")
                error_code = data.get("error_code")
                logger.warning(
                    f"Telegram photo send failed: {error_desc} (code: {error_code})"
                )
                raise TelegramError(error_desc, error_code)

            message_id = data.get("result", {}).get("message_id")
            return message_id

    except httpx.TimeoutException:
        raise TelegramError("Telegram API request timed out")

    except httpx.RequestError as e:
        raise TelegramError(f"Network error: {str(e)}")

    except Exception as e:
        raise TelegramError(f"Unexpected error: {str(e)}")


async def delete_telegram_message(
    token: str,
    chat_id: str,
    message_id: int,
) -> bool:
    """
    Delete a message from a Telegram chat.

    Args:
        token: Telegram bot token
        chat_id: Telegram chat ID
        message_id: ID of the message to delete

    Returns:
        True if the message was deleted successfully

    Raises:
        TelegramError: If the deletion fails
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"https://api.telegram.org/bot{token}/deleteMessage",
                json={
                    "chat_id": chat_id,
                    "message_id": message_id,
                },
            )
            data = response.json()

            if not data.get("ok"):
                error_desc = data.get("description", "Unknown error")
                logger.warning(f"Telegram delete failed: {error_desc}")
                raise TelegramError(error_desc)

            return True

    except Exception as e:
        raise TelegramError(f"Failed to delete message: {str(e)}")
