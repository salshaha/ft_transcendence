from datetime import datetime, timezone

from flask import session
from sqlalchemy import func
from sqlalchemy.orm import joinedload, selectinload

from app.extensions import db
from app.models.student_dashboard import (
    Course,
    CourseEnrollment,
    Project,
    Task,
    Team,
)
from app.models.user import User


def get_authenticated_instructor():
    user_id = session.get("user_id")
    if user_id is None:
        return None, ("Authentication required", 401)

    instructor = db.session.get(User, user_id)
    if instructor is None:
        session.clear()
        return None, ("Authenticated user was not found", 401)
    if instructor.role != "instructor":
        return None, ("Instructor role required", 403)

    return instructor, None


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
            "available": False,
            "items": [],
            "reason": "The database schema has no submissions table or relationship.",
        },
        "resources": {
            "available": False,
            "items": [],
            "reason": "The database schema has no course resources table or relationship.",
        },
    }
