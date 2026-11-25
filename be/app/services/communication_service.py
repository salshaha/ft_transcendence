from datetime import datetime, timezone

from sqlalchemy import func, or_
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models.communication import FriendRequest, Friendship, TeamMessage
from app.models.student_dashboard import Course, Project, Team, TeamMember
from app.models.user import User
from app.realtime import emit_friend_event, emit_team_message_event
from app.services import presence_service

MESSAGE_MAX_LENGTH = 4000
FRIEND_SEARCH_LIMIT = 20


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


def _serialize_friend_users(users):
    status = presence_service.get_status([user.id for user in users])
    return [
        {
            **_serialize_sender(user),
            "major": user.major,
            "domain": user.domain,
            "is_online": status.get(str(user.id), {}).get("online", False),
            "last_seen": status.get(str(user.id), {}).get("last_seen"),
        }
        for user in users
    ]


def _friend_ids(user_id):
    return [
        friend_id
        for (friend_id,) in Friendship.query.with_entities(Friendship.friend_id)
        .filter(Friendship.user_id == user_id)
        .all()
    ]


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


def _serialize_friend_request(request, user, direction):
    return {
        "id": request.id,
        "status": request.status,
        "direction": direction,
        "created_at": _iso(request.created_at),
        "responded_at": _iso(request.responded_at),
        "user": _serialize_friend_users([user])[0] if user else None,
    }


def list_friend_requests(user_id):
    incoming = (
        FriendRequest.query.options(joinedload(FriendRequest.requester))
        .filter_by(recipient_id=user_id, status="pending")
        .order_by(FriendRequest.created_at.desc(), FriendRequest.id.desc())
        .all()
    )
    outgoing = (
        FriendRequest.query.options(joinedload(FriendRequest.recipient))
        .filter_by(requester_id=user_id, status="pending")
        .order_by(FriendRequest.created_at.desc(), FriendRequest.id.desc())
        .all()
    )
    return {
        "incoming": [
            _serialize_friend_request(item, item.requester, "incoming")
            for item in incoming
        ],
        "outgoing": [
            _serialize_friend_request(item, item.recipient, "outgoing")
            for item in outgoing
        ],
    }


def list_friends(user_id):
    friend_ids = _friend_ids(user_id)
    if not friend_ids:
        return []
    users = (
        User.query.filter(User.id.in_(friend_ids), User.role == "student")
        .order_by(User.first_name.asc(), User.last_name.asc(), User.id.asc())
        .all()
    )
    return _serialize_friend_users(users)


def get_friend_overview(user_id):
    return {
        "friends": list_friends(user_id),
        **list_friend_requests(user_id),
    }


def search_students(user_id, search=""):
    query = User.query.filter(User.role == "student", User.id != user_id)
    term = (search or "").strip()
    if term:
        pattern = f"%{term}%"
        query = query.filter(
            or_(
                User.first_name.ilike(pattern),
                User.last_name.ilike(pattern),
                User.student_id.ilike(pattern),
                User.email.ilike(pattern),
            )
        )
    users = query.order_by(
        User.first_name.asc(), User.last_name.asc(), User.id.asc()
    ).limit(FRIEND_SEARCH_LIMIT).all()
    friend_ids = set(_friend_ids(user_id))
    outgoing = {
        item.recipient_id: item
        for item in FriendRequest.query.filter_by(
            requester_id=user_id, status="pending"
        ).all()
    }
    incoming = {
        item.requester_id: item
        for item in FriendRequest.query.filter_by(
            recipient_id=user_id, status="pending"
        ).all()
    }
    results = []
    for user in _serialize_friend_users(users):
        user_id_value = user["id"]
        if user_id_value in friend_ids:
            user["relationship"] = "friend"
            user["request_id"] = None
        elif user_id_value in incoming:
            user["relationship"] = "incoming_request"
            user["request_id"] = incoming[user_id_value].id
        elif user_id_value in outgoing:
            user["relationship"] = "outgoing_request"
            user["request_id"] = outgoing[user_id_value].id
        else:
            user["relationship"] = "none"
            user["request_id"] = None
        results.append(user)
    return {"students": results, "limit": FRIEND_SEARCH_LIMIT}


def _friendship_exists(user_id, friend_id):
    return Friendship.query.filter_by(
        user_id=user_id, friend_id=friend_id
    ).first() is not None


def _create_friendship_pair(first_id, second_id):
    for user_id, friend_id in ((first_id, second_id), (second_id, first_id)):
        if not _friendship_exists(user_id, friend_id):
            db.session.add(Friendship(user_id=user_id, friend_id=friend_id))


def _serialize_friend(friend_id):
    user = db.session.get(User, friend_id)
    return _serialize_friend_users([user])[0] if user else None


def send_friend_request(user_id, recipient_id):
    try:
        recipient_id = int(recipient_id)
    except (TypeError, ValueError) as exc:
        raise ValueError("recipient_id must be an integer") from exc
    if recipient_id == int(user_id):
        raise ValueError("You cannot add yourself as a friend")
    recipient = db.session.get(User, recipient_id)
    if recipient is None or recipient.role != "student":
        raise LookupError("Student not found")
    if _friendship_exists(user_id, recipient_id):
        raise ValueError("You are already friends with this student")

    reverse = FriendRequest.query.filter_by(
        requester_id=recipient_id, recipient_id=user_id, status="pending"
    ).first()
    if reverse is not None:
        _create_friendship_pair(user_id, recipient_id)
        reverse.status = "accepted"
        reverse.responded_at = _now()
        db.session.commit()
        emit_friend_event(
            "request_accepted",
            {
                "request": _serialize_friend_request(
                    reverse, db.session.get(User, user_id), "outgoing"
                ),
                "friend": _serialize_friend(user_id),
            },
            recipient_id,
        )
        return {
            "status": "accepted",
            "friend": _serialize_friend(recipient_id),
            "request": _serialize_friend_request(reverse, recipient, "incoming"),
        }

    request = FriendRequest.query.filter_by(
        requester_id=user_id, recipient_id=recipient_id
    ).first()
    if request is None:
        request = FriendRequest(
            requester_id=user_id, recipient_id=recipient_id, status="pending"
        )
        db.session.add(request)
    else:
        request.status = "pending"
        request.responded_at = None
    db.session.commit()
    emit_friend_event(
        "request_received",
        {
            "request": _serialize_friend_request(
                request, db.session.get(User, user_id), "incoming"
            ),
        },
        recipient_id,
    )
    return {
        "status": "pending",
        "friend": _serialize_friend(recipient_id),
        "request": _serialize_friend_request(request, recipient, "outgoing"),
    }


def respond_friend_request(user_id, request_id, accept):
    request = db.session.get(FriendRequest, request_id)
    if request is None:
        raise LookupError("Friend request not found")
    if request.recipient_id != int(user_id):
        raise PermissionError("You cannot respond to this friend request")
    if request.status != "pending":
        raise ValueError("This friend request has already been answered")

    if accept:
        _create_friendship_pair(request.recipient_id, request.requester_id)
        request.status = "accepted"
    else:
        request.status = "rejected"
    request.responded_at = _now()
    db.session.commit()
    emit_friend_event(
        "request_accepted" if accept else "request_rejected",
        {
            "request": _serialize_friend_request(
                request, db.session.get(User, user_id), "outgoing"
            ),
            "friend": _serialize_friend(request.recipient_id) if accept else None,
        },
        request.requester_id,
    )
    return {
        "status": request.status,
        "friend": _serialize_friend(request.requester_id) if accept else None,
        "request": _serialize_friend_request(
            request, db.session.get(User, request.requester_id), "incoming"
        ),
    }


def remove_friend(user_id, friend_id):
    try:
        friend_id = int(friend_id)
    except (TypeError, ValueError) as exc:
        raise ValueError("friend_id must be an integer") from exc
    friend = db.session.get(User, friend_id)
    if friend is None or friend.role != "student":
        raise LookupError("Student not found")
    rows = Friendship.query.filter(
        or_(
            (Friendship.user_id == user_id) & (Friendship.friend_id == friend_id),
            (Friendship.user_id == friend_id) & (Friendship.friend_id == user_id),
        )
    ).all()
    if not rows:
        raise LookupError("Friendship not found")
    for row in rows:
        db.session.delete(row)
    requests = FriendRequest.query.filter(
        or_(
            (FriendRequest.requester_id == user_id)
            & (FriendRequest.recipient_id == friend_id),
            (FriendRequest.requester_id == friend_id)
            & (FriendRequest.recipient_id == user_id),
        )
    ).all()
    for request in requests:
        db.session.delete(request)
    db.session.commit()
    emit_friend_event(
        "removed",
        {"friend_id": int(user_id)},
        friend_id,
    )
    return {"friend_id": friend_id}
