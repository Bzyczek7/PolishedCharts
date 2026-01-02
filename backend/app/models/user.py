"""User model for Firebase authentication.

This model stores Firebase-authenticated user profiles and links to user-specific entities.
The actual authentication is handled by Firebase, this table stores profile data synced from Firebase.
"""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from app.db.base_class import Base


class User(Base):
    """Firebase-authenticated user profile.

    Attributes:
        id: Internal database primary key
        firebase_uid: Firebase user ID (from token's uid claim), unique identifier
        email: User's email address (from token's email claim), unique
        email_verified: Mirror of Firebase's email_verified claim, for backend queries
        display_name: User's display name (from Google OAuth or custom)
        photo_url: Profile photo URL (from Google OAuth)
        created_at: Account creation timestamp
        updated_at: Last profile update timestamp

    Validation Rules:
        firebase_uid must match Firebase token's uid claim
        email must match Firebase token's email claim
        email_verified must match Firebase token's email_verified claim (dual enforcement)
    """
    __tablename__ = "users"  # Override default to use plural form

    id = Column(Integer, primary_key=True, index=True)
    firebase_uid = Column(String(128), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    email_verified = Column(Boolean, nullable=False, default=False)
    display_name = Column(String(255), nullable=True)
    photo_url = Column(String, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    # Relationships to user-specific entities
    alerts = relationship("Alert", back_populates="user", cascade="all, delete-orphan")
    user_watchlists = relationship("UserWatchlist", back_populates="user", cascade="all, delete-orphan")
    layouts = relationship("Layout", back_populates="user", cascade="all, delete-orphan")
    notification_preference = relationship("NotificationPreference", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email}, firebase_uid={self.firebase_uid})>"
