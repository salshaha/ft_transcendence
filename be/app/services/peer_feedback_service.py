from datetime import datetime, timezone

from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models.peer_feedback import PeerFeedback
from app.models.student_dashboard import Course, Project, Team, TeamMember
from app.models.user import User

PEER_FEEDBACK_MAX_LENGTH = 2000
PEER_FEEDBACK_MIN_RATING = 1
PEER_FEEDBACK_MAX_RATING = 5
PEER_FEEDBACK_ALLOW_UPDATES = True
PEER_FEEDBACK_CRITERION_COMMENT_MAX_LENGTH = 500
PEER_FEEDBACK_CRITERIA = (
    {
        "key": "contribution",
        "label": "Contribution to project work",
        "description": "Quality and amount of work contributed to the project.",
    },
    {
        "key": "communication",
        "label": "Communication and collaboration",
        "description": "Responsiveness, clarity, and teamwork.",
    },
    {
        "key": "responsibility",
        "label": "Responsibility and commitment",
        "description": "Ownership of tasks and reliability in meeting commitments.",
    },
    {
        "key": "problem_solving",
        "label": "Problem-solving and participation",
        "description": "Active participation and constructive problem solving.",
    },
)
PEER_FEEDBACK_CRITERIA_BY_KEY = {
    item["key"]: item for item in PEER_FEEDBACK_CRITERIA
}


def peer_feedback_rules():
    return {
        "allow_updates": PEER_FEEDBACK_ALLOW_UPDATES,
        "min_rating": PEER_FEEDBACK_MIN_RATING,
        "max_rating": PEER_FEEDBACK_MAX_RATING,
        "max_feedback_length": PEER_FEEDBACK_MAX_LENGTH,
        "max_criterion_comment_length": PEER_FEEDBACK_CRITERION_COMMENT_MAX_LENGTH,
        "rating_required": True,
        "feedback_required": True,
        "opens_after_project_deadline": True,
        "self_feedback_allowed": False,
        "criteria": [
            {
                **definition,
                "min_rating": PEER_FEEDBACK_MIN_RATING,
                "max_rating": PEER_FEEDBACK_MAX_RATING,
                "required": True,
            }
            for definition in PEER_FEEDBACK_CRITERIA
        ],
    }


def _as_int(value, field):
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field} must be an integer") from exc


def _as_utc(value):
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def project_has_ended(project):
    deadline = _as_utc(project.deadline) if project is not None else None
    return deadline is not None and datetime.now(timezone.utc) >= deadline


def _as_iso(value):
    return value.isoformat() if value else None


def _validate_rating(value, field):
    rating = _as_int(value, field)
    if rating < PEER_FEEDBACK_MIN_RATING or rating > PEER_FEEDBACK_MAX_RATING:
        raise ValueError(
            f"{field} must be between {PEER_FEEDBACK_MIN_RATING} and {PEER_FEEDBACK_MAX_RATING}"
        )
    return rating


def _normalize_criteria(payload):
    raw_criteria = payload.get("criteria")
    if raw_criteria is None:
        rating = payload.get("rating")
        if rating is None or rating == "":
            raise ValueError("rating is required")
        return [], _validate_rating(rating, "rating")

    if not isinstance(raw_criteria, list):
        raise ValueError("criteria must be a list")
    submitted = {}
    for entry in raw_criteria:
        if not isinstance(entry, dict):
            raise ValueError("each criterion must be an object")
        key = entry.get("key")
        if key not in PEER_FEEDBACK_CRITERIA_BY_KEY:
            raise ValueError(f"unknown peer feedback criterion: {key}")
        if key in submitted:
            raise ValueError(f"duplicate peer feedback criterion: {key}")
        submitted[key] = entry

    missing = [
        definition["key"]
        for definition in PEER_FEEDBACK_CRITERIA
        if definition["key"] not in submitted
    ]
    if missing:
        raise ValueError(
            "criteria must include: " + ", ".join(missing)
        )

    normalized = []
    ratings = []
    for definition in PEER_FEEDBACK_CRITERIA:
        key = definition["key"]
        entry = submitted[key]
        rating = _validate_rating(entry.get("rating"), f"{key} rating")
        comment = entry.get("comment") or ""
        if not isinstance(comment, str):
            raise ValueError(f"{key} comment must be text")
        comment = comment.strip()
        if len(comment) > PEER_FEEDBACK_CRITERION_COMMENT_MAX_LENGTH:
            raise ValueError(
                f"{key} comment must be at most "
                f"{PEER_FEEDBACK_CRITERION_COMMENT_MAX_LENGTH} characters"
            )
        normalized.append(
            {"key": key, "label": definition["label"], "rating": rating, "comment": comment}
        )
        ratings.append(rating)
    overall_rating = round(sum(ratings) / len(ratings))
    return normalized, overall_rating


def _serialize_criteria(value):
    if not isinstance(value, list):
        return []
    result = []
    for entry in value:
        if not isinstance(entry, dict):
            continue
        key = entry.get("key")
        definition = PEER_FEEDBACK_CRITERIA_BY_KEY.get(key)
        if definition is None:
            continue
        result.append(
            {
                "key": key,
                "label": definition["label"],
                "rating": entry.get("rating"),
                "comment": entry.get("comment") or "",
            }
        )
    return result


def _team_ids_for_project(student_id, project_id):
    rows = (
        db.session.query(TeamMember.team_id)
        .join(Team, Team.id == TeamMember.team_id)
        .filter(
            TeamMember.student_id == student_id,
            Team.project_id == project_id,
        )
        .all()
    )
    return {int(row[0]) for row in rows}


def _serialize(item, include_author):
    data = {
        "id": item.id,
        "project_id": item.project_id,
        "project_title": item.project.title if item.project else None,
        "from_student_id": item.from_student_id,
        "to_student_id": item.to_student_id,
        "recipient": (
            {
                "id": item.recipient.id,
                "name": f"{item.recipient.first_name} {item.recipient.last_name}",
            }
            if item.recipient else None
        ),
        "rating": item.rating,
        "feedback": item.feedback,
        "criteria": _serialize_criteria(item.criteria),
        "created_at": _as_iso(item.created_at),
        "updated_at": _as_iso(item.updated_at),
        "submitted": True,
    }
    if include_author:
        data["author"] = (
            {
                "id": item.author.id,
                "name": f"{item.author.first_name} {item.author.last_name}",
            }
            if item.author else None
        )
    return data


def save_peer_feedback(student_id, data):
    project_id = _as_int(data.get("project_id"), "project_id")
    to_student_id = _as_int(data.get("to_student_id"), "to_student_id")

    project = db.session.get(Project, project_id)
    if project is None:
        raise LookupError("Project not found")
    if not project_has_ended(project):
        raise PermissionError("Peer feedback is available only after the project ends")

    reviewer_team_ids = _team_ids_for_project(student_id, project_id)
    if not reviewer_team_ids:
        raise PermissionError("You are not part of a team for this project")

    recipient = User.query.filter_by(id=to_student_id, role="student").first()
    if recipient is None:
        raise LookupError("Recipient not found")
    if to_student_id == int(student_id):
        raise ValueError("Cannot provide feedback to yourself")

    recipient_team_ids = _team_ids_for_project(to_student_id, project_id)
    if not recipient_team_ids:
        raise LookupError("Recipient is not part of a team for this project")
    if not reviewer_team_ids.intersection(recipient_team_ids):
        raise PermissionError("You can only provide feedback for your teammates")

    criteria, rating = _normalize_criteria(data)

    feedback_text = data.get("feedback")
    if not isinstance(feedback_text, str):
        raise ValueError("feedback is required")
    feedback_text = feedback_text.strip()
    if not feedback_text:
        raise ValueError("feedback is required")
    if len(feedback_text) > PEER_FEEDBACK_MAX_LENGTH:
        raise ValueError(
            f"feedback must be at most {PEER_FEEDBACK_MAX_LENGTH} characters"
        )

    item = PeerFeedback.query.filter_by(
        project_id=project_id,
        from_student_id=student_id,
        to_student_id=to_student_id,
    ).first()
    if item is not None and not PEER_FEEDBACK_ALLOW_UPDATES:
        raise PermissionError("Updating peer feedback is not allowed for this project")
    if item is None:
        item = PeerFeedback(
            project_id=project_id,
            from_student_id=student_id,
            to_student_id=to_student_id,
            rating=rating,
            feedback=feedback_text,
            criteria=criteria,
            updated_at=datetime.now(timezone.utc),
        )
        db.session.add(item)
    else:
        item.rating = rating
        item.feedback = feedback_text
        item.criteria = criteria
        item.updated_at = datetime.now(timezone.utc)

    db.session.commit()
    result = _serialize(item, include_author=False)
    result["already_submitted"] = True
    return result


def list_submitted_feedback(student_id, project_id=None):
    query = (
        PeerFeedback.query.options(
            joinedload(PeerFeedback.project),
            joinedload(PeerFeedback.recipient),
        )
        .filter(PeerFeedback.from_student_id == student_id)
    )
    if project_id is not None:
        query = query.filter(PeerFeedback.project_id == _as_int(project_id, "project_id"))
    items = query.order_by(PeerFeedback.updated_at.desc()).all()
    return [_serialize(item, include_author=False) for item in items]


def get_own_feedback(student_id, feedback_id):
    item = (
        PeerFeedback.query.options(
            joinedload(PeerFeedback.project),
            joinedload(PeerFeedback.recipient),
        )
        .filter_by(id=feedback_id, from_student_id=student_id)
        .first()
    )
    if item is None:
        raise LookupError("Peer feedback not found")
    return _serialize(item, include_author=False)


def get_instructor_project(instructor_id, project_id):
    project = (
        Project.query.join(Course, Course.id == Project.course_id)
        .filter(Project.id == project_id, Course.instructor_id == instructor_id)
        .first()
    )
    if project is None:
        raise LookupError("Project not found")
    return project


def _instructor_feedback_query(instructor_id):
    return (
        PeerFeedback.query.join(Project, Project.id == PeerFeedback.project_id)
        .join(Course, Course.id == Project.course_id)
        .options(
            joinedload(PeerFeedback.project),
            joinedload(PeerFeedback.author),
            joinedload(PeerFeedback.recipient),
        )
        .filter(Course.instructor_id == instructor_id)
    )


def list_project_feedback(instructor_id, project_id=None, student_id=None):
    query = _instructor_feedback_query(instructor_id)
    if project_id is not None:
        query = query.filter(
            PeerFeedback.project_id == _as_int(project_id, "project_id")
        )
    if student_id is not None:
        query = query.filter(
            PeerFeedback.to_student_id == _as_int(student_id, "student_id")
        )
    items = query.order_by(PeerFeedback.created_at.desc()).all()
    return [_serialize(item, include_author=True) for item in items]


def get_project_feedback(instructor_id, feedback_id):
    item = _instructor_feedback_query(instructor_id).filter(
        PeerFeedback.id == feedback_id
    ).first()
    if item is None:
        raise LookupError("Peer feedback not found")
    return _serialize(item, include_author=True)


def list_all_feedback(project_id=None, student_id=None):
    query = PeerFeedback.query.options(
        joinedload(PeerFeedback.project),
        joinedload(PeerFeedback.author),
        joinedload(PeerFeedback.recipient),
    )
    if project_id is not None:
        query = query.filter(
            PeerFeedback.project_id == _as_int(project_id, "project_id")
        )
    if student_id is not None:
        query = query.filter(
            PeerFeedback.to_student_id == _as_int(student_id, "student_id")
        )
    items = query.order_by(PeerFeedback.created_at.desc()).all()
    return [_serialize(item, include_author=True) for item in items]


def get_any_feedback(feedback_id):
    item = (
        PeerFeedback.query.options(
            joinedload(PeerFeedback.project),
            joinedload(PeerFeedback.author),
            joinedload(PeerFeedback.recipient),
        )
        .filter_by(id=feedback_id)
        .first()
    )
    if item is None:
        raise LookupError("Peer feedback not found")
    return _serialize(item, include_author=True)
