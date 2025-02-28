from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud
from app.api import deps
from app.schemas.telegram import ParsedGroup, GroupParseRequest, GroupParseResponse
from app.database.models import User
from app.services.telegram_parser import TelegramParserService

router = APIRouter()

@router.get("/", response_model=List[ParsedGroup])
def read_groups(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Get all parsed groups for current user"""
    groups = crud.telegram.get_groups_by_user(db, user_id=current_user.id)
    return groups

@router.get("/{group_id}", response_model=ParsedGroup)
def read_group(
    *,
    db: Session = Depends(deps.get_db),
    group_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Get specific group by ID"""
    group = crud.telegram.get_group_by_id(db, group_id=group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.user_id != current_user.id:
        raise HTTPException(status_code=400, detail="Not enough permissions")
    return group

@router.delete("/{group_id}")
def delete_group(
    *,
    db: Session = Depends(deps.get_db),
    group_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Delete group"""
    group = crud.telegram.get_group_by_id(db, group_id=group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.user_id != current_user.id:
        raise HTTPException(status_code=400, detail="Not enough permissions")
    crud.telegram.delete_group(db, group_id=group_id)
    return {"success": True}

@router.post("/parse", response_model=GroupParseResponse)
async def parse_group(
    *,
    db: Session = Depends(deps.get_db),
    request: GroupParseRequest,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Parse a new group"""
    try:
        parser = TelegramParserService()
        group = await parser.parse_group(db, request.group_link, current_user.id)
        return {
            "success": True,
            "message": "Group parsed successfully",
            "group": group
        }
    except Exception as e:
        return {
            "success": False,
            "message": str(e),
            "group": None
        } 