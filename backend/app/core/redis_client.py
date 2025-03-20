import json
import pickle
from typing import Any, Optional, Dict, List
import redis.asyncio as redis
from app.core.config import settings
import logging

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

# Functions for caching parsed channels data

async def cache_parsed_channels(user_id: int, channels_data: List[Dict[str, Any]], cache_key: str, expiry: int = 300) -> bool:
    """Store parsed channels data in Redis with pagination support."""
    try:
        r = await get_redis_client()
        
        # Use pickle for faster serialization
        serialized_data = pickle.dumps(channels_data)
        
        # Store in Redis with shorter expiry (5 minutes)
        await r.set(cache_key, serialized_data, ex=expiry)
        return True
    except Exception as e:
        logging.warning(f"Error caching parsed channels: {e}")
        return False

async def get_cached_parsed_channels(user_id: int, cache_key: str) -> Optional[List[Dict[str, Any]]]:
    """Retrieve parsed channels data from Redis with pagination support."""
    try:
        r = await get_redis_client()
        
        # Get from Redis
        data = await r.get(cache_key)
        if not data:
            return None
        
        # Deserialize using pickle
        return pickle.loads(data)
    except Exception as e:
        logging.warning(f"Error retrieving cached parsed channels: {e}")
        return None

async def invalidate_parsed_channels_cache(user_id: int) -> bool:
    """Invalidate all cached parsed channels data for a user."""
    try:
        r = await get_redis_client()
        
        # Get all keys matching the pattern
        pattern = f"parsed_channels:{user_id}:*"
        keys = await r.keys(pattern)
        
        if keys:
            await r.delete(*keys)
        return True
    except Exception as e:
        logging.warning(f"Error invalidating parsed channels cache: {e}")
        return False

# Functions for caching parsed groups data

async def cache_parsed_groups(user_id: int, groups_data: List[Dict[str, Any]], cache_key: str, expiry: int = 300) -> bool:
    """Store parsed groups data in Redis with pagination support."""
    try:
        r = await get_redis_client()
        
        # Use pickle for faster serialization
        serialized_data = pickle.dumps(groups_data)
        
        # Store in Redis with shorter expiry (5 minutes)
        await r.set(cache_key, serialized_data, ex=expiry)
        return True
    except Exception as e:
        logging.warning(f"Error caching parsed groups: {e}")
        return False

async def get_cached_parsed_groups(user_id: int, cache_key: str) -> Optional[List[Dict[str, Any]]]:
    """Retrieve parsed groups data from Redis with pagination support."""
    try:
        r = await get_redis_client()
        
        # Get from Redis
        data = await r.get(cache_key)
        if not data:
            return None
        
        # Deserialize using pickle
        return pickle.loads(data)
    except Exception as e:
        logging.warning(f"Error retrieving cached parsed groups: {e}")
        return None

async def invalidate_parsed_groups_cache(user_id: int) -> bool:
    """Invalidate all cached parsed groups data for a user."""
    try:
        r = await get_redis_client()
        
        # Get all keys matching the pattern
        pattern = f"parsed_groups:{user_id}:*"
        keys = await r.keys(pattern)
        
        if keys:
            await r.delete(*keys)
        return True
    except Exception as e:
        logging.warning(f"Error invalidating parsed groups cache: {e}")
        return False 