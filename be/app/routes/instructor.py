from flask import Blueprint, current_app, jsonify, request, send_file
from io import BytesIO
from sqlalchemy.exc import SQLAlchemyError

from app.extensions import db
from app.services.instructor_service import (
    create_project,
    delete_project,
    get_authenticated_instructor,
    get_course_students,
    get_courses,
    get_dashboard,
    get_project_submissions,
    get_project_teams,
    save_grade,
    serialize_project,
    update_project,
    upload_project_requirements,
)
from app.services.storage import StorageError

instructor_bp = Blueprint("instructor", __name__)


def _database_error(message):
    db.session.rollback()
    return jsonify({"message": message}), 500


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


@instructor_bp.route("/courses", methods=["GET"])
def courses():
    instructor, error = get_authenticated_instructor()
    if error:
        message, status = error
        return jsonify({"message": message}), status
    try:
        return jsonify({"courses": get_courses(instructor.id)}), 200
    except SQLAlchemyError:
        return _database_error("Unable to retrieve courses")


@instructor_bp.route("/courses/<int:course_id>/students", methods=["GET"])
def course_students(course_id):
    instructor, error = get_authenticated_instructor()
    if error:
        message, status = error
        return jsonify({"message": message}), status
    try:
        students = get_course_students(instructor.id, course_id)
        if students is None:
            return jsonify({"message": "Course not found"}), 404
        return jsonify({"students": students}), 200
    except SQLAlchemyError:
        return _database_error("Unable to retrieve students")


@instructor_bp.route("/courses/<int:course_id>/project", methods=["POST"])
def create_course_project(course_id):
    instructor, error = get_authenticated_instructor()
    if error:
        message, status = error
        return jsonify({"message": message}), status

    data = request.get_json(silent=True) or {}
    try:
        project = create_project(instructor.id, course_id, data)
        return jsonify({"project": project}), 201
    except LookupError as exc:
        return jsonify({"message": str(exc)}), 404
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    except SQLAlchemyError:
        return _database_error("Unable to create project")


@instructor_bp.route("/projects/<int:project_id>", methods=["GET"])
def get_project(project_id):
    instructor, error = get_authenticated_instructor()
    if error:
        message, status = error
        return jsonify({"message": message}), status

    from app.models.student_dashboard import Project, Course

    project = (
        Project.query.join(Course, Course.id == Project.course_id)
        .filter(Project.id == project_id, Course.instructor_id == instructor.id)
        .first()
    )
    if project is None:
        return jsonify({"message": "Project not found"}), 404
    return jsonify({"project": serialize_project(project)}), 200


@instructor_bp.route("/projects/<int:project_id>", methods=["PUT"])
def update_course_project(project_id):
    instructor, error = get_authenticated_instructor()
    if error:
        message, status = error
        return jsonify({"message": message}), status

    data = request.get_json(silent=True) or {}
    try:
        project = update_project(instructor.id, project_id, data)
        return jsonify({"project": project}), 200
    except LookupError as exc:
        return jsonify({"message": str(exc)}), 404
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    except SQLAlchemyError:
        return _database_error("Unable to update project")


@instructor_bp.route("/projects/<int:project_id>", methods=["DELETE"])
def delete_course_project(project_id):
    instructor, error = get_authenticated_instructor()
    if error:
        message, status = error
        return jsonify({"message": message}), status

    try:
        result = delete_project(instructor.id, project_id)
        return jsonify(result), 200
    except LookupError as exc:
        return jsonify({"message": str(exc)}), 404
    except SQLAlchemyError:
        return _database_error("Unable to delete project")


@instructor_bp.route("/projects/<int:project_id>/requirements", methods=["POST"])
def upload_requirements(project_id):
    instructor, error = get_authenticated_instructor()
    if error:
        message, status = error
        return jsonify({"message": message}), status

    file_storage = request.files.get("file") or request.files.get("requirements")
    if file_storage is None:
        return jsonify({"message": "requirements file is required"}), 400

    try:
        project = upload_project_requirements(
            instructor.id, project_id, file_storage
        )
        return jsonify({"project": project}), 200
    except LookupError as exc:
        return jsonify({"message": str(exc)}), 404
    except Exception as exc:  # StorageValidationError etc
        return jsonify({"message": str(exc)}), 400
    except SQLAlchemyError:
        return _database_error("Unable to upload requirements")


@instructor_bp.route("/projects/<int:project_id>/requirements", methods=["GET"])
def download_requirements(project_id):
    instructor, error = get_authenticated_instructor()
    if error:
        message, status = error
        return jsonify({"message": message}), status

    from app.models.student_dashboard import Project, Course

    project = (
        Project.query.join(Course, Course.id == Project.course_id)
        .filter(Project.id == project_id, Course.instructor_id == instructor.id)
        .first()
    )
    if project is None or not project.requirements_file_key:
        return jsonify({"message": "Requirements not found"}), 404

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


@instructor_bp.route("/projects/<int:project_id>/teams", methods=["GET"])
def project_teams(project_id):
    instructor, error = get_authenticated_instructor()
    if error:
        message, status = error
        return jsonify({"message": message}), status

    try:
        teams = get_project_teams(instructor.id, project_id)
        return jsonify({"teams": teams}), 200
    except LookupError as exc:
        return jsonify({"message": str(exc)}), 404
    except SQLAlchemyError:
        return _database_error("Unable to retrieve teams")


@instructor_bp.route("/projects/<int:project_id>/submissions", methods=["GET"])
def project_submissions(project_id):
    instructor, error = get_authenticated_instructor()
    if error:
        message, status = error
        return jsonify({"message": message}), status

    try:
        submissions = get_project_submissions(instructor.id, project_id)
        return jsonify({"submissions": submissions}), 200
    except LookupError as exc:
        return jsonify({"message": str(exc)}), 404
    except SQLAlchemyError:
        return _database_error("Unable to retrieve submissions")


@instructor_bp.route("/grades", methods=["POST"])
def create_or_update_grade():
    instructor, error = get_authenticated_instructor()
    if error:
        message, status = error
        return jsonify({"message": message}), status

    data = request.get_json(silent=True) or {}
    try:
        grade = save_grade(instructor.id, data)
        return jsonify({"grade": grade}), 200
    except LookupError as exc:
        return jsonify({"message": str(exc)}), 404
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    except SQLAlchemyError:
        return _database_error("Unable to save grade")