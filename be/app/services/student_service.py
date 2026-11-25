from datetime import datetime, timezone

from flask import current_app
from sqlalchemy import func, nullslast, or_, text
from sqlalchemy.orm import joinedload, selectinload

from app.extensions import db
from app.models.grade import Grade
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
from app.realtime import emit_submission_event, revoke_team_access
from app.services.auth_service import get_authenticated_user
from app.services import presence_service
from app.services.peer_feedback_service import (
    peer_feedback_rules,
    project_has_ended,
    save_peer_feedback,
)
from app.services.storage import FILE_RULES, StorageError

PROFICIENCY_LABELS = {
    1: "Beginner",
    2: "Intermediate",
    3: "Advanced",
    4: "Expert",
    5: "Expert",
}
CLOSED_TEAM_STATUSES = {"closed", "complete", "completed", "locked", "submitted"}
LOCKED_TEAM_STATUSES = {"locked", "restricted", "submitted", "closed", "complete", "completed"}


def submission_file_rules():
    rule = FILE_RULES["project_submission"]
    return {
        "accepted_extensions": sorted(rule.extensions),
        "accepted_mime_types": sorted(rule.mime_types),
        "max_size_bytes": int(current_app.config[rule.limit_config_key]),
    }


def _deadline_utc(project):
    deadline = project.deadline
    if deadline is None:
        return None
    if deadline.tzinfo is None:
        return deadline.replace(tzinfo=timezone.utc)
    return deadline.astimezone(timezone.utc)


def _submission_result(submission, deadline):
    submitted_at = submission.submitted_at
    if submitted_at is not None and submitted_at.tzinfo is None:
        submitted_at = submitted_at.replace(tzinfo=timezone.utc)
    on_time = deadline is None or (
        submitted_at is not None and submitted_at <= deadline
    )
    return {
        "id": submission.id,
        "team_id": submission.team_id,
        "project_id": submission.team.project_id if submission.team else None,
        "submitted_by": submission.submitted_by,
        "submitter": (
            {
                "id": submission.submitter.id,
                "name": f"{submission.submitter.first_name} {submission.submitter.last_name}",
            }
            if submission.submitter else None
        ),
        "submitted_at": submitted_at.isoformat() if submitted_at else None,
        "deadline": deadline.isoformat() if deadline else None,
        "status": "on_time" if on_time else "late",
        "on_time": on_time,
        "file": {
            "key": submission.file_key,
            "original_name": submission.original_name,
            "content_type": submission.content_type,
            "size": submission.size,
            "sha256": submission.sha256,
            "url": f"/api/student/teams/{submission.team_id}/submission/file",
        },
    }


def _serialize_membership_team(student_id, team_id):
    team = (
        Team.query.options(joinedload(Team.project))
        .filter(Team.id == team_id)
        .first()
    )
    if team is None:
        raise LookupError("Team not found")
    membership = TeamMember.query.filter_by(
        team_id=team_id, student_id=student_id
    ).first()
    if membership is None:
        raise PermissionError("You are not a member of this team")
    return team


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
    min_members = team.project.min_members_per_team
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
    hard_reasons = []
    if is_member:
        hard_reasons.append("You are already a member of this team")
    if status in CLOSED_TEAM_STATUSES:
        hard_reasons.append("Team is not accepting new members")
    if available_spots <= 0:
        hard_reasons.append("Team is full")
    join_blocked_reason = " ".join(hard_reasons) if hard_reasons else None
    if already_in_project and not hard_reasons:
        join_blocked_reason = "Leave your current team before joining another team"
    can_join_now = len(hard_reasons) == 0 and not already_in_project
    return {
        "is_member": is_member,
        "already_in_project": already_in_project,
        "requires_leave_current_team": already_in_project and not is_member,
        "can_join": can_join_now,
        "can_join_after_leaving": len(hard_reasons) == 0 and not is_member,
        "join_blocked_reason": join_blocked_reason,
        "current_member_count": member_count,
        "min_members": min_members,
        "max_members": max_members,
        "available_spots": available_spots,
        "is_full": available_spots <= 0,
        "is_closed": status in CLOSED_TEAM_STATUSES,
        "meets_min_size": member_count >= min_members,
        "min_size_deficit": max(0, min_members - member_count),
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
    min_members = team.project.min_members_per_team
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
            "deadline": team.project.deadline.isoformat() if team.project.deadline else None,
            "peer_feedback_available": project_has_ended(team.project),
            "peer_feedback_rules": peer_feedback_rules(),
            "course": {
                "id": team.project.course.id,
                "name": team.project.course.name,
            },
        },
        "current_member_count": member_count,
        "min_members": min_members,
        "max_members": max_members,
        "available_spots": max(0, max_members - member_count),
        "meets_min_size": member_count >= min_members,
        "min_size_deficit": max(0, min_members - member_count),
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
        "submission_file_rules": submission_file_rules(),
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

    restriction = _team_restriction_reason(team)
    if restriction:
        return None, (restriction, 409)

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
            TeamMember.team_id != team.id,
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
    course = Course.query.options(
        joinedload(Course.instructor),
        joinedload(Course.projects),
    ).get(course_id)
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
            "submission_file_rules": submission_file_rules(),
            "peer_feedback_available": project_has_ended(project),
            "peer_feedback_rules": peer_feedback_rules(),
        }

    projects = [
        serialize_project(project)
        for project in sorted(course.projects, key=lambda item: item.id, reverse=True)
    ]
    classmates = (
        User.query.join(CourseEnrollment, CourseEnrollment.student_id == User.id)
        .filter(CourseEnrollment.course_id == course.id, User.role == "student")
        .order_by(User.first_name.asc(), User.last_name.asc(), User.id.asc())
        .all()
    )
    return {
        "course": {
            "id": course.id,
            "name": course.name,
            "instructor": {
                "id": course.instructor.id,
                "name": f"{course.instructor.first_name} {course.instructor.last_name}",
                "first_name": course.instructor.first_name,
                "last_name": course.instructor.last_name,
                "email": course.instructor.email,
            } if course.instructor else None,
        },
        "projects": projects,
        "project": projects[0],
        "classmates": [
            {
                "id": student.id,
                "name": f"{student.first_name} {student.last_name}",
                "first_name": student.first_name,
                "last_name": student.last_name,
                "email": student.email if student.id == student_id else None,
                "is_self": student.id == student_id,
                "profile_picture": student.profile_picture,
                "avatar_url": f"/api/users/{student.id}/avatar" if student.profile_picture else None,
            }
            for student in classmates
        ],
    }


def get_course_teams(student_id, course_id, project_id=None, search=None, availability=None):
    data = get_course_project(student_id, course_id)
    if data is None:
        return None

    project_ids = [project["id"] for project in data.get("projects", [])]
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
        project_ids = [selected_project_id]

    data["project"] = selected_project
    query = (
        Team.query.options(
            joinedload(Team.project).joinedload(Project.course),
            selectinload(Team.members).joinedload(TeamMember.student),
        )
        .filter(Team.project_id.in_(project_ids))
        .order_by(Team.name.asc(), Team.id.asc())
    )
    if isinstance(search, str) and search.strip():
        query = query.filter(Team.name.ilike(f"%{search.strip()}%"))
    teams = query.all()

    serialized_teams = []
    availability = (availability or "").strip().lower()
    for team in teams:
        members = serialize_team_members(team, student_id)
        state = _team_join_state(student_id, team, len(members))
        is_available = (
            not state.get("is_member")
            and not state.get("is_closed")
            and not state.get("is_full")
        )
        if availability == "available" and not is_available:
            continue
        if availability == "full" and not state.get("is_full"):
            continue
        if availability == "closed" and not state.get("is_closed"):
            continue
        serialized_teams.append({
            "id": team.id,
            "name": team.name,
            "status": team.status,
            "leader_id": team.leader_id,
            "description": team.project.description,
            "project": {
                "id": team.project.id,
                "title": team.project.title,
                "name": team.project.title,
                "course": {
                    "id": team.project.course.id,
                    "name": team.project.course.name,
                },
            },
            "members": members,
            "is_available": is_available,
            **state,
        })
    data["teams"] = serialized_teams
    data["filters"] = {"search": search or "", "availability": availability}
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


def _team_restriction_reason(team):
    status = (team.status or "").strip().lower()
    submission = Submission.query.filter_by(team_id=team.id).first()
    now = datetime.now(timezone.utc)
    deadline = team.project.deadline
    if deadline is not None and deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    if status in LOCKED_TEAM_STATUSES:
        return "This team is locked and cannot be changed right now."
    if submission is not None:
        return "This team has already submitted the project and membership cannot be changed."
    if deadline is not None and deadline < now:
        return "The project deadline has passed, so team membership cannot be changed."
    return None


def leave_team(student_id, team_id):
    _lock_team_assignment(student_id)
    team = (
        db.session.query(Team)
        .options(
            joinedload(Team.project).joinedload(Project.course),
            selectinload(Team.members).joinedload(TeamMember.student),
        )
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

    restriction = _team_restriction_reason(team)
    if restriction:
        raise ValueError(restriction)

    db.session.delete(membership)
    db.session.flush()

    remaining_members = (
        TeamMember.query.options(joinedload(TeamMember.student))
        .filter_by(team_id=team_id)
        .order_by(TeamMember.joined_at.asc(), TeamMember.student_id.asc())
        .all()
    )
    remaining = len(remaining_members)
    if team.leader_id == student_id:
        new_leader = remaining_members[0] if remaining_members else None
        team.leader_id = new_leader.student_id if new_leader else None

    db.session.commit()
    revoke_team_access(student_id, team_id)
    refreshed = (
        Team.query.options(
            selectinload(Team.members).joinedload(TeamMember.student),
            joinedload(Team.project).joinedload(Project.course),
        )
        .filter(Team.id == team_id)
        .first()
    )
    return {
        "message": "Left team successfully",
        "team_id": team.id,
        "team": serialize_team(refreshed, student_id),
        "current_member_count": remaining,
        "min_members": team.project.min_members_per_team,
        "max_members": team.project.max_members_per_team,
        "available_spots": max(0, team.project.max_members_per_team - remaining),
        "meets_min_size": remaining >= team.project.min_members_per_team,
    }


def remove_team_member(actor_id, team_id, member_id):
    _lock_team_assignment(member_id)
    team = (
        db.session.query(Team)
        .options(
            joinedload(Team.project).joinedload(Project.course),
            selectinload(Team.members).joinedload(TeamMember.student),
        )
        .filter(Team.id == team_id)
        .with_for_update(of=Team)
        .one_or_none()
    )
    if team is None:
        raise LookupError("Team not found")
    if team.leader_id != actor_id:
        raise PermissionError("Only the team leader can remove members")
    if int(member_id) == int(actor_id):
        raise ValueError("Team leader cannot remove themselves. Transfer leadership or leave the team.")

    membership = TeamMember.query.filter_by(team_id=team_id, student_id=member_id).first()
    if membership is None:
        raise LookupError("Member not found in this team")

    restriction = _team_restriction_reason(team)
    if restriction:
        raise ValueError(restriction)

    db.session.delete(membership)
    db.session.commit()
    revoke_team_access(member_id, team_id)
    refreshed = (
        Team.query.options(
            selectinload(Team.members).joinedload(TeamMember.student),
            joinedload(Team.project).joinedload(Project.course),
        )
        .filter(Team.id == team_id)
        .first()
    )
    remaining = len(refreshed.members) if refreshed else 0
    return {
        "message": "Member removed successfully",
        "team": serialize_team(refreshed, actor_id),
        "current_member_count": remaining,
    }


def transfer_team_leadership(actor_id, team_id, new_leader_id):
    team = (
        db.session.query(Team)
        .options(
            joinedload(Team.project).joinedload(Project.course),
            selectinload(Team.members).joinedload(TeamMember.student),
        )
        .filter(Team.id == team_id)
        .with_for_update(of=Team)
        .one_or_none()
    )
    if team is None:
        raise LookupError("Team not found")
    if team.leader_id != actor_id:
        raise PermissionError("Only the team leader can transfer leadership")
    if int(new_leader_id) == int(actor_id):
        raise ValueError("You are already the team leader")

    membership = TeamMember.query.filter_by(team_id=team_id, student_id=new_leader_id).first()
    if membership is None:
        raise LookupError("Selected member is not in this team")

    restriction = _team_restriction_reason(team)
    if restriction:
        raise ValueError(restriction)

    team.leader_id = int(new_leader_id)
    db.session.commit()
    refreshed = (
        Team.query.options(
            selectinload(Team.members).joinedload(TeamMember.student),
            joinedload(Team.project).joinedload(Project.course),
        )
        .filter(Team.id == team_id)
        .first()
    )
    return {
        "message": "Leadership transferred successfully",
        "team": serialize_team(refreshed, actor_id),
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
    if not is_member:
        raise PermissionError("You are not a member of this team")

    data = serialize_team(team, student_id)
    data["members"] = [
        {**member, "student_id": member["id"]} for member in data["members"]
    ]
    return data


def submit_project(student_id, team_id, file_storage):
    team = _serialize_membership_team(student_id, team_id)
    deadline = _deadline_utc(team.project)
    if deadline is not None and datetime.now(timezone.utc) > deadline:
        raise ValueError(
            "The project deadline has passed. Late submissions are not allowed."
        )

    member_count = TeamMember.query.filter_by(team_id=team.id).count()
    min_members = team.project.min_members_per_team
    if member_count < min_members:
        raise ValueError(
            f"Team must have at least {min_members} members before submission. "
            f"Current members: {member_count}."
        )

    storage = current_app.extensions["storage"]
    stored = storage.save_upload(file_storage, "project_submission", team.id)

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
    result = _submission_result(submission, deadline)
    emit_submission_event(result)
    return result


def get_submission(student_id, team_id):
    team = _serialize_membership_team(student_id, team_id)
    submission = Submission.query.filter_by(team_id=team.id).first()
    if submission is None:
        return None
    return _submission_result(submission, _deadline_utc(team.project))


def read_submission_file(student_id, team_id):
    team = _serialize_membership_team(student_id, team_id)
    submission = Submission.query.filter_by(team_id=team.id).first()
    if submission is None:
        raise LookupError("No submission has been uploaded for this team")
    storage = current_app.extensions["storage"]
    try:
        stream = storage.open(submission.file_key)
    except (StorageError, OSError) as exc:
        raise StorageError("Unable to read the submitted file") from exc
    return stream, submission.content_type, submission.original_name


def _serialize_student_grade(grade):
    published = bool(grade.published)
    return {
        "id": grade.id,
        "student_id": grade.student_id,
        "project_id": grade.project_id,
        "project_title": grade.project.title if grade.project else None,
        "course_id": grade.project.course_id if grade.project else None,
        "course_title": (
            grade.project.course.name
            if grade.project and grade.project.course
            else None
        ),
        "grade": float(grade.grade) if published and grade.grade is not None else None,
        "feedback": grade.feedback if published else None,
        "published": published,
        "status": "Published" if published else "Not Published Yet",
        "published_at": grade.published_at.isoformat() if published and grade.published_at else None,
        "updated_at": grade.updated_at.isoformat() if grade.updated_at else None,
    }


def get_my_grades(student_id):
    grades = (
        Grade.query.filter_by(student_id=student_id)
        .options(joinedload(Grade.project).joinedload(Project.course))
        .order_by(Grade.updated_at.desc())
        .all()
    )
    serialized = [_serialize_student_grade(grade) for grade in grades]
    courses = (
        Course.query.join(CourseEnrollment, CourseEnrollment.course_id == Course.id)
        .filter(CourseEnrollment.student_id == student_id)
        .options(selectinload(Course.projects))
        .order_by(Course.name.asc(), Course.id.asc())
        .all()
    )
    grouped_courses = []
    for course in courses:
        items = [item for item in serialized if item["course_id"] == course.id]
        published_values = [
            item["grade"]
            for item in items
            if item["published"] and item["grade"] is not None
        ]
        grouped_courses.append(
            {
                "id": course.id,
                "name": course.name,
                "academic_year": course.academic_year,
                "semester": course.semester,
                "course_grade": (
                    round(sum(published_values) / len(published_values), 2)
                    if published_values
                    else None
                ),
                "final_grade": None,
                "final_grade_available": False,
                "grades": items,
            }
        )
    return {"grades": serialized, "courses": grouped_courses}
