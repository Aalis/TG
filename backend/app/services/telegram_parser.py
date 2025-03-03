import re
import os
import random
from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime

from sqlalchemy.orm import Session
from telethon import TelegramClient
from telethon.tl.functions.channels import GetFullChannelRequest
from telethon.tl.functions.messages import GetDialogsRequest
from telethon.tl.types import InputPeerEmpty, ChannelParticipantsAdmins, Channel, User as TelegramUser, Message
from telethon.errors import SessionPasswordNeededError, FloodWaitError, UserDeactivatedBanError
from telethon.sessions import StringSession

from app import crud
from app.schemas.telegram import ParsedGroupCreate, GroupMemberCreate, ChannelPostCreate, PostCommentCreate
from app.database.models import ParsedGroup, TelegramSession
from app.core.config import settings


class TelegramParserService:
    _bot_tokens = None
    _current_token_index = 0

    @classmethod
    def get_bot_tokens(cls) -> List[str]:
        """Get the list of bot tokens from environment variable"""
        if cls._bot_tokens is None:
            tokens_str = os.getenv("TELEGRAM_BOT_TOKENS", "")
            if not tokens_str:
                raise ValueError("No bot tokens found in environment variables")
            cls._bot_tokens = [token.strip() for token in tokens_str.split(",")]
        return cls._bot_tokens

    @classmethod
    def get_next_bot_token(cls) -> str:
        """Get the next bot token from the pool"""
        tokens = cls.get_bot_tokens()
        if not tokens:
            raise ValueError("No bot tokens available")
        
        token = tokens[cls._current_token_index]
        cls._current_token_index = (cls._current_token_index + 1) % len(tokens)
        return token

    def __init__(
        self,
        api_id: str,
        api_hash: str,
        phone: Optional[str] = None,
        bot_token: Optional[str] = None,
        session_string: Optional[str] = None,
    ):
        self.api_id = api_id
        self.api_hash = api_hash
        self.phone = phone
        self.bot_token = bot_token or self.get_next_bot_token()
        self.session_string = session_string
        self.client = None

    async def _connect(self) -> None:
        """Connect to Telegram API using session string or bot token"""
        if self.session_string:
            # Use session string if available
            self.client = TelegramClient(
                StringSession(self.session_string),
                int(self.api_id),
                self.api_hash
            )
            await self.client.start()
        else:
            # Fallback to bot token
            session_name = f"bot_session_{self.bot_token.split(':')[0]}"
            self.client = TelegramClient(session_name, int(self.api_id), self.api_hash)
            await self.client.start(bot_token=self.bot_token)

    async def _disconnect(self) -> None:
        """Disconnect from Telegram API"""
        if self.client:
            await self.client.disconnect()

    async def _extract_group_id(self, group_link: str) -> str:
        """Extract group ID or username from link"""
        # Handle t.me links
        if "t.me/" in group_link:
            username = group_link.split("t.me/")[1].split("/")[0].split("?")[0]
            return username
        
        # Handle direct links with @
        if group_link.startswith("@"):
            return group_link[1:]
        
        # Handle direct usernames
        return group_link

    async def _get_group_entity(self, group_identifier: str) -> Tuple[Any, bool]:
        """Get group entity from identifier"""
        try:
            # Try to get by username
            entity = await self.client.get_entity(group_identifier)
            return entity, True
        except ValueError:
            try:
                # Try to get by ID
                if group_identifier.isdigit():
                    entity = await self.client.get_entity(int(group_identifier))
                    return entity, True
            except:
                pass
        
        # If we're here, we couldn't find the group directly
        # Try to search in dialogs
        result = await self.client(GetDialogsRequest(
            offset_date=None,
            offset_id=0,
            offset_peer=InputPeerEmpty(),
            limit=100,
            hash=0
        ))
        
        for dialog in result.dialogs:
            try:
                dialog_entity = dialog.entity
                if hasattr(dialog_entity, 'username') and dialog_entity.username == group_identifier:
                    return dialog_entity, True
                if hasattr(dialog_entity, 'id') and str(dialog_entity.id) == group_identifier:
                    return dialog_entity, True
            except:
                continue
        
        return None, False

    async def _get_group_members(self, group_entity: Channel) -> List[Dict[str, Any]]:
        """Get all members of a group."""
        members = []
        admins = set()
        
        try:
            print("\n" + "="*50)
            print("STARTING GROUP MEMBER PARSING")
            print("="*50)
            
            # Get admin list first
            print("\nGetting admin list...")
            async for admin in self.client.iter_participants(group_entity, filter=ChannelParticipantsAdmins):
                admins.add(admin.id)
            print(f"Found {len(admins)} admins")
            
            # Get all members
            member_count = 0
            print("\nGetting all members...")
            async for member in self.client.iter_participants(group_entity):
                if isinstance(member, TelegramUser):
                    member_count += 1
                    print("\n" + "-"*30)
                    print(f"MEMBER #{member_count}")
                    print(f"ID: {member.id}")
                    print(f"Username: {member.username}")
                    print(f"Premium: {getattr(member, 'premium', None)}")
                    print(f"Premium Type: {type(getattr(member, 'premium', None))}")
                    print("Available attributes:")
                    for attr in dir(member):
                        if not attr.startswith('_'):
                            try:
                                value = getattr(member, attr)
                                print(f"  {attr}: {value}")
                            except:
                                continue
                    
                    member_data = {
                        "user_id": str(member.id),
                        "username": member.username,
                        "first_name": member.first_name,
                        "last_name": member.last_name,
                        "phone": getattr(member, 'phone', None),
                        "is_bot": member.bot,
                        "is_admin": member.id in admins,
                        "is_premium": bool(getattr(member, 'premium', False))
                    }
                    print(f"\nProcessed data: {member_data}")
                    members.append(member_data)
            
            print("\n" + "="*50)
            print(f"FINISHED PARSING {member_count} MEMBERS")
            print("="*50 + "\n")
            
        except Exception as e:
            print(f"\nERROR getting members: {str(e)}")
            print(f"Error type: {type(e)}")
            raise
        
        return members

    async def parse_group(self, db: Session, group_link: str, user_id: int) -> ParsedGroup:
        """Parse a Telegram group and save to database"""
        last_error = None
        bot_tokens = self.get_bot_tokens()
        
        # Try each bot token until one works
        for _ in range(len(bot_tokens)):
            try:
                await self._connect()
                
                # Extract group ID or username
                group_identifier = await self._extract_group_id(group_link)
                
                # Get group entity
                group_entity, success = await self._get_group_entity(group_identifier)
                if not success or not group_entity:
                    raise ValueError(f"Could not find group with identifier: {group_identifier}")
                
                # Check if it's a channel/group
                if not isinstance(group_entity, Channel):
                    raise ValueError("The provided link is not a Telegram group or channel")
                
                # Get full channel info
                full_channel = await self.client(GetFullChannelRequest(channel=group_entity))
                
                # Create group in database
                group_data = ParsedGroupCreate(
                    group_id=str(group_entity.id),
                    group_name=group_entity.title,
                    group_username=group_entity.username,
                    member_count=full_channel.full_chat.participants_count,
                    is_public=group_entity.username is not None,
                )
                
                # Check if group already exists for this user
                existing_group = crud.telegram.get_group_by_telegram_id(
                    db, telegram_group_id=str(group_entity.id), user_id=user_id
                )
                
                if existing_group:
                    # Delete existing group and its members
                    crud.telegram.delete_group(db, group_id=existing_group.id)
                
                # Create new group
                db_group = crud.telegram.create_group(db, obj_in=group_data, user_id=user_id)
                
                # Get and save members
                members = await self._get_group_members(group_entity)
                member_objects = []
                
                for member in members:
                    member_data = GroupMemberCreate(
                        group_id=db_group.id,
                        user_id=member["user_id"],
                        username=member["username"],
                        first_name=member["first_name"],
                        last_name=member["last_name"],
                        is_bot=member["is_bot"],
                        is_admin=member["is_admin"],
                        is_premium=member["is_premium"]
                    )
                    member_objects.append(member_data)
                
                # Bulk create members
                if member_objects:
                    crud.telegram.create_members_bulk(db, members=member_objects)
                
                # Refresh group to include members
                db_group = crud.telegram.get_group_by_id(db, group_id=db_group.id)
                
                return db_group
            
            except (FloodWaitError, UserDeactivatedBanError) as e:
                last_error = e
                # Try the next bot token
                self.bot_token = self.get_next_bot_token()
            except Exception as e:
                last_error = e
                break
            finally:
                await self._disconnect()
        
        if last_error:
            raise last_error
        return None 

    async def _get_channel_posts(self, channel_entity: Channel, limit: int = 100) -> List[Dict[str, Any]]:
        """Get posts from a channel"""
        posts = []
        try:
            async for message in self.client.iter_messages(channel_entity, limit=limit):
                if not isinstance(message, Message):
                    continue
                posts.append(message.id)
        except Exception as e:
            print(f"Error getting channel posts: {e}")
            raise
        return posts

    async def _get_commenters_info(self, channel_entity: Channel, message_id: int) -> List[Dict[str, Any]]:
        """Get unique commenters information"""
        commenters = {}
        try:
            async for reply in self.client.iter_messages(channel_entity, reply_to=message_id):
                if not reply or not reply.sender:
                    continue
                
                try:
                    sender = await reply.get_sender()
                    if isinstance(sender, TelegramUser):
                        # Store unique users by their ID
                        commenters[str(sender.id)] = {
                            "user_id": str(sender.id),
                            "username": getattr(sender, "username", None),
                            "first_name": getattr(sender, "first_name", None),
                            "last_name": getattr(sender, "last_name", None),
                            "is_bot": getattr(sender, "bot", False),
                            "is_premium": getattr(sender, "premium", False)
                        }
                except Exception as e:
                    print(f"Error getting commenter info: {e}")
                    continue
                
        except Exception as e:
            print(f"Error getting post commenters: {e}")
            raise
        
        return list(commenters.values())

    async def parse_channel(self, db: Session, channel_link: str, user_id: int, post_limit: int = 100) -> ParsedGroup:
        """Parse a Telegram channel and extract commenters information"""
        try:
            # Try to get an active session for the user
            session = db.query(TelegramSession).filter(
                TelegramSession.user_id == user_id,
                TelegramSession.is_active == True,
                TelegramSession.session_string.isnot(None)
            ).first()

            if not session:
                raise ValueError("No active Telegram session found. Please add a session first.")

            # Use the session string
            self.session_string = session.session_string
            self.bot_token = None  # Don't use bot token when we have a session
            
            await self._connect()
            
            # Extract channel ID from link
            channel_id = await self._extract_group_id(channel_link)
            
            # Check if channel was already parsed
            existing_group = crud.telegram.get_group_by_telegram_id(db, channel_id, user_id)
            if existing_group:
                return existing_group
            
            # Get channel entity
            channel_entity, is_channel = await self._get_group_entity(channel_id)
            if not is_channel or not isinstance(channel_entity, Channel):
                raise ValueError("The provided link is not a channel")
            
            # Get full channel info
            full_channel = await self.client(GetFullChannelRequest(channel=channel_entity))
            
            # Create group record
            group_data = ParsedGroupCreate(
                group_id=str(channel_entity.id),
                group_name=channel_entity.title,
                group_username=channel_entity.username,
                member_count=full_channel.full_chat.participants_count,
                is_public=not getattr(channel_entity, "restricted", False),
                is_channel=True  # Set this to True for channels
            )
            group = crud.telegram.create_group(db, obj_in=group_data, user_id=user_id)
            
            try:
                # Get post IDs
                post_ids = await self._get_channel_posts(channel_entity, limit=post_limit)
                
                # Get unique commenters from all posts
                all_commenters = {}
                for post_id in post_ids:
                    try:
                        commenters = await self._get_commenters_info(channel_entity, post_id)
                        for commenter in commenters:
                            all_commenters[commenter["user_id"]] = commenter
                    except Exception as e:
                        print(f"Error getting comments for post {post_id}: {e}")
                        continue  # Skip this post and continue with others
                
                # Create member objects for unique commenters
                member_objects = []
                for commenter in all_commenters.values():
                    member_data = GroupMemberCreate(
                        group_id=group.id,
                        user_id=commenter["user_id"],
                        username=commenter["username"],
                        first_name=commenter["first_name"],
                        last_name=commenter["last_name"],
                        is_bot=commenter["is_bot"],
                        is_premium=commenter.get("is_premium", False)
                    )
                    member_objects.append(member_data)
                
                # Bulk create members
                if member_objects:
                    crud.telegram.create_members_bulk(db, members=member_objects)
            except Exception as e:
                print(f"Error processing posts and comments: {e}")
                # Don't raise the error - we still want to return the channel even if we can't get comments
            
            # Refresh the group to include any members that were added
            group = crud.telegram.get_group_by_id(db, group_id=group.id)
            return group
            
        except Exception as e:
            print(f"Error parsing channel: {e}")
            raise
        finally:
            await self._disconnect() 