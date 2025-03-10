from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, EmailStr


# Shared properties
class UserBase(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    is_active: Optional[bool] = True
    is_superuser: bool = False
    can_parse: bool = False
    parse_permission_expires: Optional[datetime] = None


# Properties to receive via API on creation
class UserCreate(UserBase):
    email: EmailStr
    username: str
    password: str


# Properties to receive via API on update
class UserUpdate(UserBase):
    password: Optional[str] = None
    can_parse: Optional[bool] = None
    parse_permission_expires: Optional[datetime] = None


class UserInDBBase(UserBase):
    id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    last_visit: Optional[datetime] = None

    class Config:
        from_attributes = True


# Additional properties to return via API
class User(UserInDBBase):
    pass


# Additional properties stored in DB
class UserInDB(UserInDBBase):
    hashed_password: str


class PaginatedUsers(BaseModel):
    data: List[User]
    total: int

    class Config:
        from_attributes = True 