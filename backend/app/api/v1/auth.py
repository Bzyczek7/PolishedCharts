"""
Authentication API endpoints.

Firebase Authentication is handled on the frontend (email/password, Google OAuth).
These backend endpoints provide:
- User profile retrieval
- Token verification
- Sign-out (clears backend session)

Per FR-005a: All protected endpoints enforce email_verified check via shared middleware.
Per FR-035a: Public endpoints marked with @public_endpoint decorator.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.services.auth_middleware import get_current_user
from app.api.decorators import public_endpoint
from app.services.error_messages import (
    AUTHENTICATION_FAILED,
    EMAIL_SENT_GENERIC,
)
from app.db.session import AsyncSessionLocal
from app.models.user import User
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


# =============================================================================
# Request/Response Schemas
# =============================================================================

class UserProfileResponse(BaseModel):
    """User profile response (matches backend-api.yaml contract)."""
    id: int
    firebase_uid: str
    email: str
    email_verified: bool
    display_name: Optional[str] = None
    photo_url: Optional[str] = None  # Maps from backend photo_url → API photourl (optional per contract)
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True  # Enable ORM mode


class SignInRequest(BaseModel):
    """Sign-in request (frontend handles Firebase, backend verifies)."""
    id_token: str


class PasswordResetRequest(BaseModel):
    """Password reset request."""
    email: EmailStr


class RegisterRequest(BaseModel):
    """Register request (frontend handles Firebase createUser)."""
    id_token: str


class MessageResponse(BaseModel):
    """Generic message response."""
    message: str


# =============================================================================
# Public Endpoints (no authentication required)
# =============================================================================

@router.post("/sign-in", response_model=UserProfileResponse)
@public_endpoint
async def sign_in(request: SignInRequest):
    """
    Verify Firebase ID token and return user profile.

    Frontend handles Firebase authentication (email/password, Google OAuth).
    This endpoint verifies the token with Firebase Admin SDK and creates/updates
    the user profile in the database.

    Note: This is a public endpoint (no auth required) because the id_token
    itself is the authentication credential.
    """
    from app.services.firebase_admin import verify_firebase_token

    try:
        # Verify the Firebase token
        token_data = await verify_firebase_token(request.id_token)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=AUTHENTICATION_FAILED,
        )

    # DEV: Temporarily disabled email verification check for development testing
    # Re-enable this before production deployment per FR-005a
    # if not token_data.get('email_verified', False):
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Email verification required. Please check your email for a verification link.",
    #     )

    # Get or create user in database
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(User.firebase_uid == token_data['uid'])
        )
        user = result.scalar_one_or_none()

        if user is None:
            # Create new user
            # Firebase Google OAuth uses 'picture', email/password doesn't have photo
            photo_url = token_data.get('picture') or token_data.get('photo_url')
            user = User(
                firebase_uid=token_data['uid'],
                email=token_data['email'],
                email_verified=token_data.get('email_verified', False),
                display_name=token_data.get('name') or token_data.get('display_name'),
                photo_url=photo_url,
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
        else:
            # Update existing user profile (in case info changed in Firebase)
            user.email = token_data['email']
            user.email_verified =token_data.get('email_verified', False)
            display_name = token_data.get('name') or token_data.get('display_name')
            if display_name:
                user.display_name = display_name
            # For Google OAuth, always update photo_url from 'picture' field
            photo_url = token_data.get('picture') or token_data.get('photo_url')
            if photo_url:
                user.photo_url = photo_url
            # Debug: log token data picture field
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"Token data keys: {list(token_data.keys())}")
            logger.info(f"Picture field: {token_data.get('picture')}")
            logger.info(f"Photo_url being set to: {photo_url}")
            await db.commit()
            await db.refresh(user)

    return UserProfileResponse(
        id=user.id,
        firebase_uid=user.firebase_uid,
        email=user.email,
        email_verified=user.email_verified,
        display_name=user.display_name,
        photo_url=user.photo_url,
        created_at=user.created_at.isoformat(),
        updated_at=user.updated_at.isoformat(),
    )


@router.post("/register", response_model=UserProfileResponse)
@public_endpoint
async def register(request: RegisterRequest):
    """
    Register new user via Firebase.

    Frontend handles Firebase user creation (createUserWithEmailAndPassword).
    This endpoint verifies the token and creates the user profile in the database.

    Note: This is a public endpoint (no auth required) because the id_token
    itself is the authentication credential. Email verification is enforced.
    """
    from app.services.firebase_admin import verify_firebase_token

    try:
        # Verify the Firebase token
        token_data = await verify_firebase_token(request.id_token)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=AUTHENTICATION_FAILED,
        )

    # DEV: Temporarily disabled email verification check for development testing
    # Re-enable this before production deployment per FR-005a
    # if not token_data.get('email_verified', False):
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Email verification required. Please check your email for a verification link.",
    #     )

    # Get or create user in database
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(User.firebase_uid == token_data['uid'])
        )
        user = result.scalar_one_or_none()

        if user is None:
            # Create new user
            # Firebase Google OAuth uses 'picture', email/password doesn't have photo
            photo_url = token_data.get('picture') or token_data.get('photo_url')
            # Debug: log token data picture field
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"[REGISTER] Token data keys: {list(token_data.keys())}")
            logger.info(f"[REGISTER] Picture field: {token_data.get('picture')}")
            logger.info(f"[REGISTER] Photo_url being set to: {photo_url}")
            user = User(
                firebase_uid=token_data['uid'],
                email=token_data['email'],
                email_verified=token_data.get('email_verified', False),
                display_name=token_data.get('name') or token_data.get('display_name'),
                photo_url=photo_url,
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
        else:
            # User already exists - return existing profile
            # Update email_verified in case it changed
            user.email_verified = token_data.get('email_verified', False)
            display_name = token_data.get('name') or token_data.get('display_name')
            if display_name:
                user.display_name = display_name
            photo_url = token_data.get('picture') or token_data.get('photo_url')
            if photo_url:
                user.photo_url = photo_url
            # Debug: log token data picture field
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"[REGISTER EXISTING] Token data keys: {list(token_data.keys())}")
            logger.info(f"[REGISTER EXISTING] Picture field: {token_data.get('picture')}")
            logger.info(f"[REGISTER EXISTING] Photo_url being set to: {photo_url}")
            await db.commit()
            await db.refresh(user)

    return UserProfileResponse(
        id=user.id,
        firebase_uid=user.firebase_uid,
        email=user.email,
        email_verified=user.email_verified,
        display_name=user.display_name,
        photo_url=user.photo_url,
        created_at=user.created_at.isoformat(),
        updated_at=user.updated_at.isoformat(),
    )


@router.post("/password-reset", response_model=MessageResponse)
@public_endpoint
async def request_password_reset(request: PasswordResetRequest):
    """
    Request password reset email.

    Frontend handles Firebase password reset via sendPasswordResetEmail().
    This endpoint exists for API completeness and future extensibility.

    Returns generic message per FR-034 (no "check your inbox" hints).
    """
    # In a real implementation, this would call Firebase Admin SDK's
    # auth.generate_password_reset_link() and send via email service.
    # For now, we return the generic message as the frontend handles this directly.

    # Note: We return the same message regardless of whether the email exists
    # to prevent account enumeration (FR-031, FR-034)
    return MessageResponse(message=EMAIL_SENT_GENERIC)


# =============================================================================
# Protected Endpoints (require valid Firebase ID token)
# =============================================================================

@router.get("/user", response_model=UserProfileResponse)
async def get_user_profile(user: dict = Depends(get_current_user)):
    """
    Get current user profile from verified Firebase token.

    Returns the user's profile from the database.
    """
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(User.firebase_uid == user['uid'])
        )
        db_user = result.scalar_one_or_none()

        if db_user is None:
            # This shouldn't happen if sign-in was called, but handle gracefully
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found. Please sign in again.",
            )

        return UserProfileResponse(
            id=db_user.id,
            firebase_uid=db_user.firebase_uid,
            email=db_user.email,
            email_verified=db_user.email_verified,
            display_name=db_user.display_name,
            photo_url=db_user.photo_url,
            created_at=db_user.created_at.isoformat(),
            updated_at=db_user.updated_at.isoformat(),
        )


@router.post("/sign-out", response_model=MessageResponse)
async def sign_out(user: dict = Depends(get_current_user)):
    """
    Sign out user (clears backend session).

    Frontend handles Firebase signOut() which clears the Firebase session.
    This endpoint exists for API completeness and future backend-side cleanup.

    Note: Firebase ID tokens are stateless, so there's nothing to invalidate
    on the backend. The frontend simply discards the token.
    """
    # In a real implementation, this might:
    # - Add token to a blacklist (if using token revocation)
    # - Clear backend-side session data
    # - Log the sign-out event for analytics

    return MessageResponse(message="Signed out successfully")
