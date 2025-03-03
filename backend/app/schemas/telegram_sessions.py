from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class TelegramSessionBase(BaseModel):
    phone: str
    session_string: Optional[str] = None

class TelegramSessionCreate(TelegramSessionBase):
    pass

class TelegramSessionUpdate(BaseModel):
    is_active: bool

class TelegramSessionResponse(TelegramSessionBase):
    id: int
    user_id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True 