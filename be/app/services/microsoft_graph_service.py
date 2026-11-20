"""Read Microsoft education rosters and sync them into local courses."""

import re
from datetime import datetime, timezone

import requests

from app.extensions import db
from app.models.student_dashboard import Course, CourseEnrollment
from app.models.user import User
from app.services.microsoft_identity import (
    MicrosoftIdentityError,
    get_graph_access_token,
)
from app.utils.validation import normalize_email

GRAPH_ROOT = "https://graph.microsoft.com/v1.0"


class MicrosoftGraphError(Exception):
    """Raised when the Microsoft education roster cannot be read or synced."""


def _graph_collection(url, access_token):
    rows = []
    next_url = url
    headers = {"Authorization": f"Bearer {access_token}"}
    while next_url:
        try:
            response = requests.get(next_url, headers=headers, timeout=25)
        except requests.RequestException as exc:
            raise MicrosoftGraphError(
                "Microsoft Graph could not be reached. Please try again."
            ) from exc

        if not response.ok:
            try:
                detail = response.json().get("error", {}).get("message")
            except (ValueError, AttributeError):
                detail = None
            if response.status_code in {401, 403}:
                raise MicrosoftGraphError(
                    detail
                    or "Microsoft did not grant access to your class roster. Check the required Graph permissions and consent."
                )
            raise MicrosoftGraphError(
                detail or f"Microsoft Graph returned HTTP {response.status_code}."
            )

        try:
            payload = response.json()
        except ValueError as exc:
            raise MicrosoftGraphError("Microsoft Graph returned an invalid response.") from exc
        rows.extend(payload.get("value", []))
        next_url = payload.get("@odata.nextLink")
    return rows


def _term_details(graph_class):
    now = datetime.now(timezone.utc)
    term = graph_class.get("term") or {}
    label = term.get("displayName", "") if isinstance(term, dict) else str(term)
    text = f"{label} {graph_class.get('displayName', '')}".lower()
    semester_match = re.search(r"\b(fall|autumn|spring|summer)\b", text)
    if semester_match:
        semester = semester_match.group(1)
        semester = "fall" if semester == "autumn" else semester
    else:
        semester = (
            "spring" if now.month <= 4 else
            "summer" if now.month <= 8 else
            "fall"
        )

    year_match = re.search(
        r"\b(20\d{2})\b",
        f"{label} {graph_class.get('displayName', '')}",
    )
    year = int(year_match.group(1)) if year_match else now.year
    if semester == "spring":
        academic_year = f"{year - 1}-{year}"
    elif semester == "summer" and now.month <= 8 and not year_match:
        academic_year = f"{year - 1}-{year}"
    else:
        academic_year = f"{year}-{year + 1}"
    return academic_year, semester


def _microsoft_user_id(tenant_id, object_id):
    return f"{tenant_id}:{object_id}"


def _student_identity(member, tenant_id):
    object_id = member.get("id")
    if not object_id:
        return None
    email = normalize_email(
        member.get("mail") or member.get("userPrincipalName")
    )
    if not email:
        return None

    display_name = (member.get("displayName") or email.split("@", 1)[0]).strip()
    name_parts = display_name.split(None, 1)
    first_name = (member.get("givenName") or name_parts[0] or "Student")[:100]
    last_name = (
        member.get("surname")
        or (name_parts[1] if len(name_parts) > 1 else "Student")
    )[:100]
    return {
        "microsoft_id": _microsoft_user_id(tenant_id, object_id),
        "email": email,
        "first_name": first_name,
        "last_name": last_name,
        "student_id": f"MS-{object_id}"[:50],
    }


def _upsert_student(identity):
    user = User.query.filter_by(microsoft_id=identity["microsoft_id"]).first()
    email_user = User.query.filter_by(email=identity["email"]).first()
    if user and email_user and user.id != email_user.id:
        return None, False
    user = user or email_user
    if user:
        if user.role != "student":
            return None, False
        if user.microsoft_id and user.microsoft_id != identity["microsoft_id"]:
            return None, False
        user.microsoft_id = identity["microsoft_id"]
        if not user.student_id:
            user.student_id = identity["student_id"]
        return user, False

    # Keep imported account names and email aligned with the source roster.
    user = User(
        first_name=identity["first_name"],
        last_name=identity["last_name"],
        email=identity["email"],
        role="student",
        student_id=identity["student_id"],
        microsoft_id=identity["microsoft_id"],
    )
    db.session.add(user)
    db.session.flush()
    return user, True


def sync_instructor_courses(instructor):
    try:
        access_token, tenant_id = get_graph_access_token(instructor.id)
    except MicrosoftIdentityError:
        raise
    if not tenant_id:
        raise MicrosoftIdentityError(
            "Your Microsoft token cache is missing its tenant. Please sign in with Microsoft again."
        )

    classes = _graph_collection(
        f"{GRAPH_ROOT}/education/me/taughtClasses?$select=id,displayName,classCode,externalId,term",
        access_token,
    )
    rosters = []
    for graph_class in classes:
        class_id = graph_class.get("id")
        if not class_id:
            continue
        members = _graph_collection(
            f"{GRAPH_ROOT}/education/classes/{class_id}/members",
            access_token,
        )
        rosters.append((graph_class, members))

    result = {
        "classes_added": 0,
        "classes_updated": 0,
        "students_added": 0,
        "enrollments_added": 0,
        "students_skipped": 0,
    }
    try:
        for graph_class, members in rosters:
            microsoft_class_id = graph_class["id"]
            name = (graph_class.get("displayName") or "").strip()
            if not name:
                continue
            academic_year, semester = _term_details(graph_class)
            course = Course.query.filter_by(
                microsoft_class_id=microsoft_class_id
            ).first()
            if course is None:
                course = Course(
                    instructor_id=instructor.id,
                    microsoft_class_id=microsoft_class_id,
                    name=name,
                    academic_year=academic_year,
                    semester=semester,
                )
                db.session.add(course)
                db.session.flush()
                result["classes_added"] += 1
            else:
                course.instructor_id = instructor.id
                course.name = name
                course.academic_year = academic_year
                course.semester = semester
                result["classes_updated"] += 1

            for member in members:
                if (member.get("primaryRole") or "").lower() != "student":
                    continue
                identity = _student_identity(member, tenant_id)
                if identity is None:
                    result["students_skipped"] += 1
                    continue
                student, created = _upsert_student(identity)
                if student is None:
                    result["students_skipped"] += 1
                    continue
                if created:
                    result["students_added"] += 1
                enrollment = CourseEnrollment.query.filter_by(
                    student_id=student.id, course_id=course.id
                ).first()
                if enrollment is None:
                    db.session.add(
                        CourseEnrollment(student_id=student.id, course_id=course.id)
                    )
                    result["enrollments_added"] += 1

        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return result
