import os
from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import joinedload, selectinload
from werkzeug.datastructures import FileStorage

from app.extensions import db
from app.models.grade import Grade, GradeAudit
from app.models.student_dashboard import (
    Course,
    CourseEnrollment,
    Project,
    Task,
    Team,
    TeamMember,
)
from app.models.submission import Submission
from app.models.user import User
from app.services.auth_service import get_authenticated_user


def get_authenticated_instructor():
    return get_authenticated_user(allowed_roles={"instructor"})


def serialize_user(user):
    return {
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "full_name": f"{user.first_name} {user.last_name}",
        "email": user.email,
        "major": user.major,
        "joined_year": user.joined_year,
        "domain": user.domain,
        "profile_picture": user.profile_picture,
        "gpa": float(user.gpa.gpa) if user.gpa else None,
    }


def _course_query(instructor_id):
    return (
        Course.query.filter_by(instructor_id=instructor_id)
        .options(joinedload(Course.project))
        .order_by(Course.name.asc(), Course.id.asc())
    )


def get_courses(instructor_id):
    courses = _course_query(instructor_id).all()
    student_counts = dict(
        db.session.query(
            CourseEnrollment.course_id,
            func.count(CourseEnrollment.student_id),
        )
        .join(Course, Course.id == CourseEnrollment.course_id)
        .filter(Course.instructor_id == instructor_id)
        .group_by(CourseEnrollment.course_id)
        .all()
    )

    return [
        {
            "id": course.id,
            "name": course.name,
            "code": course.microsoft_class_id,
            "academic_year": course.academic_year,
            "semester": course.semester,
            "student_count": student_counts.get(course.id, 0),
            "project_id": course.project.id if course.project else None,
        }
        for course in courses
    ]


def get_deadlines(instructor_id):
    now = datetime.now(timezone.utc)
    tasks = (
        Task.query.join(Team, Team.id == Task.team_id)
        .join(Project, Project.id == Team.project_id)
        .join(Course, Course.id == Project.course_id)
        .options(
            joinedload(Task.team)
            .joinedload(Team.project)
            .joinedload(Project.course)
        )
        .filter(
            Course.instructor_id == instructor_id,
            Task.due_date.is_not(None),
            Task.due_date >= now,
        )
        .order_by(Task.due_date.asc(), Task.id.asc())
        .all()
    )

    return [
        {
            "id": task.id,
            "title": task.title,
            "description": task.description,
            "due_date": task.due_date.isoformat(),
            "status": task.status,
            "team": {"id": task.team.id, "name": task.team.name},
            "project": {"id": task.team.project.id},
            "course": {
                "id": task.team.project.course.id,
                "name": task.team.project.course.name,
            },
        }
        for task in tasks
    ]


def get_students(instructor_id):
    students = (
        User.query.join(CourseEnrollment, CourseEnrollment.student_id == User.id)
        .join(Course, Course.id == CourseEnrollment.course_id)
        .filter(Course.instructor_id == instructor_id, User.role == "student")
        .options(selectinload(User.gpa))
        .distinct()
        .order_by(User.last_name.asc(), User.first_name.asc(), User.id.asc())
        .all()
    )
    return [serialize_user(student) for student in students]


def get_projects(instructor_id):
    projects = (
        Project.query.join(Course, Course.id == Project.course_id)
        .options(
            joinedload(Project.course),
            selectinload(Project.teams).selectinload(Team.members),
        )
        .filter(Course.instructor_id == instructor_id)
        .order_by(Project.created_at.desc(), Project.id.desc())
        .all()
    )
    return [
        {
            "id": project.id,
            "course": {"id": project.course.id, "name": project.course.name},
            "title": project.title,
            "description": project.description,
            "deadline": project.deadline.isoformat() if project.deadline else None,
            "requirements": {
                "original_name": project.requirements_original_name,
                "content_type": project.requirements_content_type,
                "size": project.requirements_size,
            } if project.requirements_file_key else None,
            "prd": project.prd,
            "min_members_per_team": project.min_members_per_team,
            "max_members_per_team": project.max_members_per_team,
            "team_count": len(project.teams),
            "teams": [
                {
                    "id": team.id,
                    "name": team.name,
                    "member_count": len(team.members),
                }
                for team in project.teams
            ],
        }
        for project in projects
    ]


def get_dashboard(instructor):
    return {
        "instructor": serialize_user(instructor),
        "courses": get_courses(instructor.id),
        "deadlines": get_deadlines(instructor.id),
        "students": get_students(instructor.id),
        "projects": get_projects(instructor.id),
        "submissions": {
            "available": True,
            "items": [],
            "reason": None,
        },
        "resources": {
            "available": False,
            "items": [],
            "reason": "Course slides and labs are excluded from this phase.",
        },
    }


def _parse_datetime(value):
    if value is None or value == "":
        return None
    if not isinstance(value, str):
        raise ValueError("deadline must be an ISO-8601 datetime")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _parse_int(value, field_name, default=None):
    if value is None or value == "":
        return default
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field_name} must be an integer") from exc


def get_course(instructor_id, course_id):
    return Course.query.filter_by(
        id=course_id, instructor_id=instructor_id
    ).first()


def get_course_students(instructor_id, course_id):
    course = get_course(instructor_id, course_id)
    if course is None:
        return None
    students = (
        User.query.join(CourseEnrollment, CourseEnrollment.student_id == User.id)
        .filter(CourseEnrollment.course_id == course_id, User.role == "student")
        .options(selectinload(User.gpa), selectinload(User.skills))
        .order_by(User.last_name.asc(), User.first_name.asc())
        .all()
    )
    return [serialize_user(student) for student in students]


def serialize_project(project):
    return {
        "id": project.id,
        "course_id": project.course_id,
        "title": project.title,
        "description": project.description,
        "deadline": project.deadline.isoformat() if project.deadline else None,
        "min_members_per_team": project.min_members_per_team,
        "max_members_per_team": project.max_members_per_team,
        "prd": project.prd,
        "requirements": {
            "file_key": project.requirements_file_key,
            "original_name": project.requirements_original_name,
            "content_type": project.requirements_content_type,
            "size": project.requirements_size,
            "sha256": project.requirements_sha256,
        } if project.requirements_file_key else None,
        "created_at": project.created_at.isoformat() if project.created_at else None,
    }


def create_project(instructor_id, course_id, data):
    course = get_course(instructor_id, course_id)
    if course is None:
        raise LookupError("Course not found")
    if course.project is not None:
        raise ValueError("Course already has a project")

    min_members = _parse_int(
        data.get("min_members_per_team"), "min_members_per_team", 1
    )
    max_members = _parse_int(
        data.get("max_members_per_team"), "max_members_per_team", min_members
    )
    if min_members is None or min_members < 1:
        raise ValueError("min_members_per_team must be at least 1")
    if max_members is None or max_members < min_members:
        raise ValueError(
            "max_members_per_team must be >= min_members_per_team"
        )

    deadline = _parse_datetime(data.get("deadline"))
    project = Project(
        course_id=course.id,
        title=(data.get("title") or "").strip() or None,
        description=data.get("description"),
        deadline=deadline,
        min_members_per_team=min_members,
        max_members_per_team=max_members,
        prd=data.get("prd") or data.get("description") or "",
    )
    db.session.add(project)
    db.session.commit()
    return serialize_project(project)


def update_project(instructor_id, project_id, data):
    project = (
        Project.query.join(Course, Course.id == Project.course_id)
        .filter(Project.id == project_id, Course.instructor_id == instructor_id)
        .first()
    )
    if project is None:
        raise LookupError("Project not found")

    if "min_members_per_team" in data or "max_members_per_team" in data:
        min_members = _parse_int(
            data.get("min_members_per_team", project.min_members_per_team),
            "min_members_per_team",
        )
        max_members = _parse_int(
            data.get("max_members_per_team", project.max_members_per_team),
            "max_members_per_team",
        )
        if min_members < 1:
            raise ValueError("min_members_per_team must be at least 1")
        if max_members < min_members:
            raise ValueError(
                "max_members_per_team must be >= min_members_per_team"
            )
        project.min_members_per_team = min_members
        project.max_members_per_team = max_members

    if "title" in data:
        project.title = (data.get("title") or "").strip() or None
    if "description" in data:
        project.description = data.get("description")
    if "prd" in data:
        project.prd = data.get("prd") or project.prd
    if "deadline" in data:
        project.deadline = _parse_datetime(data.get("deadline"))

    db.session.commit()
    return serialize_project(project)


def delete_project(instructor_id, project_id):
    project = (
        Project.query.join(Course, Course.id == Project.course_id)
        .filter(Project.id == project_id, Course.instructor_id == instructor_id)
        .first()
    )
    if project is None:
        raise LookupError("Project not found")
    db.session.delete(project)
    db.session.commit()
    return {"message": "Project deleted"}


def upload_project_requirements(instructor_id, project_id, file_storage):
    project = (
        Project.query.join(Course, Course.id == Project.course_id)
        .filter(Project.id == project_id, Course.instructor_id == instructor_id)
        .first()
    )
    if project is None:
        raise LookupError("Project not found")

    storage = current_app.extensions["storage"] if False else None
    from flask import current_app

    storage = current_app.extensions["storage"]
    stored = storage.save_upload(
        file_storage, "project_requirements", project.id
    )

    old_key = project.requirements_file_key
    project.requirements_file_key = stored.key
    project.requirements_original_name = stored.original_name
    project.requirements_content_type = stored.content_type
    project.requirements_size = stored.size
    project.requirements_sha256 = stored.sha256
    db.session.commit()

    if old_key and old_key != stored.key:
        storage.delete(old_key)
    return serialize_project(project)


def get_project_teams(instructor_id, project_id):
    project = (
        Project.query.join(Course, Course.id == Project.course_id)
        .filter(Project.id == project_id, Course.instructor_id == instructor_id)
        .first()
    )
    if project is None:
        raise LookupError("Project not found")

    teams = (
        Team.query.filter_by(project_id=project.id)
        .options(selectinload(Team.members).joinedload(TeamMember.student))
        .order_by(Team.name.asc())
        .all()
    )
    return [
        {
            "id": team.id,
            "name": team.name,
            "status": team.status,
            "leader_id": team.leader_id,
            "member_count": len(team.members),
            "members": [
                {
                    "student_id": m.student.id,
                    "name": f"{m.student.first_name} {m.student.last_name}",
                    "joined_at": m.joined_at.isoformat() if m.joined_at else None,
                }
                for m in team.members
            ],
        }
        for team in teams
    ]


def get_project_submissions(instructor_id, project_id):
    project = (
        Project.query.join(Course, Course.id == Project.course_id)
        .filter(Project.id == project_id, Course.instructor_id == instructor_id)
        .first()
    )
    if project is None:
        raise LookupError("Project not found")

    submissions = (
        Submission.query.join(Team, Team.id == Submission.team_id)
        .filter(Team.project_id == project.id)
        .options(joinedload(Submission.team), joinedload(Submission.submitter))
        .order_by(Submission.submitted_at.desc())
        .all()
    )
    return [
        {
            "id": s.id,
            "team_id": s.team_id,
            "team_name": s.team.name if s.team else None,
            "submitted_by": s.submitted_by,
            "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
            "file": {
                "key": s.file_key,
                "original_name": s.original_name,
                "content_type": s.content_type,
                "size": s.size,
                "sha256": s.sha256,
            },
        }
        for s in submissions
    ]


def save_grade(instructor_id, data):
    student_id = data.get("student_id")
    project_id = data.get("project_id")
    if student_id is None or project_id is None:
        raise ValueError("student_id and project_id are required")

    project = (
        Project.query.join(Course, Course.id == Project.course_id)
        .filter(Project.id == project_id, Course.instructor_id == instructor_id)
        .first()
    )
    if project is None:
        raise LookupError("Project not found")

    student = User.query.filter_by(id=student_id, role="student").first()
    if student is None:
        raise LookupError("Student not found")

    grade_value = data.get("grade")
    if grade_value is not None and grade_value != "":
        try:
            grade_value = float(grade_value)
        except (TypeError, ValueError) as exc:
            raise ValueError("grade must be a number") from exc
    else:
        grade_value = None

    feedback = data.get("feedback")
    published = bool(data.get("published", False))

    grade = Grade.query.filter_by(
        student_id=student_id, project_id=project_id
    ).first()
    if grade is None:
        grade = Grade(
            student_id=student_id,
            project_id=project_id,
            grade=grade_value,
            feedback=feedback,
            published=published,
        )
        db.session.add(grade)
        db.session.flush()
    else:
        audit = GradeAudit(
            grade_id=grade.id,
            changed_by=instructor_id,
            old_grade=grade.grade,
            new_grade=grade_value,
            old_feedback=grade.feedback,
            new_feedback=feedback,
        )
        # set changed_by later by route; placeholder
        db.session.add(audit)
        grade.grade = grade_value
        grade.feedback = feedback
        grade.published = published

    db.session.commit()
    return {
        "id": grade.id,
        "student_id": grade.student_id,
        "project_id": grade.project_id,
        "grade": float(grade.grade) if grade.grade is not None else None,
        "feedback": grade.feedback,
        "published": grade.published,
    }
