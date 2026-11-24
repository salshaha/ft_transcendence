import json
from datetime import datetime, timezone
from queue import Empty

from flask import Blueprint, Response, jsonify, request, stream_with_context

from app.services import presence_service
from app.services.student_directory_service import visible_user_ids
from app.services.student_service import get_authenticated_student

presence_bp = Blueprint("presence", __name__)


def _auth_error(error):
    message, status = error
    return jsonify({"message": message}), status


def _serialize_event(event, payload):
    return (
        f"event: {event}\n"
        f"data: {json.dumps(payload, separators=(',', ':'))}\n\n"
    )


def _filter_presence_payload(payload, visible_ids):
    users = payload.get("users") if isinstance(payload, dict) else None
    if not isinstance(users, dict):
        return payload
    filtered = {}
    for key, value in users.items():
        try:
            user_id = int(key)
        except (TypeError, ValueError):
            continue
        if user_id in visible_ids:
            filtered[key] = value
    if not filtered:
        return None
    return {**payload, "users": filtered}


@presence_bp.route("/stream", methods=["GET"])
def stream():
    student, error = get_authenticated_student()
    if error:
        return _auth_error(error)

    visible_ids = visible_user_ids(student.id)
    subscriber = presence_service.subscribe()
    connection_id = None

    def generate():
        nonlocal connection_id
        try:
            connection_id = presence_service.register_connection(student.id)
            yield _serialize_event("presence", {
                "connection_id": connection_id,
                "users": presence_service.get_status(sorted(visible_ids)),
            })
            while True:
                try:
                    event, payload = subscriber.get(
                        timeout=presence_service.HEARTBEAT_SECONDS
                    )
                    payload = _filter_presence_payload(payload, visible_ids)
                    if payload is None:
                        continue
                    yield _serialize_event(event, payload)
                except Empty:
                    yield ": heartbeat\n\n"
        finally:
            presence_service.unsubscribe(subscriber)
            if connection_id:
                presence_service.unregister_connection(connection_id)

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    )


@presence_bp.route("/ping", methods=["POST"])
def ping():
    student, error = get_authenticated_student()
    if error:
        return _auth_error(error)

    data = request.get_json(silent=True) or {}
    connection_id = data.get("connection_id") or request.headers.get(
        "X-Presence-Connection"
    )
    if not connection_id:
        return jsonify({"message": "connection_id is required"}), 400
    if not presence_service.touch_connection(connection_id, student.id):
        return jsonify({"message": "Presence connection was not found"}), 404

    return jsonify({
        "ok": True,
        "status": presence_service.get_status([student.id]),
    }), 200


@presence_bp.route("/students", methods=["GET"])
def students_presence():
    student, error = get_authenticated_student()
    if error:
        return _auth_error(error)

    raw_ids = request.args.get("ids")
    if raw_ids:
        ids = []
        for value in raw_ids.split(","):
            try:
                ids.append(int(value.strip()))
            except (TypeError, ValueError):
                continue
    else:
        from app.models.user import User

        ids = [
            user.id
            for user in User.query.filter(User.role == "student").with_entities(User.id)
        ]

    return jsonify({
        "presence": presence_service.get_status(ids),
        "server_time": datetime.now(timezone.utc).isoformat(),
    }), 200
