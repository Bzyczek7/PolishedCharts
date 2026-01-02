"""
AES-256-GCM Encryption Utilities for Telegram Credentials

This module provides encryption and decryption functions for securely storing
Telegram bot tokens and chat IDs using AES-256-GCM authenticated encryption.

Encryption Parameters (Authoritative):
- Algorithm: AES-256-GCM (NIST-approved authenticated encryption)
- Key Length: 256 bits (32 bytes) from TELEGRAM_ENCRYPTION_KEY env var
- Nonce Length: 96 bits (12 bytes) - GCM standard recommendation
- Tag Length: 128 bits (16 bytes) - Full GCM authentication tag
- Key Derivation: None (raw key) - MVP: key used directly, no KDF
- Nonce Generation: cryptographically random per encryption (never reused)
- Output Encoding: base64(nonce || ciphertext || tag)
- Decryption Input: base64 string - parse to recover nonce, ciphertext, tag

Usage:
    from app.core.encryption import encrypt, decrypt

    # Encrypt sensitive data
    encrypted = encrypt("my-secret-token")

    # Decrypt when needed (raises EncryptionError on failure)
    plaintext = decrypt(encrypted)

Failure Handling (FR-ENC Compliant):
- FR-ENC-001: Decryption failure = treat as "no Telegram configured"
- FR-ENC-002: No crashes, no user-facing error details
- FR-ENC-003: Log sanitized errors only (no ciphertext, nonce, or plaintext)
"""

import base64
import logging
import os
from dataclasses import dataclass
from typing import Optional

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

logger = logging.getLogger(__name__)

# Encryption parameters
NONCE_LENGTH = 12  # 96 bits, GCM standard
TAG_LENGTH = 16    # 128 bits, full GCM authentication tag
KEY_LENGTH = 32    # 256 bits, AES-256

# Environment variable name for encryption key
ENCRYPTION_KEY_ENV = "TELEGRAM_ENCRYPTION_KEY"


class EncryptionError(Exception):
    """Base exception for encryption/decryption failures.

    Per FR-ENC-001/002/003: These errors should be caught and handled
    gracefully without exposing details to users. Log only sanitized info.
    """
    pass


class DecryptionError(EncryptionError):
    """Raised when decryption fails (bad key, corrupted data, invalid format)."""
    pass


class MissingKeyError(EncryptionError):
    """Raised when encryption key is not configured."""
    pass


@dataclass(frozen=True)
class EncryptionResult:
    """Result of encryption operation."""
    ciphertext_b64: str  # base64(nonce || ciphertext || tag)


def _get_encryption_key() -> bytes:
    """
    Retrieve and validate the encryption key from environment.

    Returns:
        32-byte encryption key

    Raises:
        MissingKeyError: If key is not configured or wrong length
    """
    key_hex = os.environ.get(ENCRYPTION_KEY_ENV)
    if not key_hex:
        raise MissingKeyError(
            f"Encryption key not configured. Set {ENCRYPTION_KEY_ENV} environment variable "
            "(must be exactly 32 bytes / 64 hex characters)"
        )

    key_bytes = bytes.fromhex(key_hex)
    if len(key_bytes) != KEY_LENGTH:
        raise MissingKeyError(
            f"Invalid encryption key length: {len(key_bytes)} bytes, expected {KEY_LENGTH} bytes. "
            f"Generate with: python -c \"import os; print(os.urandom({KEY_LENGTH}).hex())\""
        )

    return key_bytes


def encrypt(plaintext: str) -> EncryptionResult:
    """
    Encrypt plaintext using AES-256-GCM.

    Args:
        plaintext: The text to encrypt (e.g., Telegram bot token or chat ID)

    Returns:
        EncryptionResult containing base64-encoded ciphertext

    Raises:
        MissingKeyError: If encryption key is not configured

    Security:
        - Generates unique 12-byte nonce for each encryption (never reused)
        - Authentication tag protects against tampering
        - Output format: base64(nonce || ciphertext || tag)
    """
    if not plaintext:
        raise ValueError("Cannot encrypt empty plaintext")

    key = _get_encryption_key()
    nonce = os.urandom(NONCE_LENGTH)

    aesgcm = AESGCM(key)
    ciphertext_with_tag = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)

    # Format: nonce || ciphertext || tag
    # ciphertext_with_tag = ciphertext (variable) + tag (16 bytes)
    combined = nonce + ciphertext_with_tag
    ciphertext_b64 = base64.b64encode(combined).decode("ascii")

    logger.info("Encrypted data successfully (nonce: random, tag: 16 bytes)")

    return EncryptionResult(ciphertext_b64=ciphertext_b64)


def decrypt(encrypted_b64: str) -> str:
    """
    Decrypt ciphertext that was encrypted with encrypt().

    Args:
        encrypted_b64: Base64-encoded string from encrypt()

    Returns:
        Decrypted plaintext

    Raises:
        DecryptionError: On decryption failure (bad key, corrupted data, invalid format)
        MissingKeyError: If encryption key is not configured

    Failure Handling (FR-ENC Compliant):
        - Logs sanitized error only (no ciphertext, nonce, or plaintext)
        - Does not crash the application
        - Caller should treat decryption failure as "no Telegram configured"
    """
    if not encrypted_b64:
        raise DecryptionError("Cannot decrypt empty input")

    try:
        key = _get_encryption_key()

        # Decode base64
        combined = base64.b64decode(encrypted_b64)

        if len(combined) < NONCE_LENGTH + TAG_LENGTH:
            raise DecryptionError(
                f"Invalid ciphertext length: {len(combined)} bytes, "
                f"minimum {NONCE_LENGTH + TAG_LENGTH} bytes"
            )

        # Split: first 12 bytes = nonce, last 16 bytes = tag, middle = ciphertext
        nonce = combined[:NONCE_LENGTH]
        ciphertext_with_tag = combined[NONCE_LENGTH:]

        # Verify tag length
        if len(ciphertext_with_tag) < TAG_LENGTH:
            raise DecryptionError(
                f"Invalid tag length: expected at least {TAG_LENGTH} bytes"
            )

        aesgcm = AESGCM(key)
        plaintext = aesgcm.decrypt(nonce, ciphertext_with_tag, None)

        logger.info("Decrypted data successfully")
        return plaintext.decode("utf-8")

    except base64.binascii.Error as e:
        logger.warning(f"Decryption failed: invalid base64 format")
        raise DecryptionError("Invalid ciphertext format") from e

    except Exception as e:
        # Cryptography library exceptions indicate decryption failure
        # Log sanitized message only - never log ciphertext or plaintext
        logger.warning(f"Decryption failed: {type(e).__name__}")
        raise DecryptionError(
            "Decryption failed - possible causes: wrong key, corrupted data, or invalid format"
        ) from e


def is_configured() -> bool:
    """
    Check if encryption key is configured.

    Returns:
        True if TELEGRAM_ENCRYPTION_KEY is set and valid
    """
    try:
        _get_encryption_key()
        return True
    except MissingKeyError:
        return False
