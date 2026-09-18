"""Authentication service – register, login, and user lookup."""

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.utils.security import hash_password, verify_password, create_access_token
import secrets
from app.services.email_service import send_verification_email, send_password_reset_email


async def register_user(
    email: str, password: str, name: str, db: AsyncSession
) -> dict:
    """Register a new user. Returns dict with access_token, token_type, and user."""
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == email))
    existing = result.scalars().first()
    
    token = secrets.token_urlsafe(32)

    if existing:
        if existing.is_verified:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )
        else:
            # User exists but not verified. Update password/token and resend email
            existing.hashed_password = hash_password(password)
            existing.name = name
            existing.verification_token = token
            await db.flush()
            await db.refresh(existing)
            await send_verification_email(email, token)
            return {
                "message": "Registration updated. Please check your email (or terminal) to verify your account.",
                "user": {
                    "id": existing.id,
                    "email": existing.email,
                    "name": existing.name,
                    "created_at": existing.created_at,
                },
            }

    user = User(
        email=email,
        hashed_password=hash_password(password),
        name=name,
        verification_token=token,
        is_verified=False
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    # Trigger mock email
    await send_verification_email(email, token)

    return {
        "message": "Registration successful. Please check your email to verify your account.",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "created_at": user.created_at,
        },
    }


async def authenticate_user(
    email: str, password: str, db: AsyncSession
) -> dict | None:
    """Authenticate user by email and password. Returns dict with access_token or None."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    
    if not user:
        return None

    # Check if currently locked out
    from datetime import datetime, timedelta
    if user.lockout_until and user.lockout_until > datetime.utcnow():
        minutes_left = int((user.lockout_until - datetime.utcnow()).total_seconds() / 60) + 1
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is temporarily locked due to multiple failed login attempts. Please try again in {minutes_left} minutes."
        )

    if not verify_password(password, user.hashed_password):
        # Increment failed attempts
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= 5:
            user.lockout_until = datetime.utcnow() + timedelta(minutes=15)
            user.failed_login_attempts = 0
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account has been locked for 15 minutes due to 5 failed login attempts."
            )
        await db.commit()
        return None

    # Reset attempts on correct password (even if not verified)
    user.failed_login_attempts = 0
    user.lockout_until = None
    await db.commit()
        
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please check your email or terminal logs for the verification link."
        )

    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}


async def get_user_by_id(user_id: int, db: AsyncSession) -> User | None:
    """Get a user by their ID."""
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalars().first()

async def generate_password_reset_token(email: str, db: AsyncSession) -> dict:
    """Generate a password reset token and send an email."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    
    # Generic success message to prevent user enumeration
    success_response = {
        "message": "If that email is registered, a password reset link has been sent."
    }
    
    if not user:
        # Silently return success if user does not exist
        return success_response

    from datetime import datetime, timedelta
    token = secrets.token_urlsafe(32)
    user.reset_password_token = token
    user.reset_password_expires_at = datetime.utcnow() + timedelta(minutes=30)
    await db.flush()
    await db.refresh(user)

    await send_password_reset_email(email, token)

    return success_response

async def reset_password_with_token(token: str, new_password: str, db: AsyncSession) -> dict:
    """Reset the user's password using the token."""
    from datetime import datetime
    result = await db.execute(select(User).where(User.reset_password_token == token))
    user = result.scalars().first()

    if not user or not user.reset_password_expires_at or datetime.utcnow() > user.reset_password_expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token."
        )

    user.hashed_password = hash_password(new_password)
    user.reset_password_token = None
    user.reset_password_expires_at = None
    await db.flush()

    return {"message": "Password successfully reset. You can now log in."}
