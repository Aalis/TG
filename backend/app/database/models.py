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
    can_parse = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_visit = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships with cascade deletion
    telegram_tokens = relationship("TelegramToken", back_populates="user", cascade="all, delete-orphan")
    parsed_groups = relationship("ParsedGroup", back_populates="user", cascade="all, delete-orphan")
    telegram_sessions = relationship("TelegramSession", back_populates="user", cascade="all, delete-orphan")


class TelegramToken(Base):
    __tablename__ = "telegram_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
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
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    group_id = Column(String, index=True)
    group_name = Column(String)
    group_username = Column(String, nullable=True)
    member_count = Column(Integer, default=0)
    is_public = Column(Boolean, default=True)
    is_channel = Column(Boolean, default=False)
    parsed_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships with cascade deletion
    user = relationship("User", back_populates="parsed_groups")
    members = relationship("GroupMember", back_populates="group", cascade="all, delete-orphan")
    posts = relationship("ChannelPost", back_populates="group", cascade="all, delete-orphan")


class GroupMember(Base):
    __tablename__ = "group_members"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("parsed_groups.id", ondelete="CASCADE"))
    user_id = Column(String, index=True)
    username = Column(String, nullable=True)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    is_bot = Column(Boolean, default=False)
    is_admin = Column(Boolean, default=False)
    is_premium = Column(Boolean, default=False)
    
    # Relationships
    group = relationship("ParsedGroup", back_populates="members")


class TelegramSession(Base):
    __tablename__ = "telegram_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    phone = Column(String)
    session_string = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="telegram_sessions")


class ChannelPost(Base):
    __tablename__ = "channel_posts"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("parsed_groups.id", ondelete="CASCADE"))
    post_id = Column(String, index=True)
    message = Column(Text)
    views = Column(Integer, default=0)
    forwards = Column(Integer, default=0)
    replies = Column(Integer, default=0)
    posted_at = Column(DateTime(timezone=True))
    parsed_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships with cascade deletion
    group = relationship("ParsedGroup", back_populates="posts")
    comments = relationship("PostComment", back_populates="post", cascade="all, delete-orphan")


class PostComment(Base):
    __tablename__ = "post_comments"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("channel_posts.id", ondelete="CASCADE"))
    user_id = Column(String, index=True)
    username = Column(String, nullable=True)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    message = Column(Text)
    replied_to_id = Column(Integer, ForeignKey("post_comments.id", ondelete="SET NULL"), nullable=True)
    commented_at = Column(DateTime(timezone=True))
    parsed_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    post = relationship("ChannelPost", back_populates="comments")
    replied_to = relationship("PostComment", remote_side=[id], backref="replies") 