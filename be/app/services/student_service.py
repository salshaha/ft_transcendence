from datetime import datetime, timezone

from flask import session
from sqlalchemy import exists, func, or_
from sqlalchemy.orm import aliased, joinedload, selectinload

from app.extensions import db
from app.models.student_dashboard import (
    Course,
    CourseEnrollment,
    Project,
    Task,
    Team,
    TeamMember,
)
from app.models.user import User


def get_authenticated_student():
    user_id = session.get("user_id")
    if user_id is None:
        return None, ("Authentication required", 401)

    student = db.session.get(User, user_id)
    if student is None:
        session.clear()
        return None, ("Authenticated user was not found", 401)
    if student.role != "student":
        return None, ("Student role required", 403)

    return student, None


def serialize_profile(student):
    return {
        "id": student.id,
        "student_id": student.student_id,
        "first_name": student.first_name,
        "last_name": student.last_name,
        "full_name": f"{student.first_name} {student.last_name}",
        "email": student.email,
        "major": student.major,
        "joined_year": student.joined_year,
        "domain": student.domain,
        "profile_picture": student.profile_picture,
        "greeting": f"Welcome, {student.first_name}!",
    }


def get_courses(student_id, search=None):
    query = (
        Course.query.join(CourseEnrollment)
        .join(Course.instructor)
        .filter(CourseEnrollment.student_id == student_id)
        .order_by(Course.name.asc(), Course.id.asc())
    )
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(
                Course.name.ilike(pattern),
                User.first_name.ilike(pattern),
                User.last_name.ilike(pattern),
            )
        )

    return [
        {
            "id": course.id,
            "name": course.name,
            "academic_year": course.academic_year,
            "semester": course.semester,
            "instructor": {
                "id": course.instructor.id,
                "first_name": course.instructor.first_name,
                "last_name": course.instructor.last_name,
                "name": (
                    f"{course.instructor.first_name} "
                    f"{course.instructor.last_name}"
                ),
            },
        }
        for course in query.all()
    ]


def get_deadlines(student_id):
    query = (
        Task.query.join(TeamMember, TeamMember.team_id == Task.team_id)
        .options(
            joinedload(Task.team)
            .joinedload(Team.project)
            .joinedload(Project.course)
        )
        .filter(
            TeamMember.student_id == student_id,
            Task.due_date.is_not(None),
            Task.due_date >= datetime.now(timezone.utc),
            or_(Task.assignee_id.is_(None), Task.assignee_id == student_id),
        )
        .order_by(Task.due_date.asc(), Task.id.asc())
    )

    return [
        {
            "id": task.id,
            "title": task.title,
            "description": task.description,
            "due_date": task.due_date.isoformat(),
            "status": task.status,
            "team": {
                "id": task.team.id,
                "name": task.team.name,
            },
            "course": {
                "id": task.team.project.course.id,
                "name": task.team.project.course.name,
            },
            "type": None,
        }
        for task in query.all()
    ]


def get_available_teams(student_id):
    member_count = (
        db.session.query(func.count(TeamMember.student_id))
        .filter(TeamMember.team_id == Team.id)
        .correlate(Team)
        .scalar_subquery()
    )
    enrolled_in_course = (
        db.session.query(CourseEnrollment.student_id)
        .filter(
            CourseEnrollment.student_id == student_id,
            CourseEnrollment.course_id == Course.id,
        )
        .correlate(Course)
        .exists()
    )
    member_team = aliased(Team)
    already_in_project = (
        db.session.query(TeamMember.team_id)
        .join(member_team, TeamMember.team_id == member_team.id)
        .filter(
            TeamMember.student_id == student_id,
            member_team.project_id == Project.id,
        )
        .correlate(Team, Project)
        .exists()
    )

    teams = (
        Team.query.join(Team.project)
        .join(Project.course)
        .options(
            joinedload(Team.project).joinedload(Project.course),
            selectinload(Team.members).joinedload(TeamMember.student),
        )
        .filter(
            enrolled_in_course,
            ~already_in_project,
            member_count < Project.max_members_per_team,
        )
        .order_by(Team.name.asc(), Team.id.asc())
        .all()
    )

    return [
        {
            "id": team.id,
            "name": team.name,
            "project": {
                "id": team.project.id,
                "name": None,
            },
            "course": {
                "id": team.project.course.id,
                "name": team.project.course.name,
            },
            "max_members": team.project.max_members_per_team,
            "current_member_count": len(team.members),
            "available_spots": team.project.max_members_per_team - len(team.members),
            "members": [
                {
                    "id": member.student.id,
                    "student_id": member.student.student_id,
                    "name": (
                        f"{member.student.first_name} "
                        f"{member.student.last_name}"
                    ),
                }
                for member in team.members
            ],
        }
        for team in teams
    ]


def join_team(student_id, team_id):
    team = (
        db.session.query(Team)
        .options(joinedload(Team.project))
        .filter(Team.id == team_id)
        .with_for_update(of=Team)
        .one_or_none()
    )
    if team is None:
        return None, ("Team not found", 404)

    enrolled = (
        db.session.query(CourseEnrollment)
        .filter_by(
            student_id=student_id,
            course_id=team.project.course_id,
        )
        .first()
    )
    if enrolled is None:
        return None, ("Student is not enrolled in this team's course", 403)

    membership = TeamMember.query.filter_by(
        team_id=team.id, student_id=student_id
    ).first()
    if membership is not None:
        return None, ("Student is already a member of this team", 409)

    project_membership = (
        TeamMember.query.join(Team)
        .filter(
            TeamMember.student_id == student_id,
            Team.project_id == team.project_id,
        )
        .first()
    )
    if project_membership is not None:
        return None, ("Student already belongs to a team in this project", 409)

    member_count = TeamMember.query.filter_by(team_id=team.id).count()
    if member_count >= team.project.max_members_per_team:
        return None, ("Team is full", 409)

    membership = TeamMember(team_id=team.id, student_id=student_id)
    db.session.add(membership)
    return membership, None


def get_dashboard(student):
    return {
        "student": serialize_profile(student),
        "courses": get_courses(student.id),
        "deadlines": get_deadlines(student.id),
        "available_teams": get_available_teams(student.id),
    }
