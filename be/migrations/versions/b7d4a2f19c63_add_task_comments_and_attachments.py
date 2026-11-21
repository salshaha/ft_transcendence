"""add task comments and task attachments

Revision ID: b7d4a2f19c63
Revises: 9e295a365101
Create Date: 2026-11-21 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b7d4a2f19c63'
down_revision = '9e295a365101'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('task_comments',
    sa.Column('id', sa.BigInteger(), nullable=False),
    sa.Column('task_id', sa.BigInteger(), nullable=False),
    sa.Column('author_id', sa.BigInteger(), nullable=True),
    sa.Column('body', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    sa.ForeignKeyConstraint(['author_id'], ['users.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['task_id'], ['tasks.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('task_comments', schema=None) as batch_op:
        batch_op.create_index('idx_task_comments_task', ['task_id'], unique=False)
        batch_op.create_index('idx_task_comments_author', ['author_id'], unique=False)

    op.create_table('task_attachments',
    sa.Column('id', sa.BigInteger(), nullable=False),
    sa.Column('task_id', sa.BigInteger(), nullable=False),
    sa.Column('uploader_id', sa.BigInteger(), nullable=True),
    sa.Column('file_key', sa.Text(), nullable=False),
    sa.Column('original_name', sa.String(length=255), nullable=False),
    sa.Column('content_type', sa.String(length=255), nullable=False),
    sa.Column('size', sa.BigInteger(), nullable=False),
    sa.Column('sha256', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    sa.ForeignKeyConstraint(['task_id'], ['tasks.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['uploader_id'], ['users.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('task_attachments', schema=None) as batch_op:
        batch_op.create_index('idx_task_attachments_task', ['task_id'], unique=False)
        batch_op.create_index('idx_task_attachments_uploader', ['uploader_id'], unique=False)


def downgrade():
    with op.batch_alter_table('task_attachments', schema=None) as batch_op:
        batch_op.drop_index('idx_task_attachments_uploader')
        batch_op.drop_index('idx_task_attachments_task')

    op.drop_table('task_attachments')
    with op.batch_alter_table('task_comments', schema=None) as batch_op:
        batch_op.drop_index('idx_task_comments_author')
        batch_op.drop_index('idx_task_comments_task')

    op.drop_table('task_comments')
