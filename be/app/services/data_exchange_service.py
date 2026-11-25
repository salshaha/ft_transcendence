import csv
import json
from io import StringIO

from sqlalchemy.exc import IntegrityError
from app.extensions import db
from app.models.student_dashboard import Course
from app.models.user import User
from app.services.user_service import (
    UserConflictError,
    UserValidationError,
    build_user,
)
from app.utils.validation import normalize_email

MAX_IMPORT_RECORDS = 500
MAX_IMPORT_BYTES = 2 * 1024 * 1024
EXPORT_FIELDS = {
    "users": ("email", "first_name", "last_name", "role", "student_id"),
    "courses": (
        "name",
        "academic_year",
        "semester",
        "instructor_email",
        "microsoft_class_id",
    ),
}
IMPORT_FIELDS = {
    "users": frozenset(EXPORT_FIELDS["users"] + ("password",)),
    "courses": frozenset(EXPORT_FIELDS["courses"]),
}


class ImportValidationError(ValueError):
    def __init__(self, errors):
        self.errors = errors
        summary = "; ".join(
            f"row {error['row']}: {error['message']}" for error in errors[:8]
        )
        if len(errors) > 8:
            summary += f"; and {len(errors) - 8} more error(s)"
        super().__init__(f"Import validation failed; nothing was imported. {summary}")


class ImportConflictError(ValueError):
    pass


def parse_import_file(filename, content):
    if len(content) > MAX_IMPORT_BYTES:
        raise ValueError("Import files must be 2 MB or smaller")
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValueError("Import file must use UTF-8 encoding") from exc

    extension = (filename.rsplit(".", 1)[-1] if "." in filename else "").lower()
    if extension == "json":
        try:
            payload = json.loads(text)
        except json.JSONDecodeError as exc:
            raise ValueError("Import file contains invalid JSON") from exc
        if isinstance(payload, dict):
            payload = payload.get("records")
        records = payload
    elif extension == "csv":
        try:
            reader = csv.DictReader(StringIO(text, newline=""), strict=True)
            headers = reader.fieldnames
            if not headers or any(not header for header in headers):
                raise ValueError("CSV file must include a header row")
            if len(headers) != len(set(headers)):
                raise ValueError("CSV headers must be unique")
            records = list(reader)
        except csv.Error as exc:
            raise ValueError("Import file contains invalid CSV") from exc
    else:
        raise ValueError("Import file must be a .csv or .json file")

    if not isinstance(records, list) or not records:
        raise ValueError("Import file must contain a non-empty records list")
    if len(records) > MAX_IMPORT_RECORDS:
        raise ValueError(f"Import is limited to {MAX_IMPORT_RECORDS} records")
    return records


def export_records(entity):
    if entity not in EXPORT_FIELDS:
        raise ValueError("Entity must be users or courses")
    if entity == "users":
        return [
            {
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "role": user.role,
                "student_id": user.student_id or "",
            }
            for user in User.query.order_by(User.id.asc()).all()
        ]
    return [
        {
            "name": course.name,
            "academic_year": course.academic_year,
            "semester": course.semester,
            "instructor_email": course.instructor.email,
            "microsoft_class_id": course.microsoft_class_id or "",
        }
        for course in Course.query.join(Course.instructor)
        .order_by(Course.id.asc()).all()
    ]


def serialize_export(entity, export_format, records):
    if export_format == "json":
        return json.dumps(
            {"entity": entity, "records": records},
            ensure_ascii=False,
            indent=2,
        ), "application/json; charset=utf-8", "json"
    if export_format != "csv":
        raise ValueError("Format must be csv or json")

    output = StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=EXPORT_FIELDS[entity])
    writer.writeheader()
    for record in records:
        safe_record = {}
        for field in EXPORT_FIELDS[entity]:
            value = str(record.get(field, ""))
            formula_value = value.lstrip(" \t\r").startswith(
                ("=", "+", "-", "@")
            )
            safe_record[field] = f"'{value}" if formula_value else value
        writer.writerow(safe_record)
    return "\ufeff" + output.getvalue(), "text/csv; charset=utf-8", "csv"


def _clean_text(record, key, row_number, errors, *, required=True, maximum):
    value = record.get(key)
    if value is None and not required:
        return None
    if not isinstance(value, str):
        errors.append({"row": row_number, "message": f"{key} must be text"})
        return None
    value = value.strip()
    if required and not value:
        errors.append({"row": row_number, "message": f"{key} is required"})
        return None
    if len(value) > maximum:
        errors.append({"row": row_number, "message": f"{key} is too long"})
        return None
    return value or None


def _prepare_user(record, row_number, errors, seen_emails, seen_student_ids):
    unknown = set(record) - IMPORT_FIELDS["users"]
    if unknown:
        errors.append({"row": row_number, "message": "contains unsupported fields"})
        return None
    email = normalize_email(record.get("email"))
    if not email:
        errors.append({"row": row_number, "message": "email must be valid"})
        return None
    student_id = record.get("student_id")
    if student_id == "":
        student_id = None
    if student_id is not None and not isinstance(student_id, str):
        errors.append({"row": row_number, "message": "student_id must be text"})
        return None
    try:
        user = build_user(
            first_name=record.get("first_name"),
            last_name=record.get("last_name"),
            email=email,
            password=record.get("password"),
            role=record.get("role", "student"),
            student_id=student_id,
        )
    except (UserValidationError, UserConflictError) as exc:
        errors.append({"row": row_number, "message": str(exc)})
        return None
    if email in seen_emails:
        errors.append({"row": row_number, "message": "email is duplicated in this file"})
        return None
    if user.student_id and user.student_id in seen_student_ids:
        errors.append({"row": row_number, "message": "student_id is duplicated in this file"})
        return None
    seen_emails.add(email)
    if user.student_id:
        seen_student_ids.add(user.student_id)
    return user


def _prepare_course(record, row_number, errors, seen_class_ids, seen_course_keys):
    unknown = set(record) - IMPORT_FIELDS["courses"]
    if unknown:
        errors.append({"row": row_number, "message": "contains unsupported fields"})
        return None
    name = _clean_text(record, "name", row_number, errors, maximum=255)
    academic_year = _clean_text(
        record, "academic_year", row_number, errors, maximum=20
    )
    semester = _clean_text(record, "semester", row_number, errors, maximum=10)
    instructor_email = normalize_email(record.get("instructor_email"))
    if not instructor_email:
        errors.append({"row": row_number, "message": "instructor_email must be valid"})
    class_id = _clean_text(
        record,
        "microsoft_class_id",
        row_number,
        errors,
        required=False,
        maximum=255,
    )
    if semester and semester.lower() not in {"fall", "spring", "summer"}:
        errors.append({"row": row_number, "message": "semester must be fall, spring, or summer"})
    instructor = (
        User.query.filter_by(email=instructor_email, role="instructor").first()
        if instructor_email
        else None
    )
    if instructor_email and instructor is None:
        errors.append({"row": row_number, "message": "instructor_email must belong to an instructor"})
    course_key = (
        name.casefold(),
        academic_year.casefold(),
        semester.casefold(),
        instructor_email,
    ) if name and academic_year and semester and instructor_email else None
    if course_key:
        if course_key in seen_course_keys:
            errors.append({"row": row_number, "message": "course is duplicated in this file"})
        elif instructor and Course.query.filter_by(
            name=name,
            academic_year=academic_year,
            semester=semester.lower(),
            instructor_id=instructor.id,
        ).first():
            errors.append({"row": row_number, "message": "course already exists"})
        seen_course_keys.add(course_key)
    if class_id:
        if class_id in seen_class_ids:
            errors.append({"row": row_number, "message": "microsoft_class_id is duplicated in this file"})
        elif Course.query.filter_by(microsoft_class_id=class_id).first():
            errors.append({"row": row_number, "message": "microsoft_class_id already exists"})
        seen_class_ids.add(class_id)
    if errors and any(error["row"] == row_number for error in errors):
        return None
    return Course(
        name=name,
        academic_year=academic_year,
        semester=semester.lower(),
        instructor_id=instructor.id,
        microsoft_class_id=class_id,
    )


def import_records(entity, records):
    if entity not in IMPORT_FIELDS:
        raise ValueError("Entity must be users or courses")
    if not isinstance(records, list) or not records:
        raise ValueError("Import must contain at least one record")
    if len(records) > MAX_IMPORT_RECORDS:
        raise ValueError(f"Import is limited to {MAX_IMPORT_RECORDS} records")

    errors = []
    prepared = []
    seen_emails, seen_student_ids = set(), set()
    seen_class_ids, seen_course_keys = set(), set()
    for row_number, record in enumerate(records, start=2):
        if not isinstance(record, dict):
            errors.append({"row": row_number, "message": "record must be an object"})
            continue
        if entity == "users":
            item = _prepare_user(
                record, row_number, errors, seen_emails, seen_student_ids
            )
        else:
            item = _prepare_course(
                record, row_number, errors, seen_class_ids, seen_course_keys
            )
        if item is not None:
            prepared.append(item)

    if errors:
        raise ImportValidationError(errors)
    try:
        db.session.add_all(prepared)
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        raise ImportConflictError(
            "Import conflicts with existing data; nothing was imported"
        ) from exc
    return len(prepared)
