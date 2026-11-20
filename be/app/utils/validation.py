from email_validator import EmailNotValidError, validate_email


def normalize_email(value):
    """Return a normalized email address, or None when it is invalid."""
    if not isinstance(value, str):
        return None
    try:
        return validate_email(
            value.strip(), check_deliverability=False
        ).normalized.casefold()
    except EmailNotValidError:
        return None


def validate_password(value, *, field_name="Password"):
    """Return an error message for an invalid password, otherwise None."""
    if not isinstance(value, str) or len(value) < 8:
        return f"{field_name} must be at least 8 characters"
    if len(value) > 1024:
        return f"{field_name} must be 1024 characters or fewer"
    return None


def validate_name(value, *, field_name):
    if not isinstance(value, str) or not value.strip():
        return f"{field_name} is required"
    if len(value.strip()) > 100:
        return f"{field_name} must be 100 characters or fewer"
    return None
