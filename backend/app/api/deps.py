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
from app.database.models import User
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
    if not current_user.can_parse and not current_user.is_superuser:
        raise HTTPException(
            status_code=403,
            detail="User doesn't have permission to parse"
        )
    return current_user 