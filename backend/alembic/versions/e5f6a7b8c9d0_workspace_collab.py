"""workspace_collab: invite links, change requests, member color

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-06-13
"""
from alembic import op
import sqlalchemy as sa

revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("user_profiles") as batch_op:
        batch_op.add_column(sa.Column("color", sa.String(), nullable=True))

    op.create_table(
        "org_invite_links",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("org_id", sa.String(), nullable=False),
        sa.Column("token", sa.String(), nullable=False),
        sa.Column("created_by", sa.String(), nullable=False),
        sa.Column("expires_at", sa.String(), nullable=False),
        sa.Column("disabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token"),
    )
    op.create_index("ix_org_invite_links_org_id", "org_invite_links", ["org_id"])
    op.create_index("ix_org_invite_links_token", "org_invite_links", ["token"])

    op.create_table(
        "change_requests",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("org_id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("action_type", sa.String(), nullable=True),
        sa.Column("impact", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("reviewer_id", sa.String(), nullable=True),
        sa.Column("reviewer_comment", sa.Text(), nullable=True),
        sa.Column("auto_approve_at", sa.String(), nullable=True),
        sa.Column("resubmit_count", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=True),
        sa.Column("reviewed_at", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_change_requests_org_id", "change_requests", ["org_id"])
    op.create_index("ix_change_requests_user_id", "change_requests", ["user_id"])


def downgrade():
    op.drop_index("ix_change_requests_user_id", "change_requests")
    op.drop_index("ix_change_requests_org_id", "change_requests")
    op.drop_table("change_requests")

    op.drop_index("ix_org_invite_links_token", "org_invite_links")
    op.drop_index("ix_org_invite_links_org_id", "org_invite_links")
    op.drop_table("org_invite_links")

    with op.batch_alter_table("user_profiles") as batch_op:
        batch_op.drop_column("color")
