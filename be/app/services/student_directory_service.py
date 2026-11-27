from sqlalchemy import func, or_

from app.extensions import db
from app.models.skill import Skill, StudentSkill
from app.models.student_dashboard import Course, CourseEnrollment, Project, Team, TeamMember
from app.models.user import User
from app.services import presence_service
from app.services.peer_feedback_service import project_has_ended
from app.services.student_service import (
    CLOSED_TEAM_STATUSES,
    PROFICIENCY_LABELS,
    _team_restriction_reason,
    serialize_current_project,
)

STUDENT_SORT_FIELDS = {"name", "skills", "major", "joined_year"}


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


def _parse_sort(value, allowed, default):
    sort = (value or default).strip().lower()
    if sort not in allowed:
        raise ValueError(f"Unsupported sort field: {sort}")
    return sort


def _parse_direction(value):
    direction = (value or "asc").strip().lower()
    if direction not in {"asc", "desc"}:
        raise ValueError("sort order must be asc or desc")
    return direction


def _parse_skill_ids(values):
    if values in (None, ""):
        return []
    if isinstance(values, str):
        values = [values]
    result = []
    for value in values:
        for part in str(value).split(","):
            part = part.strip()
            if part:
                parsed = _parse_positive_int(part, "skill_id")
                if parsed not in result:
                    result.append(parsed)
    return result


def _project_availability_context(viewer, project_id):
    if project_id in (None, ""):
        return None
    project_id = _parse_positive_int(project_id, "project_id")
    project = db.session.get(Project, project_id)
    if project is None:
        raise LookupError("Project not found")
    enrolled = CourseEnrollment.query.filter_by(
        student_id=viewer.id, course_id=project.course_id
    ).first()
    if enrolled is None:
        raise PermissionError("You do not have access to this project")

    deadline_passed = bool(project_has_ended(project))
    enrolled_student_ids = {
        student_id
        for (student_id,) in db.session.query(CourseEnrollment.student_id)
        .filter(CourseEnrollment.course_id == project.course_id)
        .all()
    }
    assigned_student_ids = {
        student_id
        for (student_id,) in db.session.query(TeamMember.student_id)
        .join(Team)
        .filter(Team.project_id == project_id)
        .all()
    }
    teams = Team.query.filter(Team.project_id == project_id).all()
    counts = dict(
        db.session.query(TeamMember.team_id, func.count(TeamMember.id))
        .filter(TeamMember.team_id.in_([team.id for team in teams]))
        .group_by(TeamMember.team_id)
        .all()
    )
    open_team_ids = set()
    for team in teams:
        status = (team.status or "").strip().lower()
        if status in CLOSED_TEAM_STATUSES or _team_restriction_reason(team):
            continue
        if counts.get(team.id, 0) >= team.project.max_members_per_team:
            continue
        open_team_ids.add(team.id)

    return {
        "project_id": project_id,
        "deadline_passed": deadline_passed,
        "enrolled_student_ids": enrolled_student_ids,
        "assigned_student_ids": assigned_student_ids,
        "open_team_ids": open_team_ids,
    }


def _availability_for_student(student_id, context):
    if context is None:
        return None
    if context["deadline_passed"]:
        return {
            "status": "not_eligible",
            "label": "Not eligible for this project",
            "reason": "The project deadline has passed.",
        }
    if student_id not in context["enrolled_student_ids"]:
        return {
            "status": "not_eligible",
            "label": "Not eligible for this project",
            "reason": "Not enrolled in this project's course.",
        }
    if student_id in context["assigned_student_ids"]:
        return {
            "status": "assigned",
            "label": "Already assigned to a team",
            "reason": "This student already belongs to a team in this project.",
        }
    if not context["open_team_ids"]:
        return {
            "status": "not_eligible",
            "label": "Not eligible for this project",
            "reason": "No team has an open spot for this project.",
        }
    return {
        "status": "available",
        "label": "Available to join a team",
        "reason": None,
    }


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


def serialize_public_student(student, viewer, status=None, availability=None):
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
        "availability": availability,
    }
    if is_self:
        data["email"] = student.email
        data["student_id"] = student.student_id
        data["gpa"] = float(student.gpa.gpa) if student.gpa else None
    return data


def list_students(viewer, *, search=None, skill_id=None, skill=None, skill_ids=None,
                  course_id=None, project_id=None, availability=None,
                  sort="name", order="asc", page=1, per_page=12):
    page = _parse_positive_int(page, "page", default=1)
    per_page = _parse_positive_int(per_page, "per_page", default=12, maximum=50)
    search = search.strip()[:100] if isinstance(search, str) else ""
    skill = skill.strip()[:100] if isinstance(skill, str) else ""
    sort = _parse_sort(sort, STUDENT_SORT_FIELDS, "name")
    direction = _parse_direction(order)
    requested_skills = _parse_skill_ids(skill_ids)
    if skill_id not in (None, "") and not requested_skills:
        requested_skills = _parse_skill_ids([skill_id])
    if course_id not in (None, ""):
        course_id = _parse_positive_int(course_id, "course_id")
    availability = (availability or "").strip().lower()
    if availability and availability not in {"available"}:
        raise ValueError("Unsupported availability filter")

    context = _project_availability_context(viewer, project_id)
    if context and course_id is not None:
        project = db.session.get(Project, context["project_id"])
        if course_id != project.course_id:
            raise ValueError("Course does not match the selected project")

    shared = shared_course_ids(viewer.id)
    if not shared:
        return {
            "students": [],
            "total": 0,
            "page": page,
            "per_page": per_page,
            "pages": 0,
            "filters": {
                "search": search,
                "skill_ids": requested_skills,
                "course_id": course_id,
                "project_id": context["project_id"] if context else None,
                "availability": availability,
                "sort": sort,
                "order": direction,
            },
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
                User.major.ilike(pattern),
                User.domain.ilike(pattern),
            )
        )

    if requested_skills:
        query = query.join(StudentSkill, StudentSkill.student_id == User.id).filter(
            StudentSkill.skill_id.in_(requested_skills)
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

    if availability == "available" and context is not None:
        if context["deadline_passed"] or not context["open_team_ids"]:
            return {
                "students": [],
                "total": 0,
                "page": page,
                "per_page": per_page,
                "pages": 0,
                "filters": {
                    "search": search,
                    "skill_ids": requested_skills,
                    "course_id": course_id,
                    "project_id": context["project_id"],
                    "availability": availability,
                    "sort": sort,
                    "order": direction,
                },
            }
        enrolled = db.session.query(CourseEnrollment.student_id).filter(
            CourseEnrollment.course_id == db.session.get(Project, context["project_id"]).course_id
        )
        assigned = (
            db.session.query(TeamMember.student_id)
            .join(Team)
            .filter(Team.project_id == context["project_id"])
        )
        query = query.filter(User.id.in_(enrolled), ~User.id.in_(assigned))

    skill_count = (
        db.session.query(func.count(StudentSkill.skill_id))
        .filter(StudentSkill.student_id == User.id)
        .correlate(User)
        .scalar_subquery()
    )
    sort_column = {
        "name": [User.first_name, User.last_name, User.id],
        "skills": [skill_count, User.first_name, User.last_name, User.id],
        "major": [User.major, User.first_name, User.last_name, User.id],
        "joined_year": [User.joined_year, User.first_name, User.last_name, User.id],
    }[sort]
    order_by = []
    for index, column in enumerate(sort_column):
        column_order = direction if index == 0 else "asc"
        order_by.append(column.asc() if column_order == "asc" else column.desc())
    query = (query.group_by(User.id) if sort == "skills" else query.distinct()).order_by(
        *order_by
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
                student,
                viewer,
                status.get(str(student.id)),
                _availability_for_student(student.id, context),
            )
            for student in students
        ],
        "total": pagination.total,
        "page": pagination.page,
        "per_page": per_page,
        "pages": pagination.pages,
        "filters": {
            "search": search,
            "skill_ids": requested_skills,
            "course_id": course_id,
            "project_id": context["project_id"] if context else None,
            "availability": availability,
            "sort": sort,
            "order": direction,
        },
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
