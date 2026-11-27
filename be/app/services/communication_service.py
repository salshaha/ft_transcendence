from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models.communication import TeamMessage
from app.models.student_dashboard import Project, Team, TeamMember
from app.realtime import emit_team_message_event

MESSAGE_MAX_LENGTH = 4000


def _now():
    return datetime.now(timezone.utc)


def _iso(value):
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def _load_membership(user_id, team_id):
    team = (
        Team.query.options(
            joinedload(Team.project).joinedload(Project.course)
        )
        .filter(Team.id == team_id)
        .first()
    )
    if team is None:
        raise LookupError("Team not found")
    membership = TeamMember.query.filter_by(
        team_id=team.id, student_id=user_id
    ).first()
    if membership is None:
        raise PermissionError("You are not a member of this team")
    return team, membership


def _serialize_sender(user):
    if user is None:
        return {
            "id": None,
            "name": "Former member",
            "full_name": "Former member",
            "first_name": "",
            "last_name": "",
            "profile_picture": None,
            "avatar_url": None,
        }
    return {
        "id": user.id,
        "name": f"{user.first_name} {user.last_name}",
        "full_name": f"{user.first_name} {user.last_name}",
        "first_name": user.first_name,
        "last_name": user.last_name,
        "profile_picture": user.profile_picture,
        "avatar_url": (
            f"/api/users/{user.id}/avatar" if user.profile_picture else None
        ),
    }


def serialize_message(message):
    return {
        "id": message.id,
        "team_id": message.team_id,
        "sender_id": message.sender_id,
        "sender": _serialize_sender(message.sender),
        "content": message.content,
        "created_at": _iso(message.created_at),
    }


def list_team_chats(user_id):
    memberships = (
        TeamMember.query.options(
            joinedload(TeamMember.team)
            .joinedload(Team.project)
            .joinedload(Project.course)
        )
        .filter(TeamMember.student_id == user_id)
        .all()
    )
    chats = []
    for membership in memberships:
        team = membership.team
        if team is None:
            continue
        last_message = (
            TeamMessage.query.options(joinedload(TeamMessage.sender))
            .filter(TeamMessage.team_id == team.id)
            .order_by(TeamMessage.id.desc())
            .first()
        )
        unread_query = db.session.query(func.count(TeamMessage.id)).filter(
            TeamMessage.team_id == team.id
        )
        if membership.last_read_at is not None:
            unread_query = unread_query.filter(
                TeamMessage.created_at > membership.last_read_at
            )
        chats.append({
            "id": team.id,
            "team_id": team.id,
            "name": team.name,
            "status": team.status,
            "member_count": TeamMember.query.filter_by(team_id=team.id).count(),
            "project": {
                "id": team.project.id,
                "title": team.project.title,
                "name": team.project.title,
            },
            "course": {
                "id": team.project.course.id,
                "name": team.project.course.name,
            },
            "last_message": serialize_message(last_message) if last_message else None,
            "unread_count": int(unread_query.scalar() or 0),
        })
    chats.sort(
        key=lambda item: (
            item["last_message"]["created_at"] if item["last_message"] else "",
            item["team_id"],
        ),
        reverse=True,
    )
    return chats


def list_team_messages(user_id, team_id, before=None, limit=200):
    team, membership = _load_membership(user_id, team_id)
    try:
        limit = int(limit)
    except (TypeError, ValueError) as exc:
        raise ValueError("limit must be an integer") from exc
    limit = max(1, min(limit, 200))
    query = TeamMessage.query.options(joinedload(TeamMessage.sender)).filter(
        TeamMessage.team_id == team.id
    )
    if before is not None:
        try:
            before = int(before)
        except (TypeError, ValueError) as exc:
            raise ValueError("before must be an integer") from exc
        query = query.filter(TeamMessage.id < before)
    messages = query.order_by(TeamMessage.id.desc()).limit(limit).all()
    messages.reverse()
    membership.last_read_at = _now()
    db.session.commit()
    return {
        "team_id": team.id,
        "messages": [serialize_message(message) for message in messages],
        "limit": limit,
    }


def create_team_message(user_id, team_id, data):
    team, _membership = _load_membership(user_id, team_id)
    content = data.get("content", data.get("body", ""))
    if not isinstance(content, str):
        raise ValueError("content must be a string")
    content = content.strip()
    if not content:
        raise ValueError("Message cannot be empty")
    if len(content) > MESSAGE_MAX_LENGTH:
        raise ValueError(f"Message must be {MESSAGE_MAX_LENGTH} characters or fewer")

    message = TeamMessage(team_id=team.id, sender_id=user_id, content=content)
    db.session.add(message)
    db.session.commit()
    serialized = serialize_message(message)
    emit_team_message_event(serialized)
    return serialized
