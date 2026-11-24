from datetime import datetime, timezone

from sqlalchemy import func, nullslast, or_, text
from sqlalchemy.orm import joinedload, selectinload

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
from app.services import presence_service

PROFICIENCY_LABELS = {
    1: "Beginner",
    2: "Intermediate",
    3: "Advanced",
    4: "Expert",
    5: "Expert",
}
CLOSED_TEAM_STATUSES = {"closed", "complete", "completed", "locked", "submitted"}


def get_authenticated_student():
    return get_authenticated_user(allowed_roles={"student"})


def _lock_team_assignment(student_id):
    if db.engine.dialect.name == "postgresql":
        db.session.execute(
            text("SELECT pg_advisory_xact_lock(:student_key)"),
            {"student_key": int(student_id)},
        )


def _team_join_state(student_id, team, member_count=None):
    if member_count is None:
        member_count = TeamMember.query.filter_by(team_id=team.id).count()
    max_members = team.project.max_members_per_team
    is_member = any(
        member.student_id == student_id for member in getattr(team, "members", [])
    )
    if not is_member:
        is_member = (
            TeamMember.query.filter_by(
                team_id=team.id, student_id=student_id
            ).first()
            is not None
        )
    already_in_project = (
        TeamMember.query.join(Team)
        .filter(
            TeamMember.student_id == student_id,
            Team.project_id == team.project_id,
            TeamMember.team_id != team.id,
        )
        .first()
        is not None
    )
    status = (team.status or "").strip().lower()
    available_spots = max(0, max_members - member_count)
    reasons = []
    if is_member:
        reasons.append("You are already a member of this team")
    if already_in_project:
        reasons.append("Leave your current team before joining another team")
    if status in CLOSED_TEAM_STATUSES:
        reasons.append("Team is not accepting new members")
    if available_spots <= 0:
        reasons.append("Team is full")
    return {
        "is_member": is_member,
        "already_in_project": already_in_project,
        "can_join": not reasons,
        "join_blocked_reason": " ".join(reasons) if reasons else None,
        "current_member_count": member_count,
        "max_members": max_members,
        "available_spots": available_spots,
    }


def serialize_team_members(team, viewer_id=None):
    members = list(getattr(team, "members", []))
    status = presence_service.get_status([member.student_id for member in members])
    result = []
    for member in members:
        student = member.student
        member_status = status.get(str(member.student_id), {})
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
        result.append({
            "id": student.id,
            "student_id": student.student_id,
            "profile_user_id": student.id,
            "name": f"{student.first_name} {student.last_name}",
            "full_name": f"{student.first_name} {student.last_name}",
            "first_name": student.first_name,
            "last_name": student.last_name,
            "profile_picture": student.profile_picture,
            "avatar_url": (
                f"/api/users/{student.id}/avatar" if student.profile_picture else None
            ),
            "major": student.major,
            "domain": student.domain,
            "skills": skills,
            "joined_at": member.joined_at.isoformat() if member.joined_at else None,
            "is_online": member_status.get("online", False),
            "last_seen": member_status.get("last_seen"),
            "is_viewer": viewer_id is not None and viewer_id == student.id,
        })
    return result


def serialize_team(team, viewer_id=None):
    if team is None:
        return None
    member_count = len(getattr(team, "members", []))
    max_members = team.project.max_members_per_team
    return {
        "id": team.id,
        "name": team.name,
        "status": team.status,
        "leader_id": team.leader_id,
        "description": team.project.description,
        "project": {
            "id": team.project.id,
            "title": team.project.title,
            "name": team.project.title,
            "description": team.project.description,
            "course": {
                "id": team.project.course.id,
                "name": team.project.course.name,
            },
        },
        "current_member_count": member_count,
        "max_members": max_members,
        "available_spots": max(0, max_members - member_count),
        "members": serialize_team_members(team, viewer_id),
    }


def serialize_current_project(student_id, viewer_id=None, course_ids=None):
    query = (
        Project.query.join(Project.course)
        .join(CourseEnrollment, CourseEnrollment.course_id == Course.id)
        .filter(CourseEnrollment.student_id == student_id)
    )
    if course_ids is not None:
        query = query.filter(Course.id.in_(course_ids))
    project = query.order_by(
        nullslast(Project.deadline.desc()), Project.id.desc()
    ).first()
    if project is None:
        return None

    team = (
        Team.query.options(
            selectinload(Team.members).joinedload(TeamMember.student),
            joinedload(Team.project).joinedload(Project.course),
        )
        .join(TeamMember, TeamMember.team_id == Team.id)
        .filter(Team.project_id == project.id, TeamMember.student_id == student_id)
        .first()
    )
    return {
        "id": project.id,
        "title": project.title,
        "description": project.description,
        "deadline": project.deadline.isoformat() if project.deadline else None,
        "status": team.status if team else None,
        "course": {
            "id": project.course.id,
            "name": project.course.name,
            "academic_year": project.course.academic_year,
            "semester": project.course.semester,
        },
        "team": serialize_team(team, viewer_id) if team else None,
    }


def serialize_profile(student):
    skills = [
        {
            "skill_id": ss.skill_id,
            "name": ss.skill.name,
            "category": ss.skill.category,
            "proficiency_level": ss.proficiency_level,
            "proficiency_label": PROFICIENCY_LABELS.get(
                ss.proficiency_level, "Intermediate"
            ),
        }
        for ss in getattr(student, "skills", [])
    ]
    presence = presence_service.get_status([student.id]).get(str(student.id), {})
    current_project = serialize_current_project(student.id, student.id)
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
        "avatar_url": (
            f"/api/users/{student.id}/avatar" if student.profile_picture else None
        ),
        "gpa": float(student.gpa.gpa) if student.gpa else None,
        "skills": skills,
        "is_online": presence.get("online", False),
        "last_seen": presence.get("last_seen"),
        "courses": get_courses(student.id),
        "current_project": current_project,
        "team": current_project.get("team") if current_project else None,
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
    enrolled_in_course = (
        db.session.query(CourseEnrollment.student_id)
        .filter(
            CourseEnrollment.student_id == student_id,
            CourseEnrollment.course_id == Course.id,
        )
        .correlate(Course)
        .exists()
    )

    teams = (
        Team.query.join(Team.project)
        .join(Project.course)
        .options(
            joinedload(Team.project).joinedload(Project.course),
            selectinload(Team.members).joinedload(TeamMember.student),
        )
        .filter(enrolled_in_course)
        .order_by(Team.name.asc(), Team.id.asc())
        .all()
    )

    result = []
    for team in teams:
        members = serialize_team_members(team, student_id)
        state = _team_join_state(student_id, team, len(members))
        result.append({
            "id": team.id,
            "name": team.name,
            "status": team.status,
            "description": team.project.description,
            "project": {
                "id": team.project.id,
                "name": team.project.title,
                "title": team.project.title,
            },
            "course": {
                "id": team.project.course.id,
                "name": team.project.course.name,
            },
            "members": members,
            **state,
        })
    return result


def join_team(student_id, team_id):
    _lock_team_assignment(student_id)
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

    if (team.status or "").strip().lower() in CLOSED_TEAM_STATUSES:
        return None, ("Team is not accepting new members", 409)

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
        return None, (
            "Leave your current team before joining another team in this project",
            409,
        )

    member_count = TeamMember.query.filter_by(team_id=team.id).count()
    if member_count >= team.project.max_members_per_team:
        return None, ("Team is full", 409)

    membership = TeamMember(team_id=team.id, student_id=student_id)
    db.session.add(membership)
    db.session.flush()
    return membership, None


def get_dashboard(student):
    return {
        "student": serialize_profile(student),
        "courses": get_courses(student.id),
        "deadlines": get_deadlines(student.id),
        "available_teams": get_available_teams(student.id),
    }


def get_my_teams(student_id):
    team_ids = [
        team_id
        for (team_id,) in db.session.query(Team.id)
        .join(TeamMember, TeamMember.team_id == Team.id)
        .filter(TeamMember.student_id == student_id)
        .order_by(Team.id.asc())
        .all()
    ]
    return [get_team_details(student_id, team_id) for team_id in team_ids]


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
    course = Course.query.options(joinedload(Course.projects)).get(course_id)
    if course is None or not course.projects:
        return None

    def serialize_project(project):
        return {
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
        }

    projects = [
        serialize_project(project)
        for project in sorted(course.projects, key=lambda item: item.id, reverse=True)
    ]
    return {
        "course": {"id": course.id, "name": course.name},
        "projects": projects,
        "project": projects[0],
    }


def get_course_teams(student_id, course_id, project_id=None):
    data = get_course_project(student_id, course_id)
    if data is None:
        return None

    selected_project = data["project"]
    if project_id is not None:
        try:
            selected_project_id = int(project_id)
        except (TypeError, ValueError):
            return None
        selected_project = next(
            (
                project
                for project in data.get("projects", [])
                if project["id"] == selected_project_id
            ),
            None,
        )
        if selected_project is None:
            return None

    data["project"] = selected_project
    teams = (
        Team.query.options(
            selectinload(Team.members).joinedload(TeamMember.student)
        )
        .filter(Team.project_id == selected_project["id"])
        .order_by(Team.name.asc(), Team.id.asc())
        .all()
    )

    serialized_teams = []
    for team in teams:
        members = serialize_team_members(team, student_id)
        state = _team_join_state(student_id, team, len(members))
        serialized_teams.append({
            "id": team.id,
            "name": team.name,
            "status": team.status,
            "leader_id": team.leader_id,
            "members": members,
            **state,
        })
    data["teams"] = serialized_teams
    return data


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
    if Team.query.filter_by(project_id=project.id, name=name).first():
        raise ValueError("A team with this name already exists in this project")

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
    _lock_team_assignment(student_id)
    team = (
        db.session.query(Team)
        .options(joinedload(Team.project).joinedload(Project.course))
        .filter(Team.id == team_id)
        .with_for_update(of=Team)
        .one_or_none()
    )
    if team is None:
        raise LookupError("Team not found")

    membership = TeamMember.query.filter_by(
        team_id=team_id, student_id=student_id
    ).with_for_update(of=TeamMember).first()
    if membership is None:
        raise LookupError("You are not a member of this team")

    db.session.delete(membership)
    db.session.flush()

    remaining = TeamMember.query.filter_by(team_id=team_id).count()
    if team.leader_id == student_id:
        new_leader = (
            TeamMember.query.filter_by(team_id=team_id)
            .order_by(TeamMember.student_id.asc())
            .first()
        )
        team.leader_id = new_leader.student_id if new_leader else None

    db.session.commit()
    return {
        "message": "Left team successfully",
        "team_id": team.id,
        "team": serialize_team(team, None),
        "current_member_count": remaining,
        "max_members": team.project.max_members_per_team,
        "available_spots": max(0, team.project.max_members_per_team - remaining),
    }


def get_team_preview(student_id, team_id):
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

    enrolled = CourseEnrollment.query.filter_by(
        student_id=student_id, course_id=team.project.course_id
    ).first()
    if enrolled is None:
        raise PermissionError("You are not enrolled in this team's course")

    members = serialize_team_members(team, student_id)
    state = _team_join_state(student_id, team, len(members))
    return {
        "team": {
            "id": team.id,
            "name": team.name,
            "status": team.status,
            "leader_id": team.leader_id,
            "description": team.project.description,
            "project": {
                "id": team.project.id,
                "title": team.project.title,
                "name": team.project.title,
                "description": team.project.description,
                "deadline": (
                    team.project.deadline.isoformat()
                    if team.project.deadline
                    else None
                ),
                "course": {
                    "id": team.project.course.id,
                    "name": team.project.course.name,
                },
            },
            "members": members,
            **state,
        }
    }


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
            {**member, "student_id": member["id"]}
            for member in serialize_team_members(team, student_id)
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
