from sqlalchemy import or_

from app.extensions import db
from app.models.skill import Skill, StudentSkill
from app.models.student_dashboard import Course, CourseEnrollment, Team, TeamMember
from app.models.user import User
from app.services import presence_service
from app.services.student_service import (
    PROFICIENCY_LABELS,
    serialize_current_project,
)


def _parse_positive_int(value, field_name, default=None, maximum=None):
    if value in (None, ""):
        if default is None:
            raise ValueError(f"{field_name} is required")
        return default
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field_name} must be a positive integer") from exc
    if parsed < 1:
        raise ValueError(f"{field_name} must be a positive integer")
    if maximum is not None:
        parsed = min(parsed, maximum)
    return parsed


def shared_course_ids(viewer_id, target_id=None):
    viewer_courses = db.session.query(CourseEnrollment.course_id).filter(
        CourseEnrollment.student_id == viewer_id
    )
    if target_id is None:
        return [course_id for (course_id,) in viewer_courses.all()]

    shared = db.session.query(CourseEnrollment.course_id).filter(
        CourseEnrollment.student_id == target_id,
        CourseEnrollment.course_id.in_(viewer_courses),
    )
    return [course_id for (course_id,) in shared.all()]


def visible_user_ids(viewer_id):
    ids = {viewer_id}
    shared = shared_course_ids(viewer_id)
    if shared:
        rows = db.session.query(CourseEnrollment.student_id).filter(
            CourseEnrollment.course_id.in_(shared)
        ).all()
        ids.update(row[0] for row in rows)
    return ids


def serialize_public_student(student, viewer, status=None):
    is_self = viewer is not None and viewer.id == student.id
    if status is None:
        status = presence_service.get_status([student.id]).get(str(student.id), {})
    skills = [
        {
            "skill_id": membership.skill_id,
            "id": membership.skill_id,
            "name": membership.skill.name,
            "category": membership.skill.category,
            "proficiency_level": membership.proficiency_level,
            "proficiency_label": PROFICIENCY_LABELS.get(
                membership.proficiency_level, "Intermediate"
            ),
        }
        for membership in getattr(student, "skills", [])
    ]
    data = {
        "id": student.id,
        "first_name": student.first_name,
        "last_name": student.last_name,
        "full_name": f"{student.first_name} {student.last_name}",
        "major": student.major,
        "joined_year": student.joined_year,
        "domain": student.domain,
        "profile_picture": student.profile_picture,
        "avatar_url": (
            f"/api/users/{student.id}/avatar" if student.profile_picture else None
        ),
        "skills": skills,
        "is_online": status.get("online", False),
        "last_seen": status.get("last_seen"),
        "is_self": is_self,
    }
    if is_self:
        data["email"] = student.email
        data["student_id"] = student.student_id
        data["gpa"] = float(student.gpa.gpa) if student.gpa else None
    return data


def list_students(viewer, *, search=None, skill_id=None, skill=None,
                  course_id=None, page=1, per_page=12):
    page = _parse_positive_int(page, "page", default=1)
    per_page = _parse_positive_int(per_page, "per_page", default=12, maximum=50)
    search = search.strip()[:100] if isinstance(search, str) else ""
    skill = skill.strip()[:100] if isinstance(skill, str) else ""
    if skill_id not in (None, ""):
        skill_id = _parse_positive_int(skill_id, "skill_id")
    if course_id not in (None, ""):
        course_id = _parse_positive_int(course_id, "course_id")

    shared = shared_course_ids(viewer.id)
    if not shared:
        return {
            "students": [],
            "total": 0,
            "page": page,
            "per_page": per_page,
            "pages": 0,
        }

    if course_id is not None and course_id not in shared:
        raise ValueError("You do not have access to that course")

    classmate_ids = db.session.query(CourseEnrollment.student_id).filter(
        CourseEnrollment.student_id != viewer.id,
        CourseEnrollment.course_id.in_(shared),
    )
    query = User.query.filter(User.role == "student", User.id.in_(classmate_ids))

    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(
                User.first_name.ilike(pattern),
                User.last_name.ilike(pattern),
                (User.first_name + " " + User.last_name).ilike(pattern),
            )
        )

    if skill_id is not None:
        query = query.join(StudentSkill, StudentSkill.student_id == User.id).filter(
            StudentSkill.skill_id == skill_id
        )
    elif skill:
        pattern = f"%{skill}%"
        query = (
            query.join(StudentSkill, StudentSkill.student_id == User.id)
            .join(Skill, Skill.id == StudentSkill.skill_id)
            .filter(Skill.name.ilike(pattern))
        )

    if course_id is not None:
        query = query.join(
            CourseEnrollment, CourseEnrollment.student_id == User.id
        ).filter(CourseEnrollment.course_id == course_id)

    query = query.distinct().order_by(
        User.first_name.asc(), User.last_name.asc(), User.id.asc()
    )
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    if pagination.pages and page > pagination.pages:
        page = pagination.pages
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    students = pagination.items
    status = presence_service.get_status([student.id for student in students])
    return {
        "students": [
            serialize_public_student(
                student, viewer, status.get(str(student.id))
            )
            for student in students
        ],
        "total": pagination.total,
        "page": pagination.page,
        "per_page": per_page,
        "pages": pagination.pages,
    }


def get_public_profile(viewer, student_id):
    student = db.session.get(User, student_id)
    if student is None or student.role != "student":
        raise LookupError("Student not found")

    is_self = viewer.id == student.id
    shared = shared_course_ids(viewer.id, student.id)
    if not shared and not is_self:
        raise PermissionError("You do not have access to this student's profile")

    courses = []
    if shared:
        courses = [
            {
                "id": course.id,
                "name": course.name,
                "academic_year": course.academic_year,
                "semester": course.semester,
            }
            for course in Course.query.join(CourseEnrollment)
            .filter(
                CourseEnrollment.student_id == student.id,
                Course.id.in_(shared),
            )
            .order_by(Course.name.asc())
            .all()
        ]

    current_project = serialize_current_project(student.id, viewer.id, shared or None)
    if current_project and current_project.get("team") and not is_self:
        member = (
            TeamMember.query.join(Team)
            .filter(
                Team.id == current_project["team"]["id"],
                TeamMember.student_id == viewer.id,
            )
            .first()
        )
        if member is None:
            current_project = {**current_project, "team": None}

    profile = serialize_public_student(student, viewer)
    profile.update({
        "courses": courses,
        "current_project": current_project,
        "team": current_project.get("team") if current_project else None,
    })
    return profile


def can_view_avatar(viewer, user_id):
    target = db.session.get(User, user_id)
    if target is None:
        raise LookupError("User not found")
    if viewer.id == target.id or viewer.role == "admin":
        return True
    if viewer.role == "student":
        return bool(shared_course_ids(viewer.id, target.id))
    if viewer.role == "instructor":
        taught = db.session.query(Course.id).filter(Course.instructor_id == viewer.id)
        return db.session.query(CourseEnrollment).filter(
            CourseEnrollment.student_id == target.id,
            CourseEnrollment.course_id.in_(taught),
        ).first() is not None
    return False
