import click
from flask.cli import with_appcontext
from sqlalchemy.exc import SQLAlchemyError

from app.models.user import User
from app.services.user_service import (
    UserConflictError,
    UserValidationError,
    create_user,
    set_password,
    update_profile_fields,
)
from app.utils.validation import normalize_email


def _create_or_update_user(
    *,
    role,
    email,
    password,
    first_name,
    last_name,
    force,
):
    normalized_email = normalize_email(email)
    if not normalized_email:
        raise click.ClickException("A valid email address is required")

    existing = User.query.filter_by(email=normalized_email).first()
    if existing is not None and not force:
        raise click.ClickException(
            f"A user with {normalized_email} already exists. "
            "Use --force to update that account."
        )

    try:
        if existing is not None:
            update_profile_fields(
                existing,
                first_name=first_name or None,
                last_name=last_name or None,
                role=role,
            )
            set_password(existing, password)
            user = existing
            action = "updated"
        else:
            user = create_user(
                first_name=first_name,
                last_name=last_name,
                email=normalized_email,
                password=password,
                role=role,
            )
            action = "created"
    except (UserValidationError, UserConflictError) as exc:
        raise click.ClickException(str(exc)) from exc
    except SQLAlchemyError as exc:
        raise click.ClickException(
            "Database error while creating the account"
        ) from exc

    click.echo(
        f"{role.capitalize()} account {action}: {user.email} (id={user.id})"
    )


@click.command("create-admin")
@click.option("--email", envvar="ADMIN_EMAIL", prompt="Admin email")
@click.option(
    "--password",
    envvar="ADMIN_PASSWORD",
    prompt=True,
    hide_input=True,
    confirmation_prompt=True,
)
@click.option(
    "--first-name",
    envvar="ADMIN_FIRST_NAME",
    default="Platform",
    show_default=True,
)
@click.option(
    "--last-name",
    envvar="ADMIN_LAST_NAME",
    default="Administrator",
    show_default=True,
)
@click.option(
    "--force",
    is_flag=True,
    help="Update the existing account with this email instead of failing.",
)
@with_appcontext
def create_admin(email, password, first_name, last_name, force):
    """Create the first admin, or repair an existing admin account."""
    _create_or_update_user(
        role="admin",
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
        force=force,
    )


@click.command("create-instructor")
@click.option("--email", envvar="INSTRUCTOR_EMAIL", prompt="Instructor email")
@click.option(
    "--password",
    envvar="INSTRUCTOR_PASSWORD",
    prompt=True,
    hide_input=True,
    confirmation_prompt=True,
)
@click.option(
    "--first-name",
    envvar="INSTRUCTOR_FIRST_NAME",
    prompt="First name",
)
@click.option(
    "--last-name",
    envvar="INSTRUCTOR_LAST_NAME",
    prompt="Last name",
)
@click.option(
    "--force",
    is_flag=True,
    help="Update the existing account with this email instead of failing.",
)
@with_appcontext
def create_instructor(email, password, first_name, last_name, force):
    """Provision an instructor account (public signup is student-only)."""
    _create_or_update_user(
        role="instructor",
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
        force=force,
    )


def register_cli(app):
    app.cli.add_command(create_admin)
    app.cli.add_command(create_instructor)
