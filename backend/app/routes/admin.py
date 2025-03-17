from typing import Any, List
from datetime import datetime, timedelta
import pytz
import random
import string
import secrets
from enum import Enum

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app import crud
from app.api import deps
from app.schemas.user import User, UserUpdate, PaginatedUsers, UserCreate
from app.database.models import User as UserModel

router = APIRouter(prefix="/admin", tags=["admin"])


class ParseDuration(str, Enum):
    ONE_HOUR = "1_hour"
    ONE_DAY = "1_day"
    FIVE_DAYS = "5_days"
    TWENTY_DAYS = "20_days"


class ParsePermissionUpdate(BaseModel):
    can_parse: bool
    duration: ParseDuration | None = None


def get_current_admin_user(
    current_user: UserModel = Depends(deps.get_current_user),
) -> UserModel:
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403,
            detail="The user doesn't have enough privileges"
        )
    return current_user


class ClientAccountResponse(BaseModel):
    username: str
    password: str


def generate_random_username(length: int = 8) -> str:
    """Generate a random username with a prefix."""
    prefix = "client"
    random_part = ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))
    return f"{prefix}_{random_part}"


def generate_strong_password(length: int = 12) -> str:
    """Generate a strong random password."""
    alphabet = string.ascii_letters + string.digits + string.punctuation
    while True:
        password = ''.join(secrets.choice(alphabet) for _ in range(length))
        if (any(c.islower() for c in password)
                and any(c.isupper() for c in password)
                and any(c.isdigit() for c in password)
                and any(c in string.punctuation for c in password)):
            return password


def calculate_expiry_date(duration: ParseDuration) -> datetime | None:
    if not duration:
        return None
    
    now = datetime.now(pytz.UTC)
    if duration == ParseDuration.ONE_HOUR:
        return now + timedelta(hours=1)
    elif duration == ParseDuration.ONE_DAY:
        return now + timedelta(days=1)
    elif duration == ParseDuration.FIVE_DAYS:
        return now + timedelta(days=5)
    elif duration == ParseDuration.TWENTY_DAYS:
        return now + timedelta(days=20)
    return None


@router.post("/users/create-client", response_model=ClientAccountResponse)
def create_client_account(
    db: Session = Depends(deps.get_db),
    current_user: UserModel = Depends(get_current_admin_user),
) -> Any:
    """
    Create a new client account with random username and password.
    Only accessible by admin users.
    """
    # Generate random username and password
    while True:
        username = generate_random_username()
        if not crud.user.get_by_username(db, username=username):
            break

    password = generate_strong_password()
    email = f"{username}@example.com"  # Using example.com as it's a valid domain for testing

    # Create user
    user_in = UserCreate(
        email=email,
        username=username,
        password=password,
        is_active=True,
        is_superuser=False,
        can_parse=True  # Give parsing permission by default
    )

    try:
        crud.user.create(db, obj_in=user_in)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create client account: {str(e)}"
        )

    return ClientAccountResponse(username=username, password=password)


@router.get("/users", response_model=PaginatedUsers)
def get_users(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 10,
    search: str = None,
    current_user: UserModel = Depends(get_current_admin_user),
) -> Any:
    """
    Retrieve users ordered by registration time (newest first). 
    Supports searching by username or email.
    Returns paginated results with total count.
    Only accessible by admin users.
    """
    query = db.query(UserModel)
    
    if search:
        search = f"%{search}%"
        query = query.filter(
            (UserModel.username.ilike(search)) |
            (UserModel.email.ilike(search))
        )
    
    total = query.count()
    users = query.order_by(UserModel.created_at.desc()).offset(skip).limit(limit).all()
    
    return PaginatedUsers(data=users, total=total)


@router.patch("/users/{user_id}/permissions", response_model=User)
def update_user_permissions(
    user_id: int,
    user_in: UserUpdate,
    db: Session = Depends(deps.get_db),
    current_user: UserModel = Depends(get_current_admin_user),
) -> Any:
    """
    Update user permissions. Only accessible by admin users.
    """
    user = crud.user.get_by_id(db, user_id=user_id)
    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )
    user = crud.user.update(db, db_obj=user, obj_in=user_in)
    return user


@router.patch("/users/{user_id}/toggle-parse-permission", response_model=User)
def toggle_parse_permission(
    user_id: int,
    permission_update: ParsePermissionUpdate,
    db: Session = Depends(deps.get_db),
    current_user: UserModel = Depends(get_current_admin_user),
) -> Any:
    """
    Update user's parse permission with specified duration.
    Only accessible by admin users.
    """
    user = crud.user.get_by_id(db, user_id=user_id)
    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )
    
    expiry_date = calculate_expiry_date(permission_update.duration) if permission_update.can_parse else None
    
    user_in = UserUpdate(
        can_parse=permission_update.can_parse,
        parse_permission_expires=expiry_date
    )
    user = crud.user.update(db, db_obj=user, obj_in=user_in)
    return user


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(deps.get_db),
    current_user: UserModel = Depends(get_current_admin_user),
) -> Any:
    """
    Delete a user. Only accessible by admin users.
    """
    user = crud.user.get_by_id(db, user_id=user_id)
    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )
    if user.is_superuser:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete superuser accounts"
        )
    if user.id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete your own account"
        )
    crud.user.remove(db, id=user_id)
    return {"message": "User deleted successfully"} 