"""add_performance_indexes

Revision ID: e48218aa2f10
Revises: add_telegram_session_trigger
Create Date: 2025-03-20 16:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e48218aa2f10'
down_revision: Union[str, None] = 'add_telegram_session_trigger'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add index for user_id and is_channel combination on parsed_groups
    op.create_index('idx_parsed_groups_user_channel', 'parsed_groups', ['user_id', 'is_channel'])
    
    # Add index for parsed_at to help with sorting
    op.create_index('idx_parsed_groups_parsed_at', 'parsed_groups', ['parsed_at'])
    
    # Add index for group_id on group_members for faster joins
    op.create_index('idx_group_members_group_id', 'group_members', ['group_id'])
    
    # Add index for user lookups in group_members
    op.create_index('idx_group_members_user_id', 'group_members', ['user_id'])
    
    # Add composite index for group filtering
    op.create_index('idx_parsed_groups_user_filter', 'parsed_groups', ['user_id', 'is_channel', 'parsed_at'])


def downgrade() -> None:
    # Remove all indexes in reverse order
    op.drop_index('idx_parsed_groups_user_filter')
    op.drop_index('idx_group_members_user_id')
    op.drop_index('idx_group_members_group_id')
    op.drop_index('idx_parsed_groups_parsed_at')
    op.drop_index('idx_parsed_groups_user_channel')
