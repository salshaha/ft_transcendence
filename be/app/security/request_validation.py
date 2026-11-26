from flask import jsonify, request
from werkzeug.exceptions import BadRequest


def init_request_validation(app):
    """Reject malformed JSON objects consistently across API write routes.

    Multipart uploads and form endpoints keep their existing field validation.
    JSON API writes must contain a syntactically valid object, so malformed
    payloads cannot silently become empty dictionaries in individual routes.
    """

    @app.before_request
    def validate_api_json_body():
        if not request.path.startswith("/api/"):
            return None
        if request.method in {"GET", "HEAD", "OPTIONS", "TRACE"}:
            return None
        if not request.is_json:
            return None
        if request.content_length and request.content_length > app.config.get(
            "MAX_JSON_CONTENT_LENGTH", 2 * 1024 * 1024
        ):
            return jsonify({"message": "JSON request body is too large"}), 413

        try:
            payload = request.get_json(silent=False)
        except BadRequest:
            return jsonify({"message": "Request body must contain valid JSON"}), 400

        if not isinstance(payload, dict):
            return jsonify({"message": "Request body must be a JSON object"}), 400
        return None
