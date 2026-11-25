import threading
import time
import uuid
from datetime import datetime, timezone
from queue import Empty, Full, Queue

CONNECTION_TTL_SECONDS = 90
HEARTBEAT_SECONDS = 15

_LOCK = threading.RLock()
_CONNECTIONS = {}
_LAST_SEEN = {}
_SUBSCRIBERS = set()


def _now():
    return datetime.now(timezone.utc).isoformat()


def _status_locked(user_ids):
    result = {}
    for raw_id in user_ids:
        try:
            user_id = int(raw_id)
        except (TypeError, ValueError):
            continue
        online = any(
            connection["user_id"] == user_id
            for connection in _CONNECTIONS.values()
        )
        result[str(user_id)] = {
            "online": online,
            "last_seen": _LAST_SEEN.get(user_id),
        }
    return result


def _sweep_expired_locked():
    now = time.monotonic()
    expired = [
        connection_id
        for connection_id, connection in _CONNECTIONS.items()
        if now >= connection["expires_at"]
    ]
    affected = set()
    for connection_id in expired:
        connection = _CONNECTIONS.pop(connection_id, None)
        if connection is not None:
            affected.add(connection["user_id"])
    return affected


def _publish_locked(event, payload):
    message = (event, payload)
    for subscriber in list(_SUBSCRIBERS):
        try:
            subscriber.put_nowait(message)
        except Full:
            try:
                subscriber.get_nowait()
            except Empty:
                pass
            try:
                subscriber.put_nowait(message)
            except Full:
                pass


def _notify(affected):
    if not affected:
        return
    with _LOCK:
        payload = {"users": _status_locked(affected)}
        _publish_locked("presence", payload)


def register_connection(user_id):
    with _LOCK:
        user_id = int(user_id)
        was_online = any(
            connection["user_id"] == user_id
            for connection in _CONNECTIONS.values()
        )
        timestamp = _now()
        connection_id = uuid.uuid4().hex
        _CONNECTIONS[connection_id] = {
            "user_id": user_id,
            "connected_at": timestamp,
            "last_seen": timestamp,
            "expires_at": time.monotonic() + CONNECTION_TTL_SECONDS,
        }
        _LAST_SEEN[user_id] = timestamp
        changed = set() if was_online else {user_id}
        payload = {"users": _status_locked(changed)} if changed else None
        if payload:
            _publish_locked("presence", payload)
    return connection_id


def unregister_connection(connection_id):
    with _LOCK:
        connection = _CONNECTIONS.pop(connection_id, None)
        if connection is None:
            return
        user_id = connection["user_id"]
        _LAST_SEEN[user_id] = _now()
        still_online = any(
            item["user_id"] == user_id for item in _CONNECTIONS.values()
        )
        if still_online:
            return
        payload = {"users": _status_locked([user_id])}
        _publish_locked("presence", payload)


def touch_connection(connection_id, user_id=None):
    with _LOCK:
        _sweep_expired_locked()
        connection = _CONNECTIONS.get(connection_id)
        if connection is None:
            return False
        if user_id is not None and connection["user_id"] != int(user_id):
            return False
        timestamp = _now()
        connection["last_seen"] = timestamp
        connection["expires_at"] = time.monotonic() + CONNECTION_TTL_SECONDS
        _LAST_SEEN[connection["user_id"]] = timestamp
        return True


def subscribe():
    subscriber = Queue(maxsize=32)
    with _LOCK:
        _SUBSCRIBERS.add(subscriber)
        return subscriber


def unsubscribe(subscriber):
    with _LOCK:
        _SUBSCRIBERS.discard(subscriber)


def get_status(user_ids):
    with _LOCK:
        affected = _sweep_expired_locked()
        status = _status_locked(user_ids)
        payload = {"users": _status_locked(affected)} if affected else None
        if payload:
            _publish_locked("presence", payload)
    return status


def get_snapshot():
    with _LOCK:
        affected = _sweep_expired_locked()
        known_ids = set(_LAST_SEEN) | {
            connection["user_id"] for connection in _CONNECTIONS.values()
        }
        status = _status_locked(known_ids)
        payload = {"users": _status_locked(affected)} if affected else None
        if payload:
            _publish_locked("presence", payload)
    return status
