import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from telethon import TelegramClient
from telethon.errors import SessionPasswordNeededError
from telethon.sessions import StringSession
import asyncio
import os
import time
from fastapi.responses import JSONResponse

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from app.database.database import get_db
from app.database.models import TelegramSession, User
from app.schemas.telegram_sessions import TelegramSessionCreate, TelegramSessionResponse, TelegramSessionUpdate
from app.api.deps import get_current_active_user
from app.core.config import settings
from app.core.redis_client import (
    store_client_session_data, 
    get_client_session_data, 
    delete_client_session,
    store_phone_code_hash,
    get_phone_code_hash,
    get_redis_client
)

router = APIRouter()

# Use a global dictionary to store active client sessions
# Each key is the phone number, and the value is a dict with client and last_used timestamp
temp_clients = {}

# Debug function to check temp_clients status
def log_clients_status():
    client_numbers = list(temp_clients.keys())
    client_details = {}
    for phone, data in temp_clients.items():
        if isinstance(data, dict):
            client_details[phone] = {"timestamp": data.get("timestamp", 0)}
        else:
            client_details[phone] = {"is_dict": False, "type": type(data).__name__}
    
    logger.info(f"Active clients in memory: {client_numbers}")
    logger.info(f"Total clients in memory: {len(client_numbers)}")
    logger.info(f"Client details: {client_details}")
    return client_numbers

def store_client(phone_number: str, client: TelegramClient):
    """Store client with timestamp to track usage and preserve custom attributes"""
    # Check for any custom attributes we want to preserve
    custom_data = {}
    if hasattr(client, '_2fa_needed'):
        custom_data['_2fa_needed'] = getattr(client, '_2fa_needed')
        logger.info(f"Preserving _2fa_needed={custom_data['_2fa_needed']} flag for {phone_number}")

    # Store client and metadata
    temp_clients[phone_number] = {
        "client": client,
        "timestamp": time.time(),
        **custom_data
    }
    logger.info(f"Stored client for {phone_number} with timestamp {time.time()}")
    
def get_client(phone_number: str) -> TelegramClient:
    """Get client from memory with timestamp update and restore custom attributes"""
    client_data = temp_clients.get(phone_number)
    if not client_data:
        return None
        
    if isinstance(client_data, dict) and "client" in client_data:
        # Update timestamp
        client_data["timestamp"] = time.time()
        
        # Get the client
        client = client_data["client"]
        
        # Restore any custom attributes
        if '_2fa_needed' in client_data:
            client._2fa_needed = client_data['_2fa_needed']
            logger.info(f"Restored _2fa_needed={client_data['_2fa_needed']} flag for {phone_number}")
            
        # Update the dictionary
        temp_clients[phone_number] = client_data
        return client
    elif isinstance(client_data, TelegramClient):
        # Migrate old format
        logger.info(f"Migrating old client format for {phone_number}")
        store_client(phone_number, client_data)
        return client_data
    
    return None

def create_client(phone_number: str, session_string: str = None) -> TelegramClient:
    """Create a new Telethon client with consistent parameters"""
    session = StringSession(session_string) if session_string else StringSession()
    return TelegramClient(
        session,
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
    
    # If trying to activate this session, deactivate all other sessions first
    if session_data.is_active:
        db.query(TelegramSession).filter(
            TelegramSession.user_id == current_user.id,
            TelegramSession.id != session_id,
            TelegramSession.is_active == True
        ).update({"is_active": False})
    
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
        # Log current clients status
        log_clients_status()
        
        # Create client
        client = create_client(phone_number)
        
        # Connect and send code
        logger.info(f"Connecting to Telegram for phone {phone_number}...")
        await client.connect()
        sent = await client.send_code_request(phone_number)
        
        # Save the client in memory
        store_client(phone_number, client)
        logger.info(f"Stored client in memory for phone {phone_number}")
        
        # Log clients status after adding
        log_clients_status()
        
        # Store phone code hash in Redis
        await store_phone_code_hash(phone_number, sent.phone_code_hash)
        
        # Store session string in Redis
        session_string = client.session.save()
        await store_client_session_data(phone_number, {
            "session_string": session_string,
            "phone_code_hash": sent.phone_code_hash
        })
        
        return {"phone_code_hash": sent.phone_code_hash}
    except Exception as e:
        # Clean up on error
        await delete_client_session(phone_number)
        if phone_number in temp_clients:
            try:
                await temp_clients[phone_number]["client"].disconnect()
            except Exception as dc_err:
                logger.warning(f"Error disconnecting client: {str(dc_err)}")
            del temp_clients[phone_number]
        logger.error(f"Error sending verification code: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/verify-code/")
async def verify_code(
    verification_data: Dict[str, str],
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Verify the code and generate session string."""
    logger.info("Received verification data: %s", verification_data)
    
    phone_number = verification_data.get("phone_number")
    code = verification_data.get("code")
    phone_code_hash = verification_data.get("phone_code_hash")
    password = verification_data.get("password")
    
    logger.info("Extracted fields:")
    logger.info(f"Phone number: {phone_number}")
    logger.info(f"Code: {code}")
    logger.info(f"Phone code hash: {phone_code_hash}")
    logger.info(f"Password present: {bool(password)}")
    
    if not all([phone_number, code, phone_code_hash]):
        missing_fields = []
        if not phone_number: missing_fields.append("phone_number")
        if not code: missing_fields.append("code")
        if not phone_code_hash: missing_fields.append("phone_code_hash")
        error_msg = f"Missing required fields: {', '.join(missing_fields)}"
        logger.warning("Validation error: %s", error_msg)
        raise HTTPException(status_code=400, detail=error_msg)

    try:
        # Check current temp_clients before accessing
        clients_before = log_clients_status()
        
        # First check in memory cache
        client = get_client(phone_number)
        if client:
            logger.info(f"Found existing client for {phone_number} in memory cache")
            if not client.is_connected():
                logger.info("Client not connected, reconnecting...")
                await client.connect()
                
            # Check if we stored 2FA state
            client_data = temp_clients.get(phone_number, {})
            if isinstance(client_data, dict) and client_data.get('_2fa_needed'):
                logger.info("Found saved 2FA state in client data")
                client._2fa_needed = True
        else:
            logger.warning(f"Client for {phone_number} not found in memory! Available clients: {clients_before}")
            
            # Try to get session data from Redis
            session_data = await get_client_session_data(phone_number)
            
            # If we have session data, create a client with the session string
            if session_data and "session_string" in session_data:
                logger.info("Creating client from stored session string in Redis")
                client = create_client(phone_number, session_data["session_string"])
                await client.connect()
                
                # Check if 2FA flag was stored
                if session_data.get('_2fa_needed'):
                    logger.info("Found 2FA flag in Redis data")
                    client._2fa_needed = True
                
                # Store in memory too for future requests
                store_client(phone_number, client)
                
                # Use stored phone_code_hash if available
                if "phone_code_hash" in session_data and session_data["phone_code_hash"] != phone_code_hash:
                    logger.info(f"Using stored phone code hash instead of provided one")
                    phone_code_hash = session_data["phone_code_hash"]
            else:
                # No client found anywhere, create a new one
                logger.info("Creating new client as no existing client found...")
                client = create_client(phone_number)
                await client.connect()
                store_client(phone_number, client)
                
                # Verify phone_code_hash from Redis
                stored_hash = await get_phone_code_hash(phone_number)
                if stored_hash and stored_hash != phone_code_hash:
                    logger.info(f"Using stored phone code hash {stored_hash} instead of provided hash {phone_code_hash}")
                    phone_code_hash = stored_hash
        
        # If we still don't have a client, something went wrong
        if not client:
            logger.error("Failed to create Telegram client")
            raise HTTPException(status_code=500, detail="Failed to create Telegram client")
        
        # Log clients status after loading client
        log_clients_status()
            
        try:
            logger.info("Attempting to sign in...")
            logger.info(f"Using API ID: {settings.API_ID}")
            logger.info(f"Using API Hash: {settings.API_HASH[:4]}...")
            
            if password:
                try:
                    # First check if we're already at 2FA stage
                    if hasattr(client, '_2fa_needed') and client._2fa_needed:
                        logger.info("Client already at 2FA stage, trying password directly")
                        await client.sign_in(password=password)
                        logger.info("2FA sign in successful!")
                    else:
                        # Try to directly use the password without re-sending code
                        # This will work if we're in 2FA state already
                        try:
                            logger.info("Attempting direct 2FA password login")
                            await client.sign_in(password=password)
                            logger.info("Direct 2FA sign in successful!")
                        except Exception as direct_error:
                            logger.warning(f"Direct password login failed: {str(direct_error)}")
                            
                            # If that fails, try code first, then password as fallback
                            try:
                                logger.info("Trying code verification first")
                                await client.sign_in(
                                    phone_number,
                                    code,
                                    phone_code_hash=phone_code_hash
                                )
                                logger.info("Sign in successful with code only, no 2FA required!")
                            except SessionPasswordNeededError:
                                # Now try password
                                logger.info("2FA triggered, now trying password")
                                await client.sign_in(password=password)
                                logger.info("2FA sign in successful!")
                except Exception as e:
                    logger.error(f"Error during 2FA sign in: {str(e)}")
                    raise
            else:
                # No password provided, just try code
                logger.info("Attempting sign in with code only")
                await client.sign_in(
                    phone_number,
                    code,
                    phone_code_hash=phone_code_hash
                )
                logger.info("Sign in successful!")
        except SessionPasswordNeededError:
            logger.info("2FA password required")
            if not password:
                # Store the client for the next request with 2FA flag
                client._2fa_needed = True
                store_client(phone_number, client)
                logger.info(f"Stored client in memory for 2FA continuation with 2FA flag")
                
                # Only attempt to store in Redis if the client is available
                try:
                    session_string = client.session.save()
                    redis_client = await get_redis_client()
                    if redis_client:
                        logger.info("Storing session in Redis for 2FA continuation")
                        await store_client_session_data(phone_number, {
                            "session_string": session_string,
                            "phone_code_hash": phone_code_hash,
                            "_2fa_needed": True
                        })
                    else:
                        logger.info("Redis client not available, using in-memory storage only")
                except Exception as e:
                    logger.error(f"Error storing session data during 2FA: {str(e)}")
                
                # Return 2FA required error WITHOUT removing client from memory
                # This is NOT a failure case, do NOT go to the exception handler
                return JSONResponse(
                    status_code=400,
                    content={"detail": "Two-factor authentication required"}
                )
            
            # If password was provided but we got here, it's incorrect
            raise HTTPException(
                status_code=400,
                detail="Incorrect two-factor authentication password"
            )

        # Get the session string
        logger.info("Getting session string...")
        session_string = client.session.save()
        await client.disconnect()
        logger.info("Client disconnected successfully")
        
        # Clean up Redis (if available)
        try:
            await delete_client_session(phone_number)
        except Exception as e:
            logger.warning(f"Error during Redis cleanup: {str(e)}")
        
        # Clean up in-memory cache
        if phone_number in temp_clients:
            del temp_clients[phone_number]
            logger.info(f"Removed client from memory cache for {phone_number}")
        
        # Log client status after cleanup
        log_clients_status()
        
        # Update or create session in database
        session = db.query(TelegramSession).filter(
            TelegramSession.user_id == current_user.id,
            TelegramSession.phone == phone_number
        ).first()
        
        if session:
            logger.info(f"Updating existing session {session.id} for phone {phone_number}")
            session.session_string = session_string
            session.is_active = True
        else:
            logger.info(f"Creating new session for phone {phone_number}")
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
        try:
            await delete_client_session(phone_number)
        except Exception as redis_error:
            logger.warning(f"Error cleaning up Redis session: {str(redis_error)}")
        
        # Clean up in-memory client
        if phone_number in temp_clients:
            try:
                client_data = temp_clients[phone_number]
                if isinstance(client_data, dict) and "client" in client_data:
                    await client_data["client"].disconnect()
                elif isinstance(client_data, TelegramClient):
                    await client_data.disconnect()
            except Exception as dc_error:
                logger.warning(f"Error disconnecting client: {str(dc_error)}")
            del temp_clients[phone_number]
            logger.info(f"Removed client from memory after error for {phone_number}")
        
        error_message = str(e)
        logger.error(f"Error during verification: {error_message}")
        
        if "confirmation code has expired" in error_message.lower():
            raise HTTPException(
                status_code=400,
                detail="The verification code has expired. Please request a new code and try again quickly."
            )
        raise HTTPException(status_code=400, detail=error_message) 