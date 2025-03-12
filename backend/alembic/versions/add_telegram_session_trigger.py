"""add telegram session trigger

Revision ID: add_telegram_session_trigger
Revises: 7c2de7ac64c1
Create Date: 2024-03-10 22:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'add_telegram_session_trigger'
down_revision: Union[str, None] = '7c2de7ac64c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create function to handle session activation
    op.execute("""
    CREATE OR REPLACE FUNCTION handle_telegram_session_activation()
    RETURNS TRIGGER AS $$
    BEGIN
        IF NEW.is_active = TRUE THEN
            -- Deactivate all other sessions for the same user
            UPDATE telegram_sessions
            SET is_active = FALSE
            WHERE user_id = NEW.user_id
                AND id != NEW.id
                AND is_active = TRUE;
        END IF;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    """)

    # Create trigger
    op.execute("""
    CREATE TRIGGER ensure_single_active_session
    BEFORE INSERT OR UPDATE ON telegram_sessions
    FOR EACH ROW
    EXECUTE FUNCTION handle_telegram_session_activation();
    """)


def downgrade() -> None:
    # Drop trigger
    op.execute("DROP TRIGGER IF EXISTS ensure_single_active_session ON telegram_sessions;")
    # Drop function
    op.execute("DROP FUNCTION IF EXISTS handle_telegram_session_activation();") 