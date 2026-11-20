from datetime import datetime, timezone

from sqlalchemy import func, or_
from sqlalchemy.orm import aliased, joinedload, selectinload

from app.extensions import db
from app.models.grade import Grade
from app.models.peer_feedback import PeerFeedback
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


def get_authenticated_student():
    return get_authenticated_user(allowed_roles={"student"})


def serialize_profile(student):
    skills = [
        {
            "skill_id": ss.skill_id,
            "name": ss.skill.name,
            "category": ss.skill.category,
            "proficiency_level": ss.proficiency_level,
        }
        for ss in getattr(student, "skills", [])
    ]
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
        "gpa": float(student.gpa.gpa) if student.gpa else None,
        "skills": skills,
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


def _parse_datetime(value):
    if value is None or value == "":
        return None
    if not isinstance(value, str):
        raise ValueError("deadline must be an ISO-8601 datetime")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def get_course_project(student_id, course_id):
    enrolled = CourseEnrollment.query.filter_by(
        student_id=student_id, course_id=course_id
    ).first()
    if enrolled is None:
        return None
    course = Course.query.get(course_id)
    if course is None or course.project is None:
        return None
    project = course.project
    return {
        "course": {"id": course.id, "name": course.name},
        "project": {
            "id": project.id,
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
            } if project.requirements_file_key else None,
        },
    }


def create_team(student_id, data):
    project_id = data.get("project_id")
    if project_id is None:
        raise ValueError("project_id is required")
    try:
        project_id = int(project_id)
    except (TypeError, ValueError) as exc:
        raise ValueError("project_id must be an integer") from exc

    project = Project.query.get(project_id)
    if project is None:
        raise LookupError("Project not found")

    enrolled = CourseEnrollment.query.filter_by(
        student_id=student_id, course_id=project.course_id
    ).first()
    if enrolled is None:
        raise PermissionError("Student is not enrolled in this project's course")

    existing = (
        TeamMember.query.join(Team)
        .filter(TeamMember.student_id == student_id, Team.project_id == project.id)
        .first()
    )
    if existing is not None:
        raise ValueError("Student already belongs to a team in this project")

    name = (data.get("name") or "").strip()
    if not name:
        name = f"Team {student_id}"
    if len(name) > 150:
        raise ValueError("Team name must be 150 characters or fewer")

    team = Team(
        project_id=project.id,
        name=name,
        leader_id=student_id,
        status="forming",
    )
    db.session.add(team)
    db.session.flush()
    membership = TeamMember(team_id=team.id, student_id=student_id)
    db.session.add(membership)
    db.session.commit()
    return {
        "id": team.id,
        "name": team.name,
        "project_id": team.project_id,
        "leader_id": team.leader_id,
        "status": team.status,
    }


def leave_team(student_id, team_id):
    membership = TeamMember.query.filter_by(
        team_id=team_id, student_id=student_id
    ).first()
    if membership is None:
        raise LookupError("Membership not found")

    team = Team.query.get(team_id)
    db.session.delete(membership)
    db.session.flush()

    remaining = TeamMember.query.filter_by(team_id=team_id).count()
    if remaining == 0:
        db.session.delete(team)
    elif team.leader_id == student_id:
        new_leader = TeamMember.query.filter_by(team_id=team_id).first()
        team.leader_id = new_leader.student_id if new_leader else None

    db.session.commit()
    return {"message": "Left team successfully"}


def get_team_details(student_id, team_id):
    team = (
        Team.query.options(
            selectinload(Team.members).joinedload(TeamMember.student),
            joinedload(Team.project).joinedload(Project.course),
        )
        .filter(Team.id == team_id)
        .first()
    )
    if team is None:
        raise LookupError("Team not found")

    is_member = any(m.student_id == student_id for m in team.members)
    is_instructor = False
    # allow instructor/admin handled by route; here student only
    if not is_member:
        raise PermissionError("You are not a member of this team")

    return {
        "id": team.id,
        "name": team.name,
        "status": team.status,
        "leader_id": team.leader_id,
        "project": {
            "id": team.project.id,
            "course": {"id": team.project.course.id, "name": team.project.course.name},
        },
        "members": [
            {
                "student_id": m.student.id,
                "name": f"{m.student.first_name} {m.student.last_name}",
                "joined_at": m.joined_at.isoformat() if m.joined_at else None,
            }
            for m in team.members
        ],
    }


def submit_project(student_id, team_id, file_storage):
    membership = TeamMember.query.filter_by(
        team_id=team_id, student_id=student_id
    ).first()
    if membership is None:
        raise PermissionError("You are not a member of this team")

    team = Team.query.get(team_id)
    if team is None:
        raise LookupError("Team not found")

    storage = None
    from flask import current_app

    storage = current_app.extensions["storage"]
    stored = storage.save_upload(
        file_storage, "project_submission", team.id
    )

    submission = Submission.query.filter_by(team_id=team.id).first()
    if submission is None:
        submission = Submission(
            team_id=team.id,
            submitted_by=student_id,
            file_key=stored.key,
            original_name=stored.original_name,
            content_type=stored.content_type,
            size=stored.size,
            sha256=stored.sha256,
        )
        db.session.add(submission)
    else:
        old_key = submission.file_key
        submission.submitted_by = student_id
        submission.file_key = stored.key
        submission.original_name = stored.original_name
        submission.content_type = stored.content_type
        submission.size = stored.size
        submission.sha256 = stored.sha256
        submission.submitted_at = datetime.now(timezone.utc)
        if old_key and old_key != stored.key:
            storage.delete(old_key)

    db.session.commit()
    return {
        "id": submission.id,
        "team_id": submission.team_id,
        "submitted_by": submission.submitted_by,
        "submitted_at": submission.submitted_at.isoformat() if submission.submitted_at else None,
        "file": {
            "key": submission.file_key,
            "original_name": submission.original_name,
            "content_type": submission.content_type,
            "size": submission.size,
            "sha256": submission.sha256,
        },
    }


def get_submission(student_id, team_id):
    membership = TeamMember.query.filter_by(
        team_id=team_id, student_id=student_id
    ).first()
    if membership is None:
        raise PermissionError("You are not a member of this team")

    submission = Submission.query.filter_by(team_id=team_id).first()
    if submission is None:
        return None
    return {
        "id": submission.id,
        "team_id": submission.team_id,
        "submitted_by": submission.submitted_by,
        "submitted_at": submission.submitted_at.isoformat() if submission.submitted_at else None,
        "file": {
            "key": submission.file_key,
            "original_name": submission.original_name,
            "content_type": submission.content_type,
            "size": submission.size,
            "sha256": submission.sha256,
        },
    }


def save_peer_feedback(student_id, data):
    project_id = data.get("project_id")
    to_student_id = data.get("to_student_id")
    if project_id is None or to_student_id is None:
        raise ValueError("project_id and to_student_id are required")
    try:
        project_id = int(project_id)
        to_student_id = int(to_student_id)
    except (TypeError, ValueError) as exc:
        raise ValueError("project_id and to_student_id must be integers") from exc

    project = Project.query.get(project_id)
    if project is None:
        raise LookupError("Project not found")

    # student must be in a team for this project
    membership = (
        TeamMember.query.join(Team)
        .filter(TeamMember.student_id == student_id, Team.project_id == project.id)
        .first()
    )
    if membership is None:
        raise PermissionError("You are not part of a team for this project")

    recipient_membership = (
        TeamMember.query.join(Team)
        .filter(
            TeamMember.student_id == to_student_id, Team.project_id == project.id
        )
        .first()
    )
    if recipient_membership is None:
        raise LookupError("Recipient is not part of a team for this project")
    if int(to_student_id) == int(student_id):
        raise ValueError("Cannot provide feedback to yourself")

    rating = data.get("rating")
    if rating is not None and rating != "":
        try:
            rating = int(rating)
        except (TypeError, ValueError) as exc:
            raise ValueError("rating must be an integer") from exc
        if rating < 1 or rating > 5:
            raise ValueError("rating must be between 1 and 5")
    else:
        rating = None

    feedback_text = data.get("feedback")

    pf = PeerFeedback.query.filter_by(
        project_id=project.id,
        from_student_id=student_id,
        to_student_id=to_student_id,
    ).first()
    if pf is None:
        pf = PeerFeedback(
            project_id=project.id,
            from_student_id=student_id,
            to_student_id=to_student_id,
            rating=rating,
            feedback=feedback_text,
        )
        db.session.add(pf)
    else:
        pf.rating = rating
        pf.feedback = feedback_text

    db.session.commit()
    return {
        "id": pf.id,
        "project_id": pf.project_id,
        "from_student_id": pf.from_student_id,
        "to_student_id": pf.to_student_id,
        "rating": pf.rating,
        "feedback": pf.feedback,
    }


def get_my_grades(student_id):
    grades = (
        Grade.query.filter_by(student_id=student_id)
        .options(joinedload(Grade.project))
        .order_by(Grade.updated_at.desc())
        .all()
    )
    return [
        {
            "id": g.id,
            "project_id": g.project_id,
            "project_title": g.project.title if g.project else None,
            "grade": float(g.grade) if g.grade is not None else None,
            "feedback": g.feedback,
            "published": g.published,
            "updated_at": g.updated_at.isoformat() if g.updated_at else None,
        }
        for g in grades
        if g.published
    ]
