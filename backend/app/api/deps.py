from typing import Generator
from datetime import datetime
import pytz

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app import crud
from app.core.config import settings
from app.database.database import SessionLocal
from app.database.models import User, TelegramSession
from app.schemas.token import TokenPayload

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/login/access-token"
)


def get_db() -> Generator:
    try:
        db = SessionLocal()
        yield db
    finally:
        db.close()


def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(reusable_oauth2)
) -> User:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
    except (jwt.JWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    user = crud.user.get_by_id(db, user_id=token_data.sub)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update last visit time with timezone-aware datetime
    user.last_visit = datetime.now(pytz.UTC)
    db.commit()
    
    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not crud.user.is_active(current_user):
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


def get_current_active_superuser(
    current_user: User = Depends(get_current_user),
) -> User:
    if not crud.user.is_superuser(current_user):
        raise HTTPException(
            status_code=400, detail="The user doesn't have enough privileges"
        )
    return current_user


def get_current_user_with_parse_permission(
    current_user: User = Depends(get_current_active_user),
) -> User:
    # Check if user is superuser (they always have parse permission)
    if current_user.is_superuser:
        return current_user
        
    # Check if user has parse permission enabled
    if not current_user.can_parse:
        raise HTTPException(
            status_code=403,
            detail="You need to purchase a subscription to parse channels"
        )
    
    # Check if parse permission has expired
    if current_user.parse_permission_expires and current_user.parse_permission_expires < datetime.now(pytz.UTC):
        raise HTTPException(
            status_code=403,
            detail="Your parsing subscription has expired. Please purchase a new subscription to continue parsing"
        )
        
    return current_user


def get_current_user_with_group_parse_permission(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> User:
    """
    Verify the user has permission to parse groups.
    
    In demo mode (user is active but doesn't have can_parse), 
    they are still allowed to parse groups but not channels.
    """
    # Check if user is superuser (they always have parse permission)
    if current_user.is_superuser:
        return current_user
        
    # In demo mode, active users can parse groups even without can_parse permission
    if current_user.is_active:
        # For demo mode users (active but without can_parse), 
        # verify they have an active Telegram session
        if not current_user.can_parse:
            # Only check for session if this is a group parse operation
            active_session = db.query(TelegramSession).filter(
                TelegramSession.user_id == current_user.id,
                TelegramSession.is_active == True,
                TelegramSession.session_string.isnot(None)
            ).first()
            
            if not active_session:
                raise HTTPException(
                    status_code=400,
                    detail="You need an active Telegram session to parse groups. Please go to the Sessions page and add a session."
                )
        
        return current_user
    
    # For non-active users, additional checks would apply
    # But since we already checked is_active in get_current_active_user, 
    # we should never reach this point
    
    raise HTTPException(
        status_code=403,
        detail="You don't have permission to parse groups"
    ) 