from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, Table
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    telegram_tokens = relationship("TelegramToken", back_populates="user")
    parsed_groups = relationship("ParsedGroup", back_populates="user")


class TelegramToken(Base):
    __tablename__ = "telegram_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    api_id = Column(String)
    api_hash = Column(String)
    phone = Column(String, nullable=True)
    bot_token = Column(String, nullable=True)
    session_string = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="telegram_tokens")


class ParsedGroup(Base):
    __tablename__ = "parsed_groups"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    group_id = Column(String, index=True)
    group_name = Column(String)
    group_username = Column(String, nullable=True)
    member_count = Column(Integer, default=0)
    is_public = Column(Boolean, default=True)
    parsed_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="parsed_groups")
    members = relationship("GroupMember", back_populates="group")


class GroupMember(Base):
    __tablename__ = "group_members"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("parsed_groups.id"))
    user_id = Column(String, index=True)
    username = Column(String, nullable=True)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    is_bot = Column(Boolean, default=False)
    is_admin = Column(Boolean, default=False)
    
    # Relationships
    group = relationship("ParsedGroup", back_populates="members") 