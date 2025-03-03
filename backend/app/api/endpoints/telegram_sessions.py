from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict
from telethon import TelegramClient
from telethon.errors import SessionPasswordNeededError
from telethon.sessions import StringSession
import asyncio

from app.database.database import get_db
from app.database.models import TelegramSession, User
from app.schemas.telegram_sessions import TelegramSessionCreate, TelegramSessionResponse, TelegramSessionUpdate
from app.api.deps import get_current_active_user
from app.core.config import settings

router = APIRouter()

# Store client instances temporarily (in production, you might want to use Redis)
temp_clients = {}

def create_client(phone_number: str) -> TelegramClient:
    """Create a new Telethon client with consistent parameters"""
    return TelegramClient(
        StringSession(),
        api_id=settings.API_ID,
        api_hash=settings.API_HASH,
        device_model="Desktop",
        system_version="Windows 10",
        app_version="1.0.0",
        lang_code="en",
        system_lang_code="en"
    )

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
        # Create and store client
        client = create_client(phone_number)
        temp_clients[phone_number] = client
        
        # Connect and send code
        print(f"Connecting to Telegram for phone {phone_number}...")
        await client.connect()
        sent = await client.send_code_request(phone_number)
        
        # Don't disconnect, keep the client for verification
        return {"phone_code_hash": sent.phone_code_hash}
    except Exception as e:
        if phone_number in temp_clients:
            await temp_clients[phone_number].disconnect()
            del temp_clients[phone_number]
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/verify-code/")
async def verify_code(
    verification_data: Dict[str, str],
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Verify the code and generate session string."""
    print("Received verification data:", verification_data)
    
    phone_number = verification_data.get("phone_number")
    code = verification_data.get("code")
    phone_code_hash = verification_data.get("phone_code_hash")
    password = verification_data.get("password")
    
    print("Extracted fields:")
    print(f"Phone number: {phone_number}")
    print(f"Code: {code}")
    print(f"Phone code hash: {phone_code_hash}")
    print(f"Password present: {bool(password)}")
    
    if not all([phone_number, code, phone_code_hash]):
        missing_fields = []
        if not phone_number: missing_fields.append("phone_number")
        if not code: missing_fields.append("code")
        if not phone_code_hash: missing_fields.append("phone_code_hash")
        error_msg = f"Missing required fields: {', '.join(missing_fields)}"
        print("Validation error:", error_msg)
        raise HTTPException(status_code=400, detail=error_msg)

    try:
        # Get existing client or create new one
        client = temp_clients.get(phone_number)
        if not client:
            print("Creating new client as no existing client found...")
            client = create_client(phone_number)
            await client.connect()
        elif not client.is_connected():
            print("Reconnecting existing client...")
            await client.connect()
            
        try:
            print("Attempting to sign in...")
            print(f"Using API ID: {settings.API_ID}")
            print(f"Using API Hash: {settings.API_HASH[:4]}...")
            await client.sign_in(
                phone_number,
                code,
                phone_code_hash=phone_code_hash
            )
            print("Sign in successful!")
        except SessionPasswordNeededError:
            print("2FA password required")
            if not password:
                raise HTTPException(
                    status_code=400,
                    detail="Two-factor authentication required"
                )
            await client.sign_in(password=password)
        
        # Get the session string
        print("Getting session string...")
        session_string = client.session.save()
        await client.disconnect()
        print("Client disconnected successfully")
        
        # Clean up temp client
        if phone_number in temp_clients:
            del temp_clients[phone_number]
        
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
        # Clean up on error
        if phone_number in temp_clients:
            await temp_clients[phone_number].disconnect()
            del temp_clients[phone_number]
        error_message = str(e)
        if "confirmation code has expired" in error_message.lower():
            raise HTTPException(
                status_code=400,
                detail="The verification code has expired. Please request a new code and try again quickly."
            )
        raise HTTPException(status_code=400, detail=error_message) 