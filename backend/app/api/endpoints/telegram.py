from typing import Any, List
from sqlalchemy import func
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from telethon.errors import FloodWaitError, UserDeactivatedBanError
import logging

from app import crud
from app.api import deps
from app.core.config import settings
from app.database.models import User, ParsedGroup as DBParsedGroup, GroupMember
from app.schemas.telegram import (
    TelegramToken,
    TelegramTokenCreate,
    TelegramTokenUpdate,
    ParsedGroup,
    GroupParseRequest,
    GroupParseResponse,
    ChannelParseRequest,
    ChannelParseResponse,
    ChannelPost,
    PostComment,
    ParsingProgressResponse,
    DialogResponse,
)
from app.services.telegram_parser import TelegramParserService

router = APIRouter()


@router.get("/tokens/", response_model=List[TelegramToken])
def read_tokens(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Retrieve Telegram tokens.
    """
    tokens = crud.telegram.get_tokens_by_user(db, user_id=current_user.id)
    return tokens


@router.post("/tokens/", response_model=TelegramToken)
def create_token(
    *,
    db: Session = Depends(deps.get_db),
    token_in: TelegramTokenCreate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Create new Telegram token.
    """
    token = crud.telegram.create_token(db, obj_in=token_in, user_id=current_user.id)
    return token


@router.put("/tokens/{token_id}", response_model=TelegramToken)
def update_token(
    *,
    db: Session = Depends(deps.get_db),
    token_id: int,
    token_in: TelegramTokenUpdate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Update a Telegram token.
    """
    token = crud.telegram.get_token_by_id(db, token_id=token_id)
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    if token.user_id != current_user.id:
        raise HTTPException(status_code=400, detail="Not enough permissions")
    token = crud.telegram.update_token(db, db_obj=token, obj_in=token_in)
    return token


@router.delete("/tokens/{token_id}", response_model=dict)
def delete_token(
    *,
    db: Session = Depends(deps.get_db),
    token_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Delete a Telegram token.
    """
    token = crud.telegram.get_token_by_id(db, token_id=token_id)
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    if token.user_id != current_user.id:
        raise HTTPException(status_code=400, detail="Not enough permissions")
    crud.telegram.delete_token(db, token_id=token_id)
    return {"success": True}


@router.get("/parsed-groups/", response_model=List[ParsedGroup])
async def read_groups(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    page: int = 1,
    items_per_page: int = 21,
    max_items: int = 42
) -> Any:
    """
    Retrieve parsed Telegram groups with pagination.
    """
    try:
        # Try to get groups from cache first
        from app.core.redis_client import get_cached_parsed_groups, cache_parsed_groups
        cache_key = f"parsed_groups:{current_user.id}:p{page}"
        
        try:
            cached_data = await get_cached_parsed_groups(current_user.id, cache_key)
            if cached_data:
                logging.info(f"Successfully retrieved {len(cached_data)} groups from cache")
                return cached_data
        except Exception as e:
            logging.error(f"Cache retrieval failed: {str(e)}")
        
        # Calculate offset
        offset = (page - 1) * items_per_page
        
        # Start transaction
        from sqlalchemy.orm import Session
        from sqlalchemy import text
        
        # Ensure we have a valid database connection
        try:
            db.execute(text("SELECT 1"))
        except Exception as e:
            logging.error(f"Database connection check failed: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail="Database connection error"
            )
        
        # Get total count first
        total_count = db.query(DBParsedGroup).filter(
            DBParsedGroup.user_id == current_user.id,
            DBParsedGroup.is_channel == False
        ).count()
        
        if total_count > max_items:
            total_count = max_items
            
        if total_count == 0:
            return []
        
        # Main query with optimized loading
        query = (
            db.query(
                DBParsedGroup.id,
                DBParsedGroup.group_id,
                DBParsedGroup.group_name,
                DBParsedGroup.group_username,
                DBParsedGroup.is_public,
                DBParsedGroup.is_channel,
                DBParsedGroup.parsed_at,
                DBParsedGroup.user_id
            )
            .filter(
                DBParsedGroup.user_id == current_user.id,
                DBParsedGroup.is_channel == False
            )
            .order_by(DBParsedGroup.parsed_at.desc())
        )
        
        # Get paginated results
        results = (
            query
            .offset(offset)
            .limit(items_per_page)
            .all()
        )
        
        if not results:
            return []
        
        # Get member counts in a single query
        group_ids = [r[0] for r in results]
        member_counts = dict(
            db.query(
                GroupMember.group_id,
                func.count(GroupMember.id).label('count')
            )
            .filter(GroupMember.group_id.in_(group_ids))
            .group_by(GroupMember.group_id)
            .all()
        )
        
        # Get member data efficiently
        members_query = (
            db.query(GroupMember)
            .filter(GroupMember.group_id.in_(group_ids))
            .all()
        )
        
        # Create a mapping of group_id to members
        members_map = {}
        for member in members_query:
            if member.group_id not in members_map:
                members_map[member.group_id] = []
            members_map[member.group_id].append({
                "id": member.id,
                "user_id": member.user_id,
                "group_id": member.group_id,
                "username": member.username,
                "is_admin": member.is_admin,
                "is_premium": member.is_premium
            })
        
        # Build response data
        groups_data = []
        for (
            id, group_id, group_name, group_username, 
            is_public, is_channel, parsed_at, user_id
        ) in results:
            group_dict = {
                "id": id,
                "group_id": group_id,
                "group_name": group_name,
                "group_username": group_username,
                "member_count": member_counts.get(id, 0),
                "is_public": is_public,
                "is_channel": is_channel,
                "parsed_at": parsed_at,
                "user_id": user_id,
                "members": members_map.get(id, []),
                "total_count": total_count
            }
            groups_data.append(group_dict)

        # Cache the results
        try:
            await cache_parsed_groups(current_user.id, groups_data, cache_key, expiry=180)
            logging.info(f"Successfully cached {len(groups_data)} groups")
        except Exception as e:
            logging.error(f"Failed to cache groups: {str(e)}")
        
        return groups_data
        
    except Exception as e:
        logging.error(f"Error in read_groups: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to load groups. Please try again."
        )


@router.get("/parsed-groups/{group_id}", response_model=ParsedGroup)
def read_group(
    *,
    db: Session = Depends(deps.get_db),
    group_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get a specific parsed group by id.
    """
    group = crud.telegram.get_group_by_id(db, group_id=group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.user_id != current_user.id:
        raise HTTPException(status_code=400, detail="Not enough permissions")
    return group


@router.delete("/parsed-groups/{group_id}", response_model=dict)
async def delete_group(
    *,
    db: Session = Depends(deps.get_db),
    group_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Delete a parsed group.
    """
    group = crud.telegram.get_group_by_id(db, group_id=group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.user_id != current_user.id:
        raise HTTPException(status_code=400, detail="Not enough permissions")
    
    crud.telegram.delete_group(db, group_id=group_id)
    
    # Invalidate cache after deletion
    from app.core.redis_client import invalidate_parsed_groups_cache
    await invalidate_parsed_groups_cache(current_user.id)
    
    return {"success": True}


@router.post("/parse-group/", response_model=GroupParseResponse)
async def parse_group(
    *,
    db: Session = Depends(deps.get_db),
    request: GroupParseRequest,
    current_user: User = Depends(deps.get_current_user_with_parse_permission),
) -> Any:
    """Parse a Telegram group"""
    try:
        parser = TelegramParserService(
            api_id=settings.API_ID,
            api_hash=settings.API_HASH,
        )
        
        group = await parser.parse_group(
            db=db,
            group_link=request.group_link,
            user_id=current_user.id,
            scan_comments=request.scan_comments,
            comment_limit=request.comment_limit if request.scan_comments else 100
        )
        
        # Ensure the group was created and is in the database
        if not group:
            raise HTTPException(
                status_code=400,
                detail="Failed to create group in database"
            )
        
        # Double-check that we can retrieve the group
        saved_group = crud.telegram.get_group_by_id(db, group_id=group.id)
        if not saved_group:
            raise HTTPException(
                status_code=400,
                detail="Group was not properly saved to database"
            )
        
        # Invalidate the groups cache after successful parsing
        from app.core.redis_client import invalidate_parsed_groups_cache
        await invalidate_parsed_groups_cache(current_user.id)
        
        return {
            "success": True,
            "message": "Group parsed successfully",
            "group": saved_group
        }
        
    except HTTPException as e:
        # Re-raise HTTP exceptions as they already have the correct format
        raise e
    except Exception as e:
        logging.error(f"Error in parse_group endpoint: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=f"Failed to parse group: {str(e)}"
        )


@router.post("/parse-channel/", response_model=ChannelParseResponse)
async def parse_channel(
    *,
    db: Session = Depends(deps.get_db),
    request: ChannelParseRequest,
    current_user: User = Depends(deps.get_current_user_with_parse_permission),
) -> Any:
    """
    Parse a Telegram channel using the bot token pool.
    """
    parser = TelegramParserService(
        api_id=settings.API_ID,
        api_hash=settings.API_HASH,
    )
    
    try:
        group = await parser.parse_channel(
            db=db,
            channel_link=request.channel_link,
            user_id=current_user.id,
            post_limit=request.post_limit
        )
        
        # Invalidate the channels cache after successful parsing
        from app.core.redis_client import invalidate_parsed_channels_cache
        await invalidate_parsed_channels_cache(current_user.id)
        
        return {
            "success": True,
            "message": f"Successfully parsed channel with {len(group.posts)} posts",
            "group": group
        }
    except (FloodWaitError, UserDeactivatedBanError) as e:
        return {
            "success": False,
            "message": f"Rate limit exceeded: {str(e)}. Please try again later.",
            "group": None
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to parse channel: {str(e)}",
            "group": None
        }


@router.get("/groups/{group_id}/posts/", response_model=List[ChannelPost])
def read_group_posts(
    *,
    db: Session = Depends(deps.get_db),
    group_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get all posts for a specific group.
    """
    group = crud.telegram.get_group_by_id(db, group_id=group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.user_id != current_user.id:
        raise HTTPException(status_code=400, detail="Not enough permissions")
    
    posts = crud.telegram.get_posts_by_group(db, group_id=group_id)
    return posts


@router.get("/posts/{post_id}/comments/", response_model=List[PostComment])
def read_post_comments(
    *,
    db: Session = Depends(deps.get_db),
    post_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get all comments for a specific post.
    """
    post = crud.telegram.get_post_by_id(db, post_id=post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    group = crud.telegram.get_group_by_id(db, group_id=post.group_id)
    if not group or group.user_id != current_user.id:
        raise HTTPException(status_code=400, detail="Not enough permissions")
    
    comments = crud.telegram.get_comments_by_post(db, post_id=post_id)
    return comments


@router.get("/parsed-channels/", response_model=List[ParsedGroup])
async def read_channels(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    page: int = 1,
    items_per_page: int = 21,
    max_items: int = 42
) -> Any:
    """Get all parsed channels for current user with pagination"""
    try:
        # Try to get channels from cache first
        from app.core.redis_client import get_cached_parsed_channels, cache_parsed_channels
        cache_key = f"parsed_channels:{current_user.id}:p{page}"
        
        try:
            cached_data = await get_cached_parsed_channels(current_user.id, cache_key)
            if cached_data:
                logging.info(f"Successfully retrieved {len(cached_data)} channels from cache")
                return cached_data
        except Exception as e:
            logging.error(f"Cache retrieval failed: {str(e)}")
        
        # Calculate offset
        offset = (page - 1) * items_per_page
        
        # Ensure we have a valid database connection
        try:
            db.execute(text("SELECT 1"))
        except Exception as e:
            logging.error(f"Database connection check failed: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail="Database connection error"
            )
        
        # Get total count first
        total_count = db.query(DBParsedGroup).filter(
            DBParsedGroup.user_id == current_user.id,
            DBParsedGroup.is_channel == True
        ).count()
        
        if total_count > max_items:
            total_count = max_items
            
        if total_count == 0:
            return []
        
        # Main query with optimized loading
        query = (
            db.query(
                DBParsedGroup.id,
                DBParsedGroup.group_id,
                DBParsedGroup.group_name,
                DBParsedGroup.group_username,
                DBParsedGroup.is_public,
                DBParsedGroup.is_channel,
                DBParsedGroup.parsed_at,
                DBParsedGroup.user_id
            )
            .filter(
                DBParsedGroup.user_id == current_user.id,
                DBParsedGroup.is_channel == True
            )
            .order_by(DBParsedGroup.parsed_at.desc())
        )
        
        # Get paginated results
        results = (
            query
            .offset(offset)
            .limit(items_per_page)
            .all()
        )
        
        if not results:
            return []
        
        # Get member counts in a single query
        channel_ids = [r[0] for r in results]
        member_counts = dict(
            db.query(
                GroupMember.group_id,
                func.count(GroupMember.id).label('count')
            )
            .filter(GroupMember.group_id.in_(channel_ids))
            .group_by(GroupMember.group_id)
            .all()
        )
        
        # Get member data efficiently
        members_query = (
            db.query(GroupMember)
            .filter(GroupMember.group_id.in_(channel_ids))
            .all()
        )
        
        # Create a mapping of channel_id to members
        members_map = {}
        for member in members_query:
            if member.group_id not in members_map:
                members_map[member.group_id] = []
            members_map[member.group_id].append({
                "id": member.id,
                "user_id": member.user_id,
                "group_id": member.group_id,
                "username": member.username,
                "is_admin": member.is_admin,
                "is_premium": member.is_premium
            })
        
        # Build response data
        channels_data = []
        for (
            id, group_id, group_name, group_username, 
            is_public, is_channel, parsed_at, user_id
        ) in results:
            channel_dict = {
                "id": id,
                "group_id": group_id,
                "group_name": group_name,
                "group_username": group_username,
                "member_count": member_counts.get(id, 0),
                "is_public": is_public,
                "is_channel": is_channel,
                "parsed_at": parsed_at,
                "user_id": user_id,
                "members": members_map.get(id, []),
                "total_count": total_count
            }
            channels_data.append(channel_dict)

        # Cache the results
        try:
            await cache_parsed_channels(current_user.id, channels_data, cache_key, expiry=180)
            logging.info(f"Successfully cached {len(channels_data)} channels")
        except Exception as e:
            logging.error(f"Failed to cache channels: {str(e)}")
        
        return channels_data
        
    except Exception as e:
        logging.error(f"Error in read_channels: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to load channels. Please try again."
        )


@router.delete("/parsed-channels/{channel_id}", response_model=dict)
async def delete_channel(
    *,
    db: Session = Depends(deps.get_db),
    channel_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Delete a parsed channel."""
    channel = crud.telegram.get_group_by_id(db, group_id=channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    if channel.user_id != current_user.id:
        raise HTTPException(status_code=400, detail="Not enough permissions")
    if not channel.is_channel:
        raise HTTPException(status_code=400, detail="Specified ID is not a channel")
    
    crud.telegram.delete_group(db, group_id=channel_id)
    
    # Invalidate cache after deletion
    from app.core.redis_client import invalidate_parsed_channels_cache
    await invalidate_parsed_channels_cache(current_user.id)
    
    return {"success": True}


@router.get("/parse-group/progress", response_model=ParsingProgressResponse)
async def get_parsing_progress(
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Get current group parsing progress"""
    progress = TelegramParserService.get_progress()
    if not progress:
        return {
            "is_parsing": False,
            "phase": "idle",
            "progress": 0,
            "message": "No parsing in progress",
            "total_members": 0,
            "current_members": 0
        }
    
    return {
        "is_parsing": True,
        "phase": progress.current_phase,
        "progress": progress.phase_progress,
        "message": progress.status_message,
        "total_members": progress.total_members,
        "current_members": progress.current_members
    }


@router.get("/parse-channel/progress", response_model=ParsingProgressResponse)
async def get_channel_parsing_progress(
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Get the current progress of channel parsing"""
    progress = TelegramParserService.get_progress()
    if not progress:
        return {
            "is_parsing": False,
            "phase": "idle",
            "progress": 0,
            "message": "No parsing in progress",
            "total_members": 0,
            "current_members": 0
        }
    
    return {
        "is_parsing": True,
        "phase": progress.current_phase,
        "progress": progress.phase_progress,
        "message": progress.status_message,
        "total_members": progress.total_members,
        "current_members": progress.current_members
    }


@router.get("/dialogs/", response_model=List[DialogResponse])
async def list_dialogs(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    List all available Telegram dialogs (groups and channels) for the current user.
    """
    try:
        parser = TelegramParserService(
            api_id=settings.API_ID,
            api_hash=settings.API_HASH
        )
        dialogs = await parser.list_dialogs(db, current_user.id)
        return dialogs
    except Exception as e:
        # Return empty list instead of raising an error
        logging.error(f"Error listing dialogs: {str(e)}")
        return []


@router.post("/parse-group/cancel")
async def cancel_group_parsing(
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Cancel the current group parsing operation"""
    TelegramParserService.cancel_parsing()
    return {"success": True, "message": "Parsing cancelled"}


@router.post("/parse-channel/cancel")
async def cancel_channel_parsing(
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Cancel the current channel parsing operation"""
    TelegramParserService.cancel_parsing()
    return {"success": True, "message": "Parsing cancelled"} 