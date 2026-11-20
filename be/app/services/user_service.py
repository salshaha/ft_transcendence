from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from werkzeug.security import check_password_hash, generate_password_hash

from app.extensions import db
from app.models.skill import Skill, StudentSkill
from app.models.user import User
from app.utils.validation import normalize_email, validate_name, validate_password

VALID_ROLES = frozenset({"student", "instructor", "admin"})


class UserValidationError(ValueError):
    """Raised when user-supplied account data is invalid."""


class UserConflictError(Exception):
    """Raised when an email or student ID is already in use."""


class UserAuthenticationError(Exception):
    """Raised when the current password is missing or incorrect."""


def _commit():
    try:
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        raise UserConflictError(
            "Email or student ID already exists"
        ) from exc
    except SQLAlchemyError:
        db.session.rollback()
        raise


def create_user(
    *,
    first_name,
    last_name,
    email,
    password,
    role="student",
    student_id=None,
):
    for value, field_name in (
        (first_name, "First name"),
        (last_name, "Last name"),
    ):
        error = validate_name(value, field_name=field_name)
        if error:
            raise UserValidationError(error)

    if role not in VALID_ROLES:
        raise UserValidationError("Role must be student, instructor, or admin")

    normalized_email = normalize_email(email)
    if not normalized_email:
        raise UserValidationError("A valid email address is required")

    password_error = validate_password(password)
    if password_error:
        raise UserValidationError(password_error)

    if role == "student":
        if not isinstance(student_id, str) or not student_id.strip():
            raise UserValidationError("Student ID is required for students")
        student_id = student_id.strip()
        if len(student_id) > 50:
            raise UserValidationError(
                "Student ID must be 50 characters or fewer"
            )
    else:
        student_id = None

    if User.query.filter_by(email=normalized_email).first():
        raise UserConflictError("Email already exists")
    if student_id and User.query.filter_by(student_id=student_id).first():
        raise UserConflictError("Student ID already exists")

    user = User(
        first_name=first_name.strip(),
        last_name=last_name.strip(),
        email=normalized_email,
        password_hash=generate_password_hash(password),
        role=role,
        student_id=student_id,
    )
    db.session.add(user)
    _commit()
    return user


def update_credentials(user, *, current_password, email=None, new_password=None):
    """Update email and/or password after verifying the current password."""
    if email is None and new_password is None:
        raise UserValidationError(
            "Provide an email address or a new password to update"
        )

    if not isinstance(current_password, str) or not current_password:
        raise UserAuthenticationError("Current password is required")
    if not user.password_hash or not check_password_hash(
        user.password_hash, current_password
    ):
        raise UserAuthenticationError("Current password is incorrect")

    if email is not None:
        normalized_email = normalize_email(email)
        if not normalized_email:
            raise UserValidationError("A valid email address is required")
        existing = User.query.filter(
            User.email == normalized_email, User.id != user.id
        ).first()
        if existing is not None:
            raise UserConflictError("Email already exists")
        user.email = normalized_email

    if new_password is not None:
        password_error = validate_password(
            new_password, field_name="New password"
        )
        if password_error:
            raise UserValidationError(password_error)
        user.password_hash = generate_password_hash(new_password)

    _commit()
    return user


def set_password(user, password):
    password_error = validate_password(password)
    if password_error:
        raise UserValidationError(password_error)
    user.password_hash = generate_password_hash(password)
    _commit()
    return user


def update_profile_fields(
    user,
    *,
    first_name=None,
    last_name=None,
    role=None,
    student_id=None,
):
    """Update admin-provisioned account fields without duplicating rules."""
    if first_name is not None:
        error = validate_name(first_name, field_name="First name")
        if error:
            raise UserValidationError(error)
        user.first_name = first_name.strip()

    if last_name is not None:
        error = validate_name(last_name, field_name="Last name")
        if error:
            raise UserValidationError(error)
        user.last_name = last_name.strip()

    if role is not None:
        if role not in VALID_ROLES:
            raise UserValidationError(
                "Role must be student, instructor, or admin"
            )
        user.role = role

    if student_id is not None:
        student_id = student_id.strip()
        if not student_id:
            user.student_id = None
        else:
            if len(student_id) > 50:
                raise UserValidationError(
                    "Student ID must be 50 characters or fewer"
                )
            existing = User.query.filter(
                User.student_id == student_id, User.id != user.id
            ).first()
            if existing is not None:
                raise UserConflictError("Student ID already exists")
            user.student_id = student_id

    _commit()
    return user


def update_profile(user, *, first_name=None, last_name=None, major=None,
                   joined_year=None, domain=None, student_id=None):
    if first_name is not None:
        error = validate_name(first_name, field_name="First name")
        if error:
            raise UserValidationError(error)
        user.first_name = first_name.strip()
    if last_name is not None:
        error = validate_name(last_name, field_name="Last name")
        if error:
            raise UserValidationError(error)
        user.last_name = last_name.strip()
    if major is not None:
        if not isinstance(major, str):
            raise UserValidationError("Major must be text")
        user.major = major.strip() or None
    if domain is not None:
        if not isinstance(domain, str):
            raise UserValidationError("Domain must be text")
        user.domain = domain.strip() or None
    if joined_year is not None:
        if joined_year == "":
            user.joined_year = None
        else:
            try:
                year = int(joined_year)
            except (TypeError, ValueError) as exc:
                raise UserValidationError("Joined year must be an integer") from exc
            user.joined_year = year
    if student_id is not None and user.role == "student":
        student_id = student_id.strip() if isinstance(student_id, str) else student_id
        if not student_id:
            user.student_id = None
        else:
            if len(str(student_id)) > 50:
                raise UserValidationError("Student ID must be 50 characters or fewer")
            existing = User.query.filter(
                User.student_id == student_id, User.id != user.id
            ).first()
            if existing is not None:
                raise UserConflictError("Student ID already exists")
            user.student_id = str(student_id)
    _commit()
    return user


def _validate_proficiency(value):
    if isinstance(value, bool):
        raise UserValidationError("Proficiency level must be an integer")
    try:
        level = int(value)
    except (TypeError, ValueError) as exc:
        raise UserValidationError("Proficiency level must be an integer") from exc
    if level < 1 or level > 5:
        raise UserValidationError("Proficiency level must be between 1 and 5")
    return level


def add_user_skill(user, *, skill_id=None, name=None, category=None,
                   proficiency_level=3):
    level = _validate_proficiency(proficiency_level)

    skill = None
    if skill_id is not None:
        try:
            sid = int(skill_id)
        except (TypeError, ValueError) as exc:
            raise UserValidationError("skill_id must be an integer") from exc
        skill = db.session.get(Skill, sid)
        if skill is None:
            raise UserValidationError("Skill not found")
    else:
        if not isinstance(name, str) or not name.strip():
            raise UserValidationError("Skill name is required")
        name = name.strip()
        skill = Skill.query.filter_by(name=name).first()
        if skill is None:
            if category not in {"interpersonal", "technical", "artistic",
                                "linguistic", "other"}:
                raise UserValidationError("Invalid skill category")
            skill = Skill(
                name=name,
                category=category,
                description=None,
                created_by=user.id,
            )
            db.session.add(skill)
            db.session.flush()

    existing = StudentSkill.query.filter_by(
        student_id=user.id, skill_id=skill.id
    ).first()
    if existing is not None:
        existing.proficiency_level = level
        _commit()
        return skill, existing

    membership = StudentSkill(
        student_id=user.id, skill_id=skill.id, proficiency_level=level
    )
    db.session.add(membership)
    _commit()
    return skill, membership


def remove_user_skill(user, skill_id):
    membership = StudentSkill.query.filter_by(
        student_id=user.id, skill_id=skill_id
    ).first()
    if membership is None:
        raise UserValidationError("Skill is not attached to this user")
    db.session.delete(membership)
    _commit()
    return True


def update_user_skill(user, skill_id, proficiency_level):
    membership = StudentSkill.query.filter_by(
        student_id=user.id, skill_id=skill_id
    ).first()
    if membership is None:
        raise UserValidationError("Skill is not attached to this user")
    membership.proficiency_level = _validate_proficiency(proficiency_level)
    _commit()
    return membership
