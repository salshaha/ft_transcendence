from flask import Blueprint, current_app, jsonify, request, send_file
from io import BytesIO
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.extensions import db
from app.models.student_dashboard import Project, Course
from app.services.student_service import (
    create_team,
    get_authenticated_student,
    get_available_teams,
    get_course_project,
    get_course_teams,
    get_courses,
    get_dashboard,
    get_deadlines,
    get_my_grades,
    get_my_teams,
    get_submission,
    get_team_details,
    join_team,
    leave_team,
    save_peer_feedback,
    serialize_profile,
    submit_project,
)
from app.services.storage import StorageError, StorageValidationError

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


@student_bp.route("/courses/<int:course_id>/project", methods=["GET"])
def course_project(course_id):
    student, response, status = _student_or_response()
    if response:
        return response, status
    try:
        data = get_course_project(student.id, course_id)
        if data is None:
            return jsonify({"message": "Course or project not found"}), 404
        return jsonify(data), 200
    except SQLAlchemyError:
        return _database_error("Unable to retrieve project")


@student_bp.route("/courses/<int:course_id>/teams", methods=["GET"])
def course_teams(course_id):
    student, response, status = _student_or_response()
    if response:
        return response, status
    try:
        data = get_course_teams(student.id, course_id, request.args.get("project_id"))
        if data is None:
            return jsonify({"message": "Course or project not found"}), 404
        return jsonify(data), 200
    except SQLAlchemyError:
        return _database_error("Unable to retrieve course teams")


@student_bp.route("/deadlines", methods=["GET"])
def deadlines():
    student, response, status = _student_or_response()
    if response:
        return response, status
    try:
        return jsonify({"deadlines": get_deadlines(student.id)}), 200
    except SQLAlchemyError:
        return _database_error("Unable to retrieve deadlines")


@student_bp.route("/teams", methods=["GET"])
def my_teams():
    student, response, status = _student_or_response()
    if response:
        return response, status
    try:
        return jsonify({"teams": get_my_teams(student.id)}), 200
    except SQLAlchemyError:
        return _database_error("Unable to retrieve your teams")


@student_bp.route("/teams/available", methods=["GET"])
def available_teams():
    student, response, status = _student_or_response()
    if response:
        return response, status
    try:
        return jsonify({"teams": get_available_teams(student.id)}), 200
    except SQLAlchemyError:
        return _database_error("Unable to retrieve available teams")


@student_bp.route("/teams", methods=["POST"])
def create_team_route():
    student, response, status = _student_or_response()
    if response:
        return response, status

    data = request.get_json(silent=True) or {}
    try:
        team = create_team(student.id, data)
        return jsonify({"team": team}), 201
    except LookupError as exc:
        return jsonify({"message": str(exc)}), 404
    except PermissionError as exc:
        return jsonify({"message": str(exc)}), 403
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    except SQLAlchemyError:
        return _database_error("Unable to create team")


@student_bp.route("/teams/<int:team_id>", methods=["GET"])
def team_details(team_id):
    student, response, status = _student_or_response()
    if response:
        return response, status
    try:
        data = get_team_details(student.id, team_id)
        return jsonify(data), 200
    except LookupError as exc:
        return jsonify({"message": str(exc)}), 404
    except PermissionError as exc:
        return jsonify({"message": str(exc)}), 403
    except SQLAlchemyError:
        return _database_error("Unable to retrieve team")


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


@student_bp.route("/teams/<int:team_id>/leave", methods=["POST"])
def leave_team_route(team_id):
    student, response, status = _student_or_response()
    if response:
        return response, status
    try:
        result = leave_team(student.id, team_id)
        return jsonify(result), 200
    except LookupError as exc:
        return jsonify({"message": str(exc)}), 404
    except SQLAlchemyError:
        return _database_error("Unable to leave team")


@student_bp.route("/teams/<int:team_id>/submission", methods=["POST"])
def submit_project_route(team_id):
    student, response, status = _student_or_response()
    if response:
        return response, status

    file_storage = request.files.get("file") or request.files.get("submission")
    if file_storage is None:
        return jsonify({"message": "submission file is required"}), 400

    try:
        submission = submit_project(student.id, team_id, file_storage)
        return jsonify({"submission": submission}), 201
    except PermissionError as exc:
        return jsonify({"message": str(exc)}), 403
    except LookupError as exc:
        return jsonify({"message": str(exc)}), 404
    except StorageValidationError as exc:
        return jsonify({"message": str(exc)}), 400
    except StorageError:
        return jsonify({"message": "Unable to store submission"}), 500
    except SQLAlchemyError:
        return _database_error("Unable to submit project")


@student_bp.route("/teams/<int:team_id>/submission", methods=["GET"])
def get_submission_route(team_id):
    student, response, status = _student_or_response()
    if response:
        return response, status
    try:
        submission = get_submission(student.id, team_id)
        if submission is None:
            return jsonify({"submission": None}), 200
        return jsonify({"submission": submission}), 200
    except PermissionError as exc:
        return jsonify({"message": str(exc)}), 403
    except SQLAlchemyError:
        return _database_error("Unable to retrieve submission")


@student_bp.route("/peer-feedback", methods=["POST"])
def peer_feedback_route():
    student, response, status = _student_or_response()
    if response:
        return response, status
    data = request.get_json(silent=True) or {}
    try:
        feedback = save_peer_feedback(student.id, data)
        return jsonify({"peer_feedback": feedback}), 201
    except LookupError as exc:
        return jsonify({"message": str(exc)}), 404
    except PermissionError as exc:
        return jsonify({"message": str(exc)}), 403
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    except SQLAlchemyError:
        return _database_error("Unable to save peer feedback")


@student_bp.route("/grades", methods=["GET"])
def grades_route():
    student, response, status = _student_or_response()
    if response:
        return response, status
    try:
        grades = get_my_grades(student.id)
        return jsonify({"grades": grades}), 200
    except SQLAlchemyError:
        return _database_error("Unable to retrieve grades")


@student_bp.route("/projects/<int:project_id>/requirements", methods=["GET"])
def download_requirements(project_id):
    student, response, status = _student_or_response()
    if response:
        return response, status

    project = Project.query.get(project_id)
    if project is None or not project.requirements_file_key:
        return jsonify({"message": "Requirements not found"}), 404

    # ensure student enrolled in course
    enrolled = CourseEnrollment.query.filter_by(
        student_id=student.id, course_id=project.course_id
    ).first()
    if enrolled is None:
        return jsonify({"message": "You are not enrolled in this course"}), 403

    storage = current_app.extensions["storage"]
    try:
        stream = storage.open(project.requirements_file_key)
        data = stream.read()
        stream.close()
    except (StorageError, OSError):
        return jsonify({"message": "Unable to read requirements"}), 500

    return send_file(
        BytesIO(data),
        mimetype=project.requirements_content_type or "application/pdf",
        as_attachment=False,
        download_name=project.requirements_original_name or "requirements.pdf",
    )


@student_bp.route("/dashboard", methods=["GET"])
def dashboard():
    student, response, status = _student_or_response()
    if response:
        return response, status
    try:
        return jsonify(get_dashboard(student)), 200
    except SQLAlchemyError:
        return _database_error("Unable to retrieve student dashboard")
