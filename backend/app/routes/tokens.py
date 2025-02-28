from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud
from app.api import deps
from app.schemas.telegram import TelegramToken, TelegramTokenCreate, TelegramTokenUpdate
from app.database.models import User

router = APIRouter()

@router.get("/", response_model=List[TelegramToken])
def read_tokens(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Get all tokens for current user"""
    tokens = crud.telegram.get_tokens_by_user(db, user_id=current_user.id)
    return tokens

@router.post("/", response_model=TelegramToken)
def create_token(
    *,
    db: Session = Depends(deps.get_db),
    token_in: TelegramTokenCreate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Create new token"""
    token = crud.telegram.create_token(db, obj_in=token_in, user_id=current_user.id)
    return token

@router.put("/{token_id}", response_model=TelegramToken)
def update_token(
    *,
    db: Session = Depends(deps.get_db),
    token_id: int,
    token_in: TelegramTokenUpdate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Update token"""
    token = crud.telegram.get_token_by_id(db, token_id=token_id)
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    if token.user_id != current_user.id:
        raise HTTPException(status_code=400, detail="Not enough permissions")
    token = crud.telegram.update_token(db, db_obj=token, obj_in=token_in)
    return token

@router.delete("/{token_id}")
def delete_token(
    *,
    db: Session = Depends(deps.get_db),
    token_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Delete token"""
    token = crud.telegram.get_token_by_id(db, token_id=token_id)
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    if token.user_id != current_user.id:
        raise HTTPException(status_code=400, detail="Not enough permissions")
    crud.telegram.delete_token(db, token_id=token_id)
    return {"success": True} 