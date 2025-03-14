import json
import pickle
from typing import Any, Optional, Dict
import redis.asyncio as redis
from app.core.config import settings

# Redis client for session storage
redis_client = None

async def get_redis_client():
    """Get or create Redis client."""
    global redis_client
    if redis_client is None:
        redis_client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB,
            password=settings.REDIS_PASSWORD or None,
            decode_responses=False  # We need binary for pickle
        )
    return redis_client

async def store_client_session_data(phone_number: str, session_data: Dict[str, Any], expiry: int = None) -> bool:
    """Store client session data in Redis."""
    try:
        r = await get_redis_client()
        key = f"telegram_client:{phone_number}"
        
        # Serialize the session data as JSON
        serialized_data = json.dumps(session_data).encode('utf-8')
        
        # Store in Redis with expiry
        expiry = expiry or settings.REDIS_CLIENT_EXPIRY
        await r.set(key, serialized_data, ex=expiry)
        return True
    except Exception as e:
        print(f"Error storing client session data: {e}")
        return False

async def get_client_session_data(phone_number: str) -> Optional[Dict[str, Any]]:
    """Retrieve client session data from Redis."""
    try:
        r = await get_redis_client()
        key = f"telegram_client:{phone_number}"
        
        # Get from Redis
        data = await r.get(key)
        if not data:
            return None
        
        # Deserialize the session data
        return json.loads(data.decode('utf-8'))
    except Exception as e:
        print(f"Error retrieving client session data: {e}")
        return None

async def delete_client_session(phone_number: str) -> bool:
    """Delete client session data from Redis."""
    try:
        r = await get_redis_client()
        key = f"telegram_client:{phone_number}"
        
        # Delete from Redis
        await r.delete(key)
        return True
    except Exception as e:
        print(f"Error deleting client session: {e}")
        return False

async def store_phone_code_hash(phone_number: str, phone_code_hash: str, expiry: int = 300) -> bool:
    """Store phone code hash in Redis."""
    try:
        r = await get_redis_client()
        key = f"phone_code_hash:{phone_number}"
        
        # Store in Redis with expiry (5 minutes by default)
        await r.set(key, phone_code_hash.encode('utf-8'), ex=expiry)
        return True
    except Exception as e:
        print(f"Error storing phone code hash: {e}")
        return False

async def get_phone_code_hash(phone_number: str) -> Optional[str]:
    """Retrieve phone code hash from Redis."""
    try:
        r = await get_redis_client()
        key = f"phone_code_hash:{phone_number}"
        
        # Get from Redis
        data = await r.get(key)
        if not data:
            return None
        
        # Convert bytes to string
        return data.decode('utf-8')
    except Exception as e:
        print(f"Error retrieving phone code hash: {e}")
        return None 