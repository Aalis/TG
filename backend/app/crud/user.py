from typing import Any, Dict, Optional, Union, List

from sqlalchemy.orm import Session

from app.core.security import get_password_hash, verify_password
from app.database.models import User
from app.schemas.user import UserCreate, UserUpdate


def get_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def get_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()


def get_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username).first()


def get_by_verification_token(db: Session, token: str) -> Optional[User]:
    return db.query(User).filter(User.verification_token == token).first()


def get_by_reset_token(db: Session, token: str) -> Optional[User]:
    return db.query(User).filter(User.password_reset_token == token).first()


def get_multi(db: Session, *, skip: int = 0, limit: int = 100) -> List[User]:
    return db.query(User).offset(skip).limit(limit).all()


def authenticate(db: Session, *, username: str, password: str) -> Optional[User]:
    user = get_by_username(db, username=username)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def create(db: Session, *, obj_in: Union[UserCreate, Dict[str, Any]]) -> User:
    if isinstance(obj_in, dict):
        create_data = obj_in
    else:
        create_data = obj_in.dict(exclude_unset=True)
        
    if "password" in create_data:
        hashed_password = get_password_hash(create_data["password"])
        del create_data["password"]
        create_data["hashed_password"] = hashed_password
    
    db_obj = User(**create_data)
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def update(
    db: Session,
    *,
    db_obj: User,
    obj_in: Union[UserUpdate, Dict[str, Any]]
) -> User:
    if isinstance(obj_in, dict):
        update_data = obj_in
    else:
        update_data = obj_in.dict(exclude_unset=True)
    
    if "password" in update_data:
        hashed_password = get_password_hash(update_data["password"])
        del update_data["password"]
        update_data["hashed_password"] = hashed_password
    
    for field in update_data:
        if hasattr(db_obj, field):
            setattr(db_obj, field, update_data[field])
    
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def remove(db: Session, *, id: int) -> None:
    user = db.query(User).filter(User.id == id).first()
    if user:
        db.delete(user)
        db.commit()


def is_active(user: User) -> bool:
    return user.is_active


def is_superuser(user: User) -> bool:
    return user.is_superuser 