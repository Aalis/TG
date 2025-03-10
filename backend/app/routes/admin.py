from typing import Any, List
from datetime import datetime, timedelta
import pytz

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud
from app.api import deps
from app.schemas.user import User, UserUpdate, PaginatedUsers
from app.database.models import User as UserModel

router = APIRouter(prefix="/admin", tags=["admin"])


def get_current_admin_user(
    current_user: UserModel = Depends(deps.get_current_user),
) -> UserModel:
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403,
            detail="The user doesn't have enough privileges"
        )
    return current_user


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
    db: Session = Depends(deps.get_db),
    current_user: UserModel = Depends(get_current_admin_user),
) -> Any:
    """
    Toggle user's permission to parse. Only accessible by admin users.
    Sets a 5-day expiration when enabling parse permission.
    """
    user = crud.user.get_by_id(db, user_id=user_id)
    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )
    
    # Toggle the can_parse field and set expiration
    new_can_parse = not user.can_parse
    user_in = UserUpdate(
        can_parse=new_can_parse,
        parse_permission_expires=datetime.now(pytz.UTC) + timedelta(days=5) if new_can_parse else None
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