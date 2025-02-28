from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime


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
        orm_mode = True


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
        orm_mode = True


class ParsedGroupBase(BaseModel):
    group_id: str
    group_name: str
    group_username: Optional[str] = None
    member_count: int = 0
    is_public: bool = True


class ParsedGroupCreate(ParsedGroupBase):
    pass


class ParsedGroup(ParsedGroupBase):
    id: int
    user_id: int
    parsed_at: datetime
    members: List[GroupMember] = []

    class Config:
        orm_mode = True


class GroupParseRequest(BaseModel):
    group_link: str


class GroupParseResponse(BaseModel):
    success: bool
    message: str
    group: Optional[ParsedGroup] = None 