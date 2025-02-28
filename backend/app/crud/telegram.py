from typing import List, Optional, Union, Dict, Any

from sqlalchemy.orm import Session

from app.database.models import TelegramToken, ParsedGroup, GroupMember
from app.schemas.telegram import TelegramTokenCreate, TelegramTokenUpdate, ParsedGroupCreate, GroupMemberCreate


# Telegram Token CRUD
def get_token_by_id(db: Session, token_id: int) -> Optional[TelegramToken]:
    return db.query(TelegramToken).filter(TelegramToken.id == token_id).first()


def get_tokens_by_user(db: Session, user_id: int) -> List[TelegramToken]:
    return db.query(TelegramToken).filter(TelegramToken.user_id == user_id).all()


def create_token(db: Session, *, obj_in: TelegramTokenCreate, user_id: int) -> TelegramToken:
    db_obj = TelegramToken(
        user_id=user_id,
        api_id=obj_in.api_id,
        api_hash=obj_in.api_hash,
        phone=obj_in.phone,
        bot_token=obj_in.bot_token,
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def update_token(
    db: Session, *, db_obj: TelegramToken, obj_in: Union[TelegramTokenUpdate, Dict[str, Any]]
) -> TelegramToken:
    if isinstance(obj_in, dict):
        update_data = obj_in
    else:
        update_data = obj_in.dict(exclude_unset=True)
    for field in update_data:
        setattr(db_obj, field, update_data[field])
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def delete_token(db: Session, *, token_id: int) -> None:
    db_obj = db.query(TelegramToken).filter(TelegramToken.id == token_id).first()
    if db_obj:
        db.delete(db_obj)
        db.commit()


# Parsed Group CRUD
def get_group_by_id(db: Session, group_id: int) -> Optional[ParsedGroup]:
    return db.query(ParsedGroup).filter(ParsedGroup.id == group_id).first()


def get_groups_by_user(db: Session, user_id: int) -> List[ParsedGroup]:
    return db.query(ParsedGroup).filter(ParsedGroup.user_id == user_id).all()


def get_group_by_telegram_id(db: Session, telegram_group_id: str, user_id: int) -> Optional[ParsedGroup]:
    return db.query(ParsedGroup).filter(
        ParsedGroup.group_id == telegram_group_id,
        ParsedGroup.user_id == user_id
    ).first()


def create_group(db: Session, *, obj_in: ParsedGroupCreate, user_id: int) -> ParsedGroup:
    db_obj = ParsedGroup(
        user_id=user_id,
        group_id=obj_in.group_id,
        group_name=obj_in.group_name,
        group_username=obj_in.group_username,
        member_count=obj_in.member_count,
        is_public=obj_in.is_public,
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def delete_group(db: Session, *, group_id: int) -> None:
    db_obj = db.query(ParsedGroup).filter(ParsedGroup.id == group_id).first()
    if db_obj:
        # Delete all members first
        db.query(GroupMember).filter(GroupMember.group_id == group_id).delete()
        db.delete(db_obj)
        db.commit()


# Group Member CRUD
def create_member(db: Session, *, obj_in: GroupMemberCreate) -> GroupMember:
    db_obj = GroupMember(
        group_id=obj_in.group_id,
        user_id=obj_in.user_id,
        username=obj_in.username,
        first_name=obj_in.first_name,
        last_name=obj_in.last_name,
        is_bot=obj_in.is_bot,
        is_admin=obj_in.is_admin,
        is_premium=obj_in.is_premium,
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def create_members_bulk(db: Session, *, members: List[GroupMemberCreate]) -> None:
    db_objs = [
        GroupMember(
            group_id=member.group_id,
            user_id=member.user_id,
            username=member.username,
            first_name=member.first_name,
            last_name=member.last_name,
            is_bot=member.is_bot,
            is_admin=member.is_admin,
            is_premium=member.is_premium,
        )
        for member in members
    ]
    db.add_all(db_objs)
    db.commit() 