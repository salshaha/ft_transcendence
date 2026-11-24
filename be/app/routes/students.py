from flask import Blueprint, jsonify, request
from sqlalchemy.exc import SQLAlchemyError

from app.extensions import db
from app.services.student_directory_service import get_public_profile, list_students
from app.services.student_service import get_authenticated_student

students_bp = Blueprint("students", __name__)


def _error(message, status):
    return jsonify({"message": message}), status


@students_bp.route("", methods=["GET"])
@students_bp.route("/", methods=["GET"])
def index():
    student, error = get_authenticated_student()
    if error:
        message, status = error
        return _error(message, status)

    try:
        data = list_students(
            student,
            search=request.args.get("search"),
            skill_id=request.args.get("skill_id"),
            skill=request.args.get("skill"),
            course_id=request.args.get("course_id"),
            page=request.args.get("page", 1),
            per_page=request.args.get("per_page", 12),
        )
    except ValueError as exc:
        return _error(str(exc), 400)
    except SQLAlchemyError:
        db.session.rollback()
        return _error("Unable to retrieve students", 500)
    return jsonify(data), 200


@students_bp.route("/<int:student_id>", methods=["GET"])
def public_profile(student_id):
    student, error = get_authenticated_student()
    if error:
        message, status = error
        return _error(message, status)

    try:
        profile = get_public_profile(student, student_id)
    except LookupError as exc:
        return _error(str(exc), 404)
    except PermissionError as exc:
        return _error(str(exc), 403)
    except SQLAlchemyError:
        db.session.rollback()
        return _error("Unable to retrieve the student profile", 500)
    return jsonify({"student": profile}), 200
