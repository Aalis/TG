from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database.database import get_db
from ..database.models import TelegramSession, User
from ..schemas.telegram_sessions import TelegramSessionCreate, TelegramSessionResponse, TelegramSessionUpdate
from ..api.deps import get_current_active_user

router = APIRouter()

@router.get("/", response_model=List[TelegramSessionResponse])
async def get_sessions(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all Telegram sessions for the current user."""
    return db.query(TelegramSession).filter(TelegramSession.user_id == current_user.id).all()

@router.post("/", response_model=TelegramSessionResponse)
async def create_session(
    session_data: TelegramSessionCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new Telegram session."""
    # Check if phone number already exists for this user
    existing_session = db.query(TelegramSession).filter(
        TelegramSession.user_id == current_user.id,
        TelegramSession.phone == session_data.phone_number
    ).first()
    
    if existing_session:
        raise HTTPException(status_code=400, detail="Phone number already registered")

    new_session = TelegramSession(
        user_id=current_user.id,
        phone=session_data.phone_number,
        is_active=True
    )
    
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    
    return new_session

@router.delete("/{session_id}")
async def delete_session(
    session_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a Telegram session."""
    session = db.query(TelegramSession).filter(
        TelegramSession.id == session_id,
        TelegramSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    db.delete(session)
    db.commit()
    
    return {"message": "Session deleted successfully"}

@router.patch("/{session_id}", response_model=TelegramSessionResponse)
async def update_session(
    session_id: int,
    session_data: TelegramSessionUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a Telegram session's status."""
    session = db.query(TelegramSession).filter(
        TelegramSession.id == session_id,
        TelegramSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session.is_active = session_data.is_active
    db.commit()
    db.refresh(session)
    
    return session 