from datetime import datetime, timedelta, timezone
from typing import Optional
import secrets
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from pydantic import EmailStr
from app.core.config import settings

# Email configuration
conf = ConnectionConfig(
    MAIL_USERNAME=settings.MAIL_USERNAME,
    MAIL_PASSWORD=settings.MAIL_PASSWORD,
    MAIL_FROM=settings.MAIL_FROM,
    MAIL_PORT=settings.MAIL_PORT,
    MAIL_SERVER=settings.MAIL_SERVER,
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True
)

# Initialize FastMail
fastmail = FastMail(conf)

def generate_verification_token() -> tuple[str, datetime]:
    """Generate a random token and its expiration time"""
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(hours=24)  # Token expires in 24 hours
    return token, expires

async def send_verification_email(email: EmailStr, token: str) -> None:
    """Send verification email to user"""
    verification_url = f"{settings.SERVER_HOST}/api/v1/users/verify/{token}"
    
    message = MessageSchema(
        subject="Verify your email",
        recipients=[email],
        body=f"""
        <html>
            <body>
                <p>Hi there,</p>
                <p>Thank you for registering! Please click the link below to verify your email address:</p>
                <p><a href="{verification_url}">{verification_url}</a></p>
                <p>This link will expire in 24 hours.</p>
                <p>If you didn't register for an account, you can safely ignore this email.</p>
            </body>
        </html>
        """,
        subtype="html"
    )
    
    await fastmail.send_message(message)

async def send_password_reset_email(email: EmailStr, reset_url: str) -> None:
    """Send password reset email to user"""
    message = MessageSchema(
        subject="Reset your password",
        recipients=[email],
        body=f"""
        <html>
            <body>
                <p>Hi there,</p>
                <p>We received a request to reset your password. Click the link below to set a new password:</p>
                <p><a href="{reset_url}">{reset_url}</a></p>
                <p>This link will expire in 24 hours.</p>
                <p>If you didn't request a password reset, you can safely ignore this email.</p>
            </body>
        </html>
        """,
        subtype="html"
    )
    
    await fastmail.send_message(message) 