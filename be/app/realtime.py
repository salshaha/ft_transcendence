import json
from queue import Empty, Full, Queue
from threading import Event, Lock, Thread

from flask import request, session
from flask_sock import Sock
from sqlalchemy import event
from sqlalchemy.orm import Session
from simple_websocket import ConnectionClosed

from app.extensions import db
from app.models.activity_event import ActivityEvent
from app.models.user import User

_ANALYTICS_MODELS = {
    "User": "users",
    "Course": "courses",
    "Team": "teams",
    "Task": "tasks",
    "Submission": "submissions",
    "ActivityEvent": "activity_events",
}
_PENDING_CHANGE_KEY = "platform_analytics_changes"
_connections = set()
_connections_lock = Lock()


def _collect_analytics_changes(db_session):
    changed = set()
    candidates = list(db_session.new) + list(db_session.deleted)
    candidates.extend(
        obj for obj in db_session.dirty
        if db_session.is_modified(obj, include_collections=True)
    )
    for obj in candidates:
        entity = _ANALYTICS_MODELS.get(type(obj).__name__)
        if entity:
            changed.add(entity)
    db_session.info[_PENDING_CHANGE_KEY] = changed


def _publish_analytics_changes(db_session):
    entities = db_session.info.pop(_PENDING_CHANGE_KEY, set())
    if not entities:
        return

    message = json.dumps(
        {"type": "analytics.changed", "entities": sorted(entities)}
    )
    with _connections_lock:
        subscribers = tuple(_connections)

    for outgoing in subscribers:
        try:
            outgoing.put_nowait(message)
        except Full:
            # The dashboard reloads the latest aggregate data, so coalesce
            # multiple commits while a client is already refreshing.
            try:
                outgoing.get_nowait()
            except Empty:
                pass
            try:
                outgoing.put_nowait(message)
            except Full:
                pass


def _discard_analytics_changes(db_session):
    db_session.info.pop(_PENDING_CHANGE_KEY, None)


event.listen(Session, "before_commit", _collect_analytics_changes)
event.listen(Session, "after_commit", _publish_analytics_changes)
event.listen(Session, "after_rollback", _discard_analytics_changes)


def _send_queued_updates(websocket, outgoing, stop_sender):
    while not stop_sender.is_set():
        try:
            message = outgoing.get(timeout=0.25)
        except Empty:
            continue
        try:
            websocket.send(message)
        except ConnectionClosed:
            stop_sender.set()
            try:
                websocket.close()
            except ConnectionClosed:
                pass
            return


def init_realtime(app):
    app.config.setdefault(
        "SOCK_SERVER_OPTIONS",
        {"ping_interval": 25, "max_message_size": 1024},
    )
    sock = Sock(app)

    @sock.route("/ws/admin-analytics")
    def admin_analytics(websocket):
        origin = request.headers.get("Origin")
        if origin not in app.config["FRONTEND_ORIGINS"]:
            websocket.close(1008, "Origin is not allowed")
            return

        user_id = session.get("user_id")
        user = db.session.get(User, user_id) if user_id is not None else None
        if user is None or user.role != "admin":
            websocket.close(1008, "Administrator access is required")
            return

        outgoing = Queue(maxsize=1)
        stop_sender = Event()
        try:
            websocket.send(json.dumps({"type": "connected"}))
            with _connections_lock:
                _connections.add(outgoing)
            sender = Thread(
                target=_send_queued_updates,
                args=(websocket, outgoing, stop_sender),
                daemon=True,
            )
            sender.start()
            while websocket.receive() is not None:
                pass
        except ConnectionClosed:
            pass
        finally:
            stop_sender.set()
            with _connections_lock:
                _connections.discard(outgoing)
            db.session.remove()
