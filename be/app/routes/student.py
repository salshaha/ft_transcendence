from flask import Blueprint, jsonify, request
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.extensions import db
from app.services.student_service import (
    get_authenticated_student,
    get_available_teams,
    get_courses,
    get_deadlines,
    get_dashboard,
    join_team,
    serialize_profile,
)


student_bp = Blueprint("student", __name__)


def _database_error(message):
    db.session.rollback()
    return jsonify({"message": message}), 500


def _student_or_response():
    student, error = get_authenticated_student()
    if error:
        message, status = error
        return None, jsonify({"message": message}), status
    return student, None, None


@student_bp.route("/profile", methods=["GET"])
def profile():
    student, response, status = _student_or_response()
    if response:
        return response, status
    try:
        return jsonify({"student": serialize_profile(student)}), 200
    except SQLAlchemyError:
        return _database_error("Unable to retrieve student profile")


@student_bp.route("/courses", methods=["GET"])
def courses():
    student, response, status = _student_or_response()
    if response:
        return response, status
    search = request.args.get("search", "").strip()
    try:
        return jsonify({"courses": get_courses(student.id, search or None)}), 200
    except SQLAlchemyError:
        return _database_error("Unable to retrieve courses")


@student_bp.route("/deadlines", methods=["GET"])
def deadlines():
    student, response, status = _student_or_response()
    if response:
        return response, status
    try:
        return jsonify({"deadlines": get_deadlines(student.id)}), 200
    except SQLAlchemyError:
        return _database_error("Unable to retrieve deadlines")


@student_bp.route("/teams/available", methods=["GET"])
def available_teams():
    student, response, status = _student_or_response()
    if response:
        return response, status
    try:
        return jsonify({"teams": get_available_teams(student.id)}), 200
    except SQLAlchemyError:
        return _database_error("Unable to retrieve available teams")


@student_bp.route("/teams/<int:team_id>/join", methods=["POST"])
def join_team_route(team_id):
    student, response, status = _student_or_response()
    if response:
        return response, status

    try:
        membership, error = join_team(student.id, team_id)
        if error:
            db.session.rollback()
            message, error_status = error
            return jsonify({"message": message}), error_status
        db.session.commit()
        return jsonify({
            "message": "Successfully joined team",
            "team_id": membership.team_id,
            "student_id": membership.student_id,
        }), 201
    except IntegrityError:
        db.session.rollback()
        return jsonify({
            "message": "Unable to join team because the membership is no longer valid"
        }), 409
    except SQLAlchemyError:
        return _database_error("Unable to join team")


@student_bp.route("/dashboard", methods=["GET"])
def dashboard():
    student, response, status = _student_or_response()
    if response:
        return response, status
    try:
        return jsonify(get_dashboard(student)), 200
    except SQLAlchemyError:
        return _database_error("Unable to retrieve student dashboard")
