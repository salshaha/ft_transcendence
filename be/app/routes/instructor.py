from flask import Blueprint, jsonify
from sqlalchemy.exc import SQLAlchemyError

from app.extensions import db
from app.services.instructor_service import (
    get_authenticated_instructor,
    get_dashboard,
)


instructor_bp = Blueprint("instructor", __name__)


@instructor_bp.route("/dashboard", methods=["GET"])
def dashboard():
    instructor, error = get_authenticated_instructor()
    if error:
        message, status = error
        return jsonify({"message": message}), status

    try:
        return jsonify(get_dashboard(instructor)), 200
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"message": "Unable to retrieve instructor dashboard"}), 500
