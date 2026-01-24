"""Baseline schema.

Revision ID: 0001_baseline
Revises:
Create Date: 2026-01-24 00:00:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Baseline migration: existing databases are stamped only.
    # The application still creates tables via SQLModel for new installs.
    pass


def downgrade() -> None:
    pass
