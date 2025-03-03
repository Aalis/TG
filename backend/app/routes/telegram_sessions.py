from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict
from telethon import TelegramClient
from telethon.errors import SessionPasswordNeededError

from ..database.database import get_db
from ..database.models import TelegramSession, User
from ..schemas.telegram_sessions import TelegramSessionCreate, TelegramSessionResponse, TelegramSessionUpdate
from ..api.deps import get_current_active_user
from ..core.config import settings

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

@router.post("/verify-phone/")
async def verify_phone(
    phone_data: Dict[str, str],
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Send verification code to phone number."""
    phone_number = phone_data.get("phone_number")
    if not phone_number:
        raise HTTPException(status_code=400, detail="Phone number is required")

    try:
        # Create Telethon client
        client = TelegramClient(
            f"session_{phone_number}",
            settings.API_ID,
            settings.API_HASH
        )
        
        # Connect and send code
        await client.connect()
        sent = await client.send_code_request(phone_number)
        await client.disconnect()
        
        # Store phone_code_hash temporarily (you might want to use Redis for this in production)
        return {"phone_code_hash": sent.phone_code_hash}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/verify-code/")
async def verify_code(
    verification_data: Dict[str, str],
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Verify the code and generate session string."""
    phone_number = verification_data.get("phone_number")
    code = verification_data.get("code")
    phone_code_hash = verification_data.get("phone_code_hash")
    password = verification_data.get("password")  # For 2FA if needed
    
    if not all([phone_number, code, phone_code_hash]):
        raise HTTPException(status_code=400, detail="Missing required fields")

    try:
        # Create Telethon client
        client = TelegramClient(
            f"session_{phone_number}",
            settings.API_ID,
            settings.API_HASH
        )
        
        # Connect and sign in
        await client.connect()
        try:
            await client.sign_in(
                phone_number,
                code,
                phone_code_hash=phone_code_hash
            )
        except SessionPasswordNeededError:
            if not password:
                await client.disconnect()
                raise HTTPException(
                    status_code=400,
                    detail="Two-factor authentication required"
                )
            await client.sign_in(password=password)
        
        # Get the session string
        session_string = client.session.save()
        await client.disconnect()
        
        # Update or create session in database
        session = db.query(TelegramSession).filter(
            TelegramSession.user_id == current_user.id,
            TelegramSession.phone == phone_number
        ).first()
        
        if session:
            session.session_string = session_string
            session.is_active = True
        else:
            session = TelegramSession(
                user_id=current_user.id,
                phone=phone_number,
                session_string=session_string,
                is_active=True
            )
            db.add(session)
        
        db.commit()
        db.refresh(session)
        
        return {"message": "Session created successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) 