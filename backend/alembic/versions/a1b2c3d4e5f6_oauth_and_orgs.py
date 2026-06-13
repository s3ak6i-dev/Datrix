"""add oauth accounts and organizations

Revision ID: a1b2c3d4e5f6
Revises: 8f40da1443e7
Create Date: 2026-06-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "8f40da1443e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Alter users table: make hashed_password nullable, add profile columns
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column("hashed_password", existing_type=sa.String(), nullable=True)
        batch_op.add_column(sa.Column("full_name", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("avatar_url", sa.String(), nullable=True))

    # OAuth accounts — links users to third-party provider identities
    op.create_table(
        "oauth_accounts",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("provider", sa.String(), nullable=False),
        sa.Column("provider_user_id", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=True),
    )
    op.create_index("ix_oauth_accounts_user_id", "oauth_accounts", ["user_id"])
    op.create_index(
        "ix_oauth_accounts_provider_uid",
        "oauth_accounts",
        ["provider", "provider_user_id"],
        unique=True,
    )

    # Organizations / workspaces
    op.create_table(
        "organizations",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("owner_id", sa.String(), nullable=False),
        sa.Column("sso_domain", sa.String(), nullable=True),
        sa.Column("sso_provider", sa.String(), nullable=True),
        sa.Column("sso_config", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=True),
    )
    op.create_index("ix_organizations_slug", "organizations", ["slug"], unique=True)
    op.create_index("ix_organizations_owner_id", "organizations", ["owner_id"])
    op.create_index("ix_organizations_sso_domain", "organizations", ["sso_domain"])

    # Organization members
    op.create_table(
        "org_members",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("org_id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False, server_default="member"),
        sa.Column("created_at", sa.String(), nullable=True),
    )
    op.create_index("ix_org_members_org_id", "org_members", ["org_id"])
    op.create_index("ix_org_members_user_id", "org_members", ["user_id"])
    op.create_index(
        "ix_org_members_org_user",
        "org_members",
        ["org_id", "user_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_org_members_org_user", "org_members")
    op.drop_index("ix_org_members_user_id", "org_members")
    op.drop_index("ix_org_members_org_id", "org_members")
    op.drop_table("org_members")

    op.drop_index("ix_organizations_sso_domain", "organizations")
    op.drop_index("ix_organizations_owner_id", "organizations")
    op.drop_index("ix_organizations_slug", "organizations")
    op.drop_table("organizations")

    op.drop_index("ix_oauth_accounts_provider_uid", "oauth_accounts")
    op.drop_index("ix_oauth_accounts_user_id", "oauth_accounts")
    op.drop_table("oauth_accounts")

    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("avatar_url")
        batch_op.drop_column("full_name")
        batch_op.alter_column("hashed_password", existing_type=sa.String(), nullable=False)
