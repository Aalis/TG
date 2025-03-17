import re
import os
import random
import json
from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime
import logging
import asyncio
from dataclasses import dataclass, asdict

from fastapi import HTTPException
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


@dataclass
class ParsingProgress:
    """Class to track parsing progress"""
    total_members: int = 0
    current_members: int = 0
    current_phase: str = "initializing"
    phase_progress: float = 0
    status_message: str = "Starting..."
    is_cancelled: bool = False
    current_group_id: Optional[int] = None


class TelegramParserService:
    _bot_tokens = None
    _current_token_index = 0
    _progress_file = "/tmp/telegram_parser_progress.json"

    @classmethod
    def get_progress(cls) -> Optional[ParsingProgress]:
        """Get current parsing progress"""
        try:
            if os.path.exists(cls._progress_file):
                with open(cls._progress_file, 'r') as f:
                    data = json.load(f)
                    progress = ParsingProgress(**data)
                    return progress
            return None
        except Exception as e:
            logging.error(f"Error reading progress file: {e}")
            return None

    @classmethod
    def cancel_parsing(cls) -> None:
        """Cancel the current parsing operation"""
        progress = cls.get_progress() or ParsingProgress()
        progress.is_cancelled = True
        progress.current_phase = "cancelled"
        progress.status_message = "Parsing cancelled by user"
        cls._save_progress(progress)

    @classmethod
    def _update_progress(cls, phase: str, current: int = 0, total: int = 0, message: str = "") -> None:
        """Update parsing progress"""
        progress = cls.get_progress() or ParsingProgress()
        
        progress.current_phase = phase
        if total > 0:
            progress.total_members = total
        if current >= 0:
            progress.current_members = current
        if message:
            progress.status_message = message
        
        if total > 0:
            progress.phase_progress = (current / total) * 100
            
        cls._save_progress(progress)

    @classmethod
    def _save_progress(cls, progress: ParsingProgress) -> None:
        """Save progress to file"""
        try:
            with open(cls._progress_file, 'w') as f:
                json.dump(asdict(progress), f)
        except Exception as e:
            logging.error(f"Error saving progress file: {e}")

    @classmethod
    def _reset_progress(cls) -> None:
        """Reset parsing progress"""
        progress = cls.get_progress()
        if progress and progress.current_phase == "cancelled":
            # If we're in cancelled state, keep the message visible briefly
            asyncio.create_task(cls._delayed_reset())
        else:
            if os.path.exists(cls._progress_file):
                try:
                    os.remove(cls._progress_file)
                except Exception as e:
                    logging.error(f"Error removing progress file: {e}")

    @classmethod
    async def _delayed_reset(cls) -> None:
        """Reset progress after a short delay to ensure cancelled message is visible"""
        await asyncio.sleep(2)  # Keep cancelled message visible for 2 seconds
        if os.path.exists(cls._progress_file):
            try:
                os.remove(cls._progress_file)
            except Exception as e:
                logging.error(f"Error removing progress file: {e}")

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
        self.bot_token = bot_token
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
        elif self.bot_token:
            # Fallback to bot token
            session_name = f"bot_session_{self.bot_token.split(':')[0]}"
            self.client = TelegramClient(session_name, int(self.api_id), self.api_hash)
            await self.client.start(bot_token=self.bot_token)
        else:
            # No credentials provided
            raise ValueError("Either session_string or bot_token must be provided")

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
            # Check if it's a channel/group
            is_channel = isinstance(entity, Channel) and getattr(entity, 'broadcast', False)
            return entity, is_channel
        except ValueError:
            try:
                # Try to get by ID
                if group_identifier.isdigit():
                    entity = await self.client.get_entity(int(group_identifier))
                    is_channel = isinstance(entity, Channel) and getattr(entity, 'broadcast', False)
                    return entity, is_channel
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
                    is_channel = isinstance(dialog_entity, Channel) and getattr(dialog_entity, 'broadcast', False)
                    return dialog_entity, is_channel
                if hasattr(dialog_entity, 'id') and str(dialog_entity.id) == group_identifier:
                    is_channel = isinstance(dialog_entity, Channel) and getattr(dialog_entity, 'broadcast', False)
                    return dialog_entity, is_channel
            except:
                continue
        
        return None, False

    async def _get_group_members(self, group_entity: Channel) -> List[Dict[str, Any]]:
        """Get all members of a group."""
        members = []
        admins = set()
        
        try:
            # Check for cancellation before starting
            progress = self.__class__.get_progress()
            if progress and progress.is_cancelled:
                raise ValueError("Parsing cancelled by user")

            self.__class__._update_progress("admins", message="Getting admin list...")
            try:
                async for admin in self.client.iter_participants(group_entity, filter=ChannelParticipantsAdmins):
                    # Check for cancellation
                    progress = self.__class__.get_progress()
                    if progress and progress.is_cancelled:
                        raise ValueError("Parsing cancelled by user")
                    admins.add(admin.id)
            except Exception as e:
                progress = self.__class__.get_progress()
                if progress and progress.is_cancelled:
                    raise ValueError("Parsing cancelled by user")
                raise e

            self.__class__._update_progress("admins", message=f"Found {len(admins)} admins")
            
            # Get total member count for progress tracking
            progress = self.__class__.get_progress()
            if progress and progress.is_cancelled:
                raise ValueError("Parsing cancelled by user")

            full_channel = await self.client(GetFullChannelRequest(channel=group_entity))
            total_members = full_channel.full_chat.participants_count
            self.__class__._update_progress("members", total=total_members, message=f"Found {total_members} total members")
            
            # Check for cancellation before starting member iteration
            progress = self.__class__.get_progress()
            if progress and progress.is_cancelled:
                raise ValueError("Parsing cancelled by user")

            # Get all members
            member_count = 0
            
            try:
                participant_iter = self.client.iter_participants(group_entity)
                while True:
                    try:
                        progress = self.__class__.get_progress()
                        if progress and progress.is_cancelled:
                            raise ValueError("Parsing cancelled by user")
                        
                        member = await participant_iter.__anext__()
                        if isinstance(member, TelegramUser):
                            member_count += 1
                            self.__class__._update_progress("members", current=member_count, total=total_members, 
                                                message=f"Processing member {member_count}/{total_members}")
                            
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
                            members.append(member_data)

                            # Check for cancellation after processing each member
                            progress = self.__class__.get_progress()
                            if progress and progress.is_cancelled:
                                raise ValueError("Parsing cancelled by user")
                    except StopAsyncIteration:
                        break
                    except ValueError as e:
                        if str(e) == "Parsing cancelled by user":
                            raise
                        raise ValueError(f"Error processing members: {str(e)}")
                    except Exception as e:
                        self.__class__._update_progress("error", message=f"Error processing member: {str(e)}")
                        continue  # Skip this member and continue with others
            except ValueError as e:
                if str(e) == "Parsing cancelled by user":
                    raise
                raise ValueError(f"Error getting members: {str(e)}")
            
            return members
        except Exception as e:
            if str(e) == "Parsing cancelled by user":
                raise
            raise ValueError(f"Error getting group members: {str(e)}")

    async def _get_comment_users(self, group_entity: Channel, limit: int = 100) -> List[Dict[str, Any]]:
        """Get unique users from recent comments in the group"""
        try:
            users = {}
            self.__class__._update_progress("comments", message="Starting comment analysis...")
            
            message_count = 0
            async for message in self.client.iter_messages(group_entity, limit=limit):
                # Check for cancellation
                progress = self.__class__.get_progress()
                if progress and progress.is_cancelled:
                    raise ValueError("Parsing cancelled by user")

                message_count += 1
                self.__class__._update_progress("comments", current=message_count, total=limit,
                                    message=f"Analyzing message {message_count}/{limit}")
                
                if message.sender_id:
                    try:
                        if str(message.sender_id) not in users:
                            sender = message.sender
                            if sender and isinstance(sender, TelegramUser):
                                users[str(sender.id)] = {
                                    'user_id': str(sender.id),
                                    'username': sender.username,
                                    'first_name': sender.first_name,
                                    'last_name': sender.last_name,
                                    'is_premium': bool(getattr(sender, 'premium', False))
                                }
                    except Exception as e:
                        logging.error(f"Error getting user info from message {message_count}: {e}")
                        continue
            
            self.__class__._update_progress("comments", current=limit, total=limit,
                                message=f"Found {len(users)} unique users from {message_count} messages")
            
            return list(users.values())
        except ValueError as e:
            # Re-raise cancellation error
            if str(e) == "Parsing cancelled by user":
                raise
            self.__class__._update_progress("error", message=f"Error scanning comments: {str(e)}")
            return []
        except Exception as e:
            self.__class__._update_progress("error", message=f"Error scanning comments: {str(e)}")
            return []

    async def parse_group(self, db: Session, group_link: str, user_id: int, scan_comments: bool = False, comment_limit: int = 100) -> ParsedGroup:
        """Parse a Telegram group/chat and store its information"""
        group = None
        try:
            self.__class__._reset_progress()
            self.__class__._update_progress("initialization", message="Initializing chat parsing...")

            # Get active session
            session = db.query(TelegramSession).filter(
                TelegramSession.user_id == user_id,
                TelegramSession.is_active == True,
                TelegramSession.session_string.isnot(None)
            ).first()

            if not session:
                raise ValueError("No active Telegram session found. Please add a session first.")

            # Always use session for all operations
            self.session_string = session.session_string
            self.bot_token = None

            self.__class__._update_progress("connecting", message="Connecting to Telegram...")
            await self._connect()
            
            # Check for cancellation
            progress = self.__class__.get_progress()
            if progress and progress.is_cancelled:
                raise ValueError("Parsing cancelled by user")
            
            # Chat validation
            self.__class__._update_progress("validation", message="Validating chat...")
            
            try:
                # Handle numeric IDs (from dialog list) and links differently
                if group_link.lstrip('-').isdigit():
                    # Direct numeric ID from dialog list
                    chat_entity = await self.client.get_entity(int(group_link))
                else:
                    # Handle links and usernames
                    chat_id = await self._extract_group_id(group_link)
                    chat_entity = await self.client.get_entity(chat_id)
                
                if not chat_entity:
                    raise ValueError("Could not find the chat")
                
            except ValueError as e:
                # Try to get from dialogs if direct lookup fails
                try:
                    result = await self.client(GetDialogsRequest(
                        offset_date=None,
                        offset_id=0,
                        offset_peer=InputPeerEmpty(),
                        limit=100,
                        hash=0
                    ))
                    
                    for dialog in result.dialogs:
                        # Check for cancellation
                        progress = self.__class__.get_progress()
                        if progress and progress.is_cancelled:
                            raise ValueError("Parsing cancelled by user")
                            
                        peer = dialog.peer
                        if (hasattr(peer, 'user_id') and str(peer.user_id) == group_link.lstrip('-')) or \
                           (hasattr(peer, 'channel_id') and str(peer.channel_id) == group_link.lstrip('-')) or \
                           (hasattr(peer, 'chat_id') and str(peer.chat_id) == group_link.lstrip('-')):
                            # Found the chat in dialogs
                            chat_entity = await self.client.get_entity(peer)
                            if chat_entity:
                                break
                    else:
                        raise ValueError("Could not find the chat. Please check the ID/link and try again.")
                except Exception as inner_e:
                    raise ValueError(f"Error accessing chat: {str(inner_e)}")
            except Exception as e:
                raise ValueError(f"Error accessing chat: {str(e)}")
            
            # Get chat info
            self.__class__._update_progress("info", message="Getting chat information...")
            try:
                # For channels/groups
                if isinstance(chat_entity, Channel):
                    full_chat = await self.client(GetFullChannelRequest(channel=chat_entity))
                    member_count = full_chat.full_chat.participants_count
                    is_channel = getattr(chat_entity, 'broadcast', False)
                else:
                    # For user chats or other types
                    member_count = 2  # User chat has 2 members
                    is_channel = False
            except Exception as e:
                logging.error(f"Error getting full chat info: {e}")
                member_count = 0
            
            # Check for cancellation
            progress = self.__class__.get_progress()
            if progress and progress.is_cancelled:
                raise ValueError("Parsing cancelled by user")
            
            # Create chat record
            self.__class__._update_progress("database", message="Creating chat record...")
            group_data = ParsedGroupCreate(
                group_id=str(chat_entity.id),
                group_name=getattr(chat_entity, 'title', None) or f"Chat with {getattr(chat_entity, 'first_name', '')} {getattr(chat_entity, 'last_name', '')}".strip(),
                group_username=getattr(chat_entity, 'username', None),
                member_count=member_count,
                is_public=not getattr(chat_entity, 'restricted', False),
                is_channel=is_channel
            )
            
            group = crud.telegram.create_group(db, obj_in=group_data, user_id=user_id)
            
            # Update progress with group ID
            progress = self.__class__.get_progress() or ParsingProgress()
            progress.current_group_id = group.id
            self.__class__._save_progress(progress)
            
            try:
                members = []
                if scan_comments:
                    self.__class__._update_progress("scanning", message="Starting message scanning...")
                    members = await self._get_comment_users(chat_entity, comment_limit)
                else:
                    self.__class__._update_progress("scanning", message="Starting member scanning...")
                    if isinstance(chat_entity, Channel):
                        members = await self._get_group_members(chat_entity)
                    else:
                        # For user chats, add both participants
                        members = [{
                            "user_id": str(chat_entity.id),
                            "username": getattr(chat_entity, 'username', None),
                            "first_name": getattr(chat_entity, 'first_name', None),
                            "last_name": getattr(chat_entity, 'last_name', None),
                            "is_bot": getattr(chat_entity, 'bot', False),
                            "is_premium": bool(getattr(chat_entity, 'premium', False))
                        }]
                        # Add the current user if different
                        me = await self.client.get_me()
                        if str(me.id) != str(chat_entity.id):
                            members.append({
                                "user_id": str(me.id),
                                "username": getattr(me, 'username', None),
                                "first_name": getattr(me, 'first_name', None),
                                "last_name": getattr(me, 'last_name', None),
                                "is_bot": getattr(me, 'bot', False),
                                "is_premium": bool(getattr(me, 'premium', False))
                            })
                
                # Check for cancellation after getting members
                progress = self.__class__.get_progress()
                if progress and progress.is_cancelled:
                    raise ValueError("Parsing cancelled by user")
                
                # Process members
                self.__class__._update_progress("processing", message="Processing member data...")
                member_objects = []
                for idx, member in enumerate(members, 1):
                    # Check for cancellation
                    progress = self.__class__.get_progress()
                    if progress and progress.is_cancelled:
                        raise ValueError("Parsing cancelled by user")
                        
                    self.__class__._update_progress("processing", current=idx, total=len(members),
                                        message=f"Processing member data {idx}/{len(members)}")
                    member_data = GroupMemberCreate(
                        group_id=group.id,
                        user_id=member['user_id'],
                        username=member.get('username'),
                        first_name=member.get('first_name'),
                        last_name=member.get('last_name'),
                        is_bot=member.get('is_bot', False),
                        is_admin=member.get('is_admin', False),
                        is_premium=member.get('is_premium', False)
                    )
                    member_objects.append(member_data)
                
                # Check for cancellation before saving
                progress = self.__class__.get_progress()
                if progress and progress.is_cancelled:
                    raise ValueError("Parsing cancelled by user")
                
                # Save members
                if member_objects:
                    self.__class__._update_progress("saving", message="Saving member data to database...")
                    crud.telegram.create_members_bulk(db, members=member_objects)
                
                # Don't update the member_count here as it should reflect the total from Telegram
                # group.member_count = len(member_objects)
                db.commit()
                
                self.__class__._update_progress("completed", message="Chat parsing completed successfully")
                
            except Exception as e:
                progress = self.__class__.get_progress()
                if progress and progress.is_cancelled:
                    # Delete the partially created group if cancelled
                    if group and group.id:
                        crud.telegram.delete_group(db, group_id=group.id)
                    raise ValueError("Parsing cancelled by user")
                self.__class__._update_progress("error", message=f"Error processing members: {str(e)}")
                raise
            
            progress = self.__class__.get_progress()
            if progress and progress.is_cancelled:
                # Delete the group if cancelled
                if group and group.id:
                    crud.telegram.delete_group(db, group_id=group.id)
                raise ValueError("Parsing cancelled by user")
            
            # Refresh and return group
            db.refresh(group)
            return group
            
        except Exception as e:
            error_msg = str(e)
            try:
                # Delete the group if it was created and we got an error or cancellation
                progress = self.__class__.get_progress()
                if progress and progress.is_cancelled and group and group.id:
                    try:
                        crud.telegram.delete_group(db, group_id=group.id)
                    except Exception as cleanup_error:
                        logging.error(f"Error during cleanup: {cleanup_error}")
            except Exception as cleanup_error:
                logging.error(f"Error during final cleanup: {cleanup_error}")
            
            # Update progress before disconnecting
            progress = self.__class__.get_progress()
            if progress and progress.is_cancelled:
                self.__class__._update_progress("cancelled", message="Parsing cancelled by user")
            else:
                self.__class__._update_progress("error", message=f"Error parsing chat: {error_msg}")
            
            raise HTTPException(
                status_code=400,
                detail=f"Error parsing chat: {error_msg}"
            )
        finally:
            await self._disconnect()

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
            self.__class__._reset_progress()
            self.__class__._update_progress("initialization", message="Initializing channel parsing...")

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
            
            self.__class__._update_progress("connecting", message="Connecting to Telegram...")
            await self._connect()
            
            # Check for cancellation
            progress = self.__class__.get_progress()
            if progress and progress.is_cancelled:
                raise ValueError("Parsing cancelled by user")
            
            # Channel validation
            self.__class__._update_progress("validation", message="Validating channel...")
            
            try:
                # Handle numeric IDs (from dialog list) and links differently
                if channel_link.lstrip('-').isdigit():
                    # Direct numeric ID from dialog list
                    channel_entity = await self.client.get_entity(int(channel_link))
                else:
                    # Handle links and usernames
                    channel_id = await self._extract_group_id(channel_link)
                    channel_entity = await self.client.get_entity(channel_id)
                
                if not channel_entity:
                    raise ValueError("Could not find the channel")
                
            except ValueError as e:
                # Try to get from dialogs if direct lookup fails
                try:
                    result = await self.client(GetDialogsRequest(
                        offset_date=None,
                        offset_id=0,
                        offset_peer=InputPeerEmpty(),
                        limit=100,
                        hash=0
                    ))
                    
                    for dialog in result.dialogs:
                        # Check for cancellation
                        progress = self.__class__.get_progress()
                        if progress and progress.is_cancelled:
                            raise ValueError("Parsing cancelled by user")
                            
                        peer = dialog.peer
                        if (hasattr(peer, 'channel_id') and str(peer.channel_id) == channel_link.lstrip('-')):
                            # Found the channel in dialogs
                            channel_entity = await self.client.get_entity(peer)
                            if channel_entity:
                                break
                    else:
                        raise ValueError("Could not find the channel. Please check the ID/link and try again.")
                except Exception as inner_e:
                    raise ValueError(f"Error accessing channel: {str(inner_e)}")
            except Exception as e:
                raise ValueError(f"Error accessing channel: {str(e)}")
            
            # Verify that this is actually a channel
            if not isinstance(channel_entity, Channel) or not getattr(channel_entity, 'broadcast', False):
                raise ValueError("The provided link is not a channel")
            
            # Get full channel info
            self.__class__._update_progress("info", message="Getting channel information...")
            full_channel = await self.client(GetFullChannelRequest(channel=channel_entity))
            
            # Check for cancellation
            progress = self.__class__.get_progress()
            if progress and progress.is_cancelled:
                raise ValueError("Parsing cancelled by user")
            
            # Create channel record
            self.__class__._update_progress("database", message="Creating channel record...")
            
            # Check if channel is truly public
            is_public = (
                bool(getattr(channel_entity, 'username', None)) and  # Has username
                not getattr(channel_entity, 'restricted', False) and  # Not restricted
                not getattr(channel_entity, 'private', False)  # Not private
            )
            
            group_data = ParsedGroupCreate(
                group_id=str(channel_entity.id),
                group_name=channel_entity.title,
                group_username=channel_entity.username,
                member_count=full_channel.full_chat.participants_count,
                is_public=is_public,
                is_channel=True  # Set this to True for channels
            )
            group = crud.telegram.create_group(db, obj_in=group_data, user_id=user_id)
            
            # Update progress with group ID
            progress = self.__class__.get_progress() or ParsingProgress()
            progress.current_group_id = group.id
            self.__class__._save_progress(progress)
            
            try:
                # Get post IDs
                self.__class__._update_progress("scanning", message=f"Getting channel posts (limit: {post_limit})...")
                post_ids = await self._get_channel_posts(channel_entity, limit=post_limit)
                self.__class__._update_progress("scanning", message=f"Found {len(post_ids)} posts")
                
                # Get unique commenters from all posts
                all_commenters = {}
                for idx, post_id in enumerate(post_ids, 1):
                    # Check for cancellation
                    progress = self.__class__.get_progress()
                    if progress and progress.is_cancelled:
                        raise ValueError("Parsing cancelled by user")
                        
                    try:
                        self.__class__._update_progress("processing", current=idx, total=len(post_ids),
                                            message=f"Processing post {idx}/{len(post_ids)}")
                        commenters = await self._get_commenters_info(channel_entity, post_id)
                        for commenter in commenters:
                            all_commenters[commenter["user_id"]] = commenter
                    except Exception as e:
                        print(f"Error getting comments for post {post_id}: {e}")
                        continue  # Skip this post and continue with others
                
                # Create member objects for unique commenters
                self.__class__._update_progress("saving", message=f"Saving {len(all_commenters)} unique commenters...")
                member_objects = []
                for commenter in all_commenters.values():
                    # Check for cancellation
                    progress = self.__class__.get_progress()
                    if progress and progress.is_cancelled:
                        raise ValueError("Parsing cancelled by user")
                        
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
                
                self.__class__._update_progress("completed", message="Channel parsing completed successfully")
            except Exception as e:
                progress = self.__class__.get_progress()
                if progress and progress.is_cancelled and progress.current_group_id:
                    # Delete the partially created group if cancelled
                    crud.telegram.delete_group(db, group_id=progress.current_group_id)
                    progress.current_group_id = None
                    raise ValueError("Parsing cancelled by user")
                self.__class__._update_progress("error", message=f"Error processing posts and comments: {str(e)}")
                print(f"Error processing posts and comments: {e}")
            
            progress = self.__class__.get_progress()
            if progress and progress.is_cancelled and progress.current_group_id:
                # Delete the group if cancelled
                crud.telegram.delete_group(db, group_id=progress.current_group_id)
                progress.current_group_id = None
            
            # Refresh the group to include any members that were added
            group = crud.telegram.get_group_by_id(db, group_id=group.id)
            return group
            
        except Exception as e:
            # Delete the group if it was created and we got an error or cancellation
            progress = self.__class__.get_progress()
            if progress and progress.is_cancelled and progress.current_group_id:
                crud.telegram.delete_group(db, group_id=progress.current_group_id)
                progress.current_group_id = None
            
            self.__class__._update_progress("error", message=f"Error parsing channel: {str(e)}")
            print(f"Error parsing channel: {e}")
            raise
        finally:
            # Clean up in case of any unexpected exits
            if progress and progress.is_cancelled and progress.current_group_id:
                try:
                    crud.telegram.delete_group(db, group_id=progress.current_group_id)
                except:
                    pass
            await self._disconnect()
            await asyncio.sleep(1)  # Give time for final progress update
            self.__class__._reset_progress()

    async def list_dialogs(self, db: Session, user_id: int) -> List[Dict[str, Any]]:
        """List all available dialogs (groups and channels) for the user"""
        try:
            # Get active session for the user
            session = db.query(TelegramSession).filter(
                TelegramSession.user_id == user_id,
                TelegramSession.is_active == True,
                TelegramSession.session_string.isnot(None)
            ).first()

            if not session:
                return []  # Return empty list instead of raising an error

            # Use the session string - NEVER use bot token for dialogs
            self.session_string = session.session_string
            self.bot_token = None  # Explicitly set to None to prevent bot token usage

            # Connect to Telegram
            await self._connect()

            # Get dialogs
            result = await self.client(GetDialogsRequest(
                offset_date=None,
                offset_id=0,
                offset_peer=InputPeerEmpty(),
                limit=100,
                hash=0
            ))

            dialogs = []
            for dialog in result.dialogs:
                try:
                    # Get the corresponding chat from the chats or users list
                    chat = None
                    peer = dialog.peer
                    
                    # Handle different peer types
                    if hasattr(peer, 'channel_id'):  # PeerChannel
                        for chat_entity in result.chats:
                            if hasattr(chat_entity, 'id') and chat_entity.id == peer.channel_id:
                                chat = chat_entity
                                break
                    elif hasattr(peer, 'chat_id'):  # PeerChat
                        for chat_entity in result.chats:
                            if hasattr(chat_entity, 'id') and chat_entity.id == peer.chat_id:
                                chat = chat_entity
                                break
                    elif hasattr(peer, 'user_id'):  # PeerUser
                        for user in result.users:
                            if user.id == peer.user_id:
                                chat = user
                                break
                    
                    if chat:  # Include all types of chats
                        # For user chats
                        if not hasattr(chat, 'title'):
                            name = f"{getattr(chat, 'first_name', '')} {getattr(chat, 'last_name', '')}".strip()
                            chat_type = 'user'
                            member_count = 2  # User chat always has 2 members
                            is_public = False  # User chats are always private
                        else:
                            name = chat.title
                            chat_type = 'channel' if getattr(chat, 'broadcast', False) else 'group'
                            try:
                                member_count = chat.participants_count
                            except AttributeError:
                                try:
                                    if chat_type == 'channel':
                                        full_chat = await self.client(GetFullChannelRequest(channel=chat))
                                        member_count = full_chat.full_chat.participants_count
                                    else:
                                        member_count = 0
                                except:
                                    member_count = 0
                            
                            # Check if channel/group is truly public
                            is_public = (
                                bool(getattr(chat, 'username', None)) and  # Has username
                                not getattr(chat, 'restricted', False) and  # Not restricted
                                not getattr(chat, 'private', False)  # Not private
                            )

                        dialog_data = {
                            'id': str(chat.id),
                            'title': name,
                            'username': getattr(chat, 'username', None),
                            'type': chat_type,
                            'members_count': member_count,
                            'is_public': is_public
                        }
                        dialogs.append(dialog_data)
                except Exception as e:
                    logging.error(f"Error processing dialog: {e}")
                    continue

            return dialogs

        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Error listing dialogs: {str(e)}"
            )
        finally:
            if self.client:
                await self._disconnect() 