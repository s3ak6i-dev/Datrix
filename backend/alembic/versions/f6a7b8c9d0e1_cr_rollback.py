"""add rollback_comment to change_requests"""
from alembic import op
import sqlalchemy as sa

revision = "f6a7b8c9d0e1"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("change_requests") as batch_op:
        batch_op.add_column(sa.Column("rollback_comment", sa.Text, nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("change_requests") as batch_op:
        batch_op.drop_column("rollback_comment")
