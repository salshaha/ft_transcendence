from flask import Blueprint, current_app, jsonify, request, send_file
from io import BytesIO
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.extensions import db
from app.models.student_dashboard import Course, CourseEnrollment, Project, TeamMember
from app.services.communication_service import (
    create_team_message,
    list_team_chats,
    list_team_messages,
)
from app.services.student_service import (
    create_team,
    delete_submission,
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
    get_team_preview,
    join_team,
    leave_team,
    read_submission_file,
    remove_team_member,
    serialize_profile,
    submit_project,
    switch_team,
    transfer_team_leadership,
)
from app.services.peer_feedback_service import (
    get_own_feedback,
    list_submitted_feedback,
    peer_feedback_rules,
    save_peer_feedback,
)
from app.services.storage import StorageError, StorageValidationError

student_bp = Blueprint("student", __name__)


def _database_error(message, error=None):
    db.session.rollback()
    if error is not None:
        current_app.logger.exception("%s: %s", message, error)
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
        courses = get_courses(
            student.id,
            search or None,
            semester=request.args.get("semester"),
            academic_year=request.args.get("academic_year"),
            instructor_id=request.args.get("instructor_id"),
            sort=request.args.get("sort", "name"),
            order=request.args.get("order", "asc"),
            page=request.args.get("page", 1),
            per_page=request.args.get("per_page", 12),
            paginate=True,
        )
        return jsonify(courses), 200
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
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
        data = get_course_teams(
            student.id,
            course_id,
            project_id=request.args.get("project_id"),
            search=request.args.get("search"),
            availability=request.args.get("availability"),
            sort=request.args.get("sort", "name"),
            order=request.args.get("order", "asc"),
            capacity=request.args.get("capacity", ""),
            page=request.args.get("page", 1),
            per_page=request.args.get("per_page", 12),
        )
        if data is None:
            return jsonify({"message": "Course or project not found"}), 404
        return jsonify(data), 200
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
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


@student_bp.route("/teams/<int:team_id>/preview", methods=["GET"])
def team_preview(team_id):
    student, response, status = _student_or_response()
    if response:
        return response, status
    try:
        return jsonify(get_team_preview(student.id, team_id)), 200
    except LookupError as exc:
        return jsonify({"message": str(exc)}), 404
    except PermissionError as exc:
        return jsonify({"message": str(exc)}), 403
    except SQLAlchemyError:
        return _database_error("Unable to retrieve team preview")


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
        member_count = TeamMember.query.filter_by(team_id=membership.team_id).count()
        max_members = membership.team.project.max_members_per_team
        return jsonify({
            "message": "Successfully joined team",
            "team_id": membership.team_id,
            "student_id": membership.student_id,
            "is_member": True,
            "current_member_count": member_count,
            "max_members": max_members,
            "available_spots": max(0, max_members - member_count),
        }), 201
    except IntegrityError:
        db.session.rollback()
        return jsonify({
            "message": "Unable to join team because the membership is no longer valid"
        }), 409
    except SQLAlchemyError:
        return _database_error("Unable to join team")


@student_bp.route("/teams/<int:team_id>/switch", methods=["POST"])
def switch_team_route(team_id):
    student, response, status = _student_or_response()
    if response:
        return response, status
    try:
        result = switch_team(student.id, team_id)
        return jsonify(result), 200
    except LookupError as exc:
        return jsonify({"message": str(exc)}), 404
    except PermissionError as exc:
        return jsonify({"message": str(exc)}), 403
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    except IntegrityError:
        db.session.rollback()
        return jsonify({
            "message": "Unable to switch team because the membership is no longer valid"
        }), 409
    except SQLAlchemyError:
        return _database_error("Unable to switch team")


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
    except PermissionError as exc:
        return jsonify({"message": str(exc)}), 403
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    except SQLAlchemyError:
        return _database_error("Unable to leave team")


@student_bp.route("/teams/<int:team_id>/members/<int:member_id>", methods=["DELETE"])
def remove_team_member_route(team_id, member_id):
    student, response, status = _student_or_response()
    if response:
        return response, status
    try:
        result = remove_team_member(student.id, team_id, member_id)
        return jsonify(result), 200
    except LookupError as exc:
        return jsonify({"message": str(exc)}), 404
    except PermissionError as exc:
        return jsonify({"message": str(exc)}), 403
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    except SQLAlchemyError:
        return _database_error("Unable to remove team member")


@student_bp.route("/teams/<int:team_id>/leadership", methods=["POST"])
def transfer_team_leadership_route(team_id):
    student, response, status = _student_or_response()
    if response:
        return response, status
    data = request.get_json(silent=True) or {}
    try:
        new_leader_id = data.get("new_leader_id") or data.get("student_id")
        if new_leader_id is None:
            return jsonify({"message": "new_leader_id is required"}), 400
        result = transfer_team_leadership(student.id, team_id, int(new_leader_id))
        return jsonify(result), 200
    except LookupError as exc:
        return jsonify({"message": str(exc)}), 404
    except PermissionError as exc:
        return jsonify({"message": str(exc)}), 403
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    except SQLAlchemyError:
        return _database_error("Unable to transfer team leadership")


@student_bp.route("/chats", methods=["GET"])
def team_chats():
    student, response, status = _student_or_response()
    if response:
        return response, status
    try:
        return jsonify({"chats": list_team_chats(student.id)}), 200
    except SQLAlchemyError as exc:
        return _database_error("Unable to retrieve team chats", exc)


@student_bp.route("/teams/<int:team_id>/messages", methods=["GET"])
def team_messages(team_id):
    student, response, status = _student_or_response()
    if response:
        return response, status
    try:
        data = list_team_messages(
            student.id,
            team_id,
            before=request.args.get("before"),
            limit=request.args.get("limit", 200),
        )
        return jsonify(data), 200
    except LookupError as exc:
        return jsonify({"message": str(exc)}), 404
    except PermissionError as exc:
        return jsonify({"message": str(exc)}), 403
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    except SQLAlchemyError as exc:
        return _database_error("Unable to retrieve team messages", exc)


@student_bp.route("/teams/<int:team_id>/messages", methods=["POST"])
def send_team_message(team_id):
    student, response, status = _student_or_response()
    if response:
        return response, status
    data = request.get_json(silent=True) or {}
    try:
        message = create_team_message(student.id, team_id, data)
        return jsonify({"message": message}), 201
    except LookupError as exc:
        return jsonify({"message": str(exc)}), 404
    except PermissionError as exc:
        return jsonify({"message": str(exc)}), 403
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    except SQLAlchemyError as exc:
        return _database_error("Unable to send team message", exc)


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
    except (ValueError, StorageValidationError) as exc:
        return jsonify({"message": str(exc)}), 400
    except (StorageError, OSError):
        return jsonify({"message": "Unable to store the submission"}), 500
    except SQLAlchemyError:
        return _database_error("Unable to submit project")


@student_bp.route("/teams/<int:team_id>/submission", methods=["DELETE"])
def delete_submission_route(team_id):
    student, response, status = _student_or_response()
    if response:
        return response, status
    try:
        result = delete_submission(student.id, team_id)
        return jsonify(result), 200
    except PermissionError as exc:
        return jsonify({"message": str(exc)}), 403
    except LookupError as exc:
        return jsonify({"message": str(exc)}), 404
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    except SQLAlchemyError:
        return _database_error("Unable to delete submission")


@student_bp.route("/teams/<int:team_id>/submission", methods=["GET"])
def get_submission_route(team_id):
    student, response, status = _student_or_response()
    if response:
        return response, status
    try:
        submission = get_submission(student.id, team_id)
        return jsonify({"submission": submission}), 200
    except PermissionError as exc:
        return jsonify({"message": str(exc)}), 403
    except LookupError as exc:
        return jsonify({"message": str(exc)}), 404
    except SQLAlchemyError:
        return _database_error("Unable to retrieve submission")


@student_bp.route("/teams/<int:team_id>/submission/file", methods=["GET"])
def download_submission_route(team_id):
    student, response, status = _student_or_response()
    if response:
        return response, status
    try:
        stream, content_type, download_name = read_submission_file(
            student.id, team_id
        )
        return send_file(
            stream,
            mimetype=content_type,
            as_attachment=request.args.get("download", "").lower() in {"1", "true", "yes"},
            download_name=download_name,
        )
    except PermissionError as exc:
        return jsonify({"message": str(exc)}), 403
    except LookupError as exc:
        return jsonify({"message": str(exc)}), 404
    except (StorageError, OSError):
        return jsonify({"message": "Unable to read submission"}), 500


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


@student_bp.route("/peer-feedback", methods=["GET"])
def list_peer_feedback_route():
    student, response, status = _student_or_response()
    if response:
        return response, status
    try:
        items = list_submitted_feedback(student.id, request.args.get("project_id"))
        return jsonify({"peer_feedback": items, "rules": peer_feedback_rules()}), 200
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    except SQLAlchemyError as exc:
        current_app.logger.exception("Unable to retrieve peer feedback: %s", exc)
        return _database_error("Unable to retrieve peer feedback")


@student_bp.route("/peer-feedback/<int:feedback_id>", methods=["GET"])
def peer_feedback_detail_route(feedback_id):
    student, response, status = _student_or_response()
    if response:
        return response, status
    try:
        return jsonify({"peer_feedback": get_own_feedback(student.id, feedback_id)}), 200
    except LookupError as exc:
        return jsonify({"message": str(exc)}), 404
    except SQLAlchemyError as exc:
        current_app.logger.exception("Unable to retrieve peer feedback: %s", exc)
        return _database_error("Unable to retrieve peer feedback")


@student_bp.route("/grades", methods=["GET"])
def grades_route():
    student, response, status = _student_or_response()
    if response:
        return response, status
    try:
        return jsonify(get_my_grades(student.id)), 200
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

    download = request.args.get("download", "").lower() in {"1", "true", "yes"}
    return send_file(
        BytesIO(data),
        mimetype=project.requirements_content_type or "application/pdf",
        as_attachment=download,
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
