from typing import Any, List
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Body, Depends, HTTPException, BackgroundTasks
from fastapi.encoders import jsonable_encoder
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import EmailStr, BaseModel
from sqlalchemy.orm import Session

from app import crud
from app.api import deps
from app.database.models import User
from app.schemas.user import User as UserSchema
from app.schemas.user import UserCreate, UserUpdate
from app.core.email import generate_verification_token, send_verification_email, send_password_reset_email
from app.core.config import settings
from app.core.security import get_password_hash

router = APIRouter()


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordReset(BaseModel):
    token: str
    new_password: str


@router.get("/", response_model=List[UserSchema])
def read_users(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Retrieve users.
    """
    users = db.query(User).offset(skip).limit(limit).all()
    return users


@router.post("/", response_model=UserSchema)
async def create_user(
    *,
    db: Session = Depends(deps.get_db),
    user_in: UserCreate,
    background_tasks: BackgroundTasks,
) -> Any:
    """
    Create new user with email verification.
    """
    # Check existing email
    user = crud.user.get_by_email(db, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system.",
        )
    
    # Check existing username
    user = crud.user.get_by_username(db, username=user_in.username)
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this username already exists in the system.",
        )
    
    # Generate verification token
    token, expires = generate_verification_token()
    
    # Create user with verification token
    user_in_db = jsonable_encoder(user_in)
    user_in_db["verification_token"] = token
    user_in_db["verification_token_expires"] = expires
    user_in_db["is_active"] = False  # User starts inactive until email is verified
    user = crud.user.create(db, obj_in=user_in_db)
    
    # Send verification email in background
    background_tasks.add_task(send_verification_email, user.email, token)
    
    return user


@router.put("/me", response_model=UserSchema)
def update_user_me(
    *,
    db: Session = Depends(deps.get_db),
    password: str = Body(None),
    email: EmailStr = Body(None),
    username: str = Body(None),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Update own user.
    """
    current_user_data = jsonable_encoder(current_user)
    user_in = UserUpdate(**current_user_data)
    if password is not None:
        user_in.password = password
    if email is not None:
        user_in.email = email
    if username is not None:
        user_in.username = username
    user = crud.user.update(db, db_obj=current_user, obj_in=user_in)
    return user


@router.get("/me", response_model=UserSchema)
def read_user_me(
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get current user.
    """
    return current_user


@router.get("/{user_id}", response_model=UserSchema)
def read_user_by_id(
    user_id: int,
    current_user: User = Depends(deps.get_current_active_user),
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Get a specific user by id.
    """
    user = crud.user.get_by_id(db, user_id=user_id)
    if user == current_user:
        return user
    if not crud.user.is_superuser(current_user):
        raise HTTPException(
            status_code=400, detail="The user doesn't have enough privileges"
        )
    return user


@router.get("/verify/{token}")
async def verify_email(
    token: str,
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Verify user email with token and redirect to login page.
    Also grants 1-hour parsing permission upon verification.
    """
    user = crud.user.get_by_verification_token(db, token=token)
    if not user:
        raise HTTPException(
            status_code=400,
            detail="Invalid verification token",
        )
    
    # Check if token is expired
    if user.verification_token_expires < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=400,
            detail="Verification token has expired",
        )
    
    # Calculate parse permission expiry (1 hour from now)
    parse_permission_expires = datetime.now(timezone.utc) + timedelta(hours=1)
    
    # Verify user and grant parse permission
    user_update = UserUpdate(
        is_active=True,
        email_verified=True,
        verification_token=None,
        verification_token_expires=None,
        can_parse=True,
        parse_permission_expires=parse_permission_expires
    )
    user = crud.user.update(db, db_obj=user, obj_in=user_update)
    
    # Redirect to frontend login page with success message
    frontend_login_url = f"{settings.FRONTEND_URL}/login?verified=true"
    return RedirectResponse(url=frontend_login_url)


@router.post("/forgot-password")
async def forgot_password(
    request: PasswordResetRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Send password reset email to user.
    """
    print(f"Received password reset request for email: {request.email}")  # Debug log
    
    user = crud.user.get_by_email(db, email=request.email)
    if not user:
        print("No user found with the provided email")  # Debug log
        # Return success even if email doesn't exist to prevent email enumeration
        return {"message": "If the email exists, a password reset link will be sent."}

    # Generate reset token
    token, expires = generate_verification_token()  # Reusing verification token function
    print(f"Generated reset token: {token}, expires: {expires}")  # Debug log
    
    # Update user with reset token
    user_update = UserUpdate(
        password_reset_token=token,
        password_reset_expires=expires
    )
    updated_user = crud.user.update(db, db_obj=user, obj_in=user_update)
    print(f"Updated user with reset token. Token in DB: {updated_user.password_reset_token}")  # Debug log
    
    # Send reset email in background
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    print(f"Reset URL: {reset_url}")  # Debug log
    background_tasks.add_task(
        send_password_reset_email,
        email=user.email,
        reset_url=reset_url
    )
    
    return {"message": "If the email exists, a password reset link will be sent."}


@router.post("/reset-password")
async def reset_password(
    reset_data: PasswordReset,
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Reset user password using reset token.
    """
    print(f"Received reset request with token: {reset_data.token}")  # Debug log
    
    user = crud.user.get_by_reset_token(db, token=reset_data.token)
    if not user:
        print("No user found with the provided reset token")  # Debug log
        raise HTTPException(
            status_code=400,
            detail="Invalid reset token",
        )
    
    # Check if token is expired
    current_time = datetime.now(timezone.utc)
    if user.password_reset_expires < current_time:
        print(f"Token expired at {user.password_reset_expires}, current time: {current_time}")  # Debug log
        raise HTTPException(
            status_code=400,
            detail="Reset token has expired",
        )
    
    try:
        # Update password directly
        user.hashed_password = get_password_hash(reset_data.new_password)
        # Clear reset token
        user.password_reset_token = None
        user.password_reset_expires = None
        
        # Save changes
        db.add(user)
        db.commit()
        db.refresh(user)
        
        print(f"Successfully updated password for user: {user.email}")  # Debug log
        return {"message": "Password has been reset successfully"}
    except Exception as e:
        print(f"Error updating password: {str(e)}")  # Debug log
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to update password"
        ) 