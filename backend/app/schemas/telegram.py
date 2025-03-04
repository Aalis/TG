from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from pydantic import validator


class TelegramTokenBase(BaseModel):
    api_id: Optional[str] = None
    api_hash: Optional[str] = None
    phone: Optional[str] = None
    bot_token: Optional[str] = None


class TelegramTokenCreate(TelegramTokenBase):
    api_id: str
    api_hash: str


class TelegramTokenUpdate(TelegramTokenBase):
    pass


class TelegramTokenInDBBase(TelegramTokenBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TelegramToken(TelegramTokenInDBBase):
    pass


class GroupMemberBase(BaseModel):
    user_id: str
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    is_bot: bool = False
    is_admin: bool = False
    is_premium: bool = False


class GroupMemberCreate(GroupMemberBase):
    group_id: int


class GroupMember(GroupMemberBase):
    id: int
    group_id: int

    class Config:
        from_attributes = True


class ParsedGroupBase(BaseModel):
    group_id: str
    group_name: str
    group_username: Optional[str] = None
    member_count: int = 0
    is_public: bool = True
    is_channel: bool = False


class ParsedGroupCreate(ParsedGroupBase):
    pass


class ParsedGroup(ParsedGroupBase):
    id: int
    user_id: int
    parsed_at: datetime
    members: List[GroupMember] = []

    class Config:
        from_attributes = True


class GroupParseRequest(BaseModel):
    group_link: str
    scan_comments: bool = False  # Whether to scan comments for additional users
    comment_limit: Optional[int] = 100  # Default to 100 comments if not specified

    @validator('comment_limit')
    def validate_comment_limit(cls, v):
        if v not in [100, 1000, 5000]:
            raise ValueError('Comment limit must be either 100, 1000, or 5000')
        return v


class GroupParseResponse(BaseModel):
    success: bool
    message: str
    group: Optional[ParsedGroup] = None


class PostCommentBase(BaseModel):
    user_id: str
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    message: str
    replied_to_id: Optional[int] = None
    commented_at: datetime


class PostCommentCreate(PostCommentBase):
    post_id: int


class PostComment(PostCommentBase):
    id: int
    post_id: int
    parsed_at: datetime
    replies: List['PostComment'] = []

    class Config:
        from_attributes = True


class ChannelPostBase(BaseModel):
    post_id: str
    message: str
    views: int = 0
    forwards: int = 0
    replies: int = 0
    posted_at: datetime


class ChannelPostCreate(ChannelPostBase):
    group_id: int


class ChannelPost(ChannelPostBase):
    id: int
    group_id: int
    parsed_at: datetime
    comments: List[PostComment] = []

    class Config:
        from_attributes = True


class ChannelParseRequest(BaseModel):
    channel_link: str
    post_limit: int = 100  # Default to 100 posts if not specified

    @validator('post_limit')
    def validate_post_limit(cls, v):
        if v <= 0:
            raise ValueError('post_limit must be greater than 0')
        if v > 100:
            raise ValueError('post_limit cannot exceed 100')
        return v


class ChannelParseResponse(BaseModel):
    success: bool
    message: str
    group: Optional[ParsedGroup] = None


class ParsingProgressResponse(BaseModel):
    """Schema for parsing progress response"""
    is_parsing: bool
    phase: str
    progress: float
    message: str
    total_members: int
    current_members: int


class DialogResponse(BaseModel):
    id: str
    title: str
    username: Optional[str] = None
    type: str
    members_count: int = 0
    is_public: bool = True 