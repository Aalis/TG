from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class TelegramSessionBase(BaseModel):
    phone_number: str

class TelegramSessionCreate(TelegramSessionBase):
    pass

class TelegramSessionUpdate(BaseModel):
    is_active: bool

class TelegramSessionResponse(TelegramSessionBase):
    id: int
    user_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True 