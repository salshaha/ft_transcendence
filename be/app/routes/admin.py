import csv
from io import StringIO

from flask import Blueprint, jsonify, make_response, request
from sqlalchemy.exc import SQLAlchemyError

from app.extensions import db
from app.services.admin_service import (
    create_course,
    create_user_admin,
    delete_course,
    delete_user_admin,
    enroll_student,
    get_authenticated_admin,
    get_analytics,
    get_stats,
    list_courses,
    list_users,
    remove_student,
    update_course,
    update_user_admin,
)

admin_bp = Blueprint("admin", __name__)


def _database_error(message):
    db.session.rollback()
    return jsonify({"message": message}), 500


@admin_bp.route("/dashboard", methods=["GET"])
def dashboard():
    admin, error = get_authenticated_admin()
    if error:
        message, status = error
        return jsonify({"message": message}), status
    try:
        return jsonify(get_stats()), 200
    except SQLAlchemyError:
        return _database_error("Unable to retrieve stats")


@admin_bp.route("/analytics", methods=["GET"])
def analytics():
    admin, error = get_authenticated_admin()
    if error:
        message, status = error
        return jsonify({"message": message}), status
    try:
        return jsonify(
            get_analytics(
                request.args.get("start_date"), request.args.get("end_date")
            )
        ), 200
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    except SQLAlchemyError:
        return _database_error("Unable to retrieve analytics")


@admin_bp.route("/analytics/export.csv", methods=["GET"])
def export_analytics_csv():
    admin, error = get_authenticated_admin()
    if error:
        message, status = error
        return jsonify({"message": message}), status
    try:
        report = get_analytics(
            request.args.get("start_date"), request.args.get("end_date")
        )
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    except SQLAlchemyError:
        return _database_error("Unable to export analytics")

    output = StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(["Platform analytics", report["start_date"], report["end_date"]])
    writer.writerow(["Current total", "Count"])
    writer.writerows(report["totals"].items())
    writer.writerow([])
    writer.writerow(["Activity by date"])
    writer.writerow(["Date", "New users", "New teams", "New tasks", "Submissions"])
    for row in report["timeline"]:
        writer.writerow(
            [row["date"], row["users"], row["teams"], row["tasks"], row["submissions"]]
        )
    response = make_response("\ufeff" + output.getvalue())
    response.headers["Content-Type"] = "text/csv; charset=utf-8"
    response.headers["Content-Disposition"] = (
        f'attachment; filename="platform-analytics-{report["start_date"]}-'
        f'{report["end_date"]}.csv"'
    )
    return response


@admin_bp.route("/users", methods=["GET"])
def users():
    admin, error = get_authenticated_admin()
    if error:
        message, status = error
        return jsonify({"message": message}), status
    search = request.args.get("search")
    role = request.args.get("role")
    try:
        return jsonify({"users": list_users(search=search, role=role)}), 200
    except SQLAlchemyError:
        return _database_error("Unable to retrieve users")


@admin_bp.route("/users", methods=["POST"])
def create_user():
    admin, error = get_authenticated_admin()
    if error:
        message, status = error
        return jsonify({"message": message}), status
    data = request.get_json(silent=True) or {}
    try:
        user = create_user_admin(data)
        return jsonify({"user": {"id": user.id, "email": user.email, "role": user.role}}), 201
    except (ValueError, Exception) as exc:
        return jsonify({"message": str(exc)}), 400
    except SQLAlchemyError:
        return _database_error("Unable to create user")


@admin_bp.route("/users/<int:user_id>", methods=["PUT"])
def update_user(user_id):
    admin, error = get_authenticated_admin()
    if error:
        message, status = error
        return jsonify({"message": message}), status
    data = request.get_json(silent=True) or {}
    try:
        user = update_user_admin(user_id, data)
        return jsonify({"user": {"id": user.id, "email": user.email, "role": user.role}}), 200
    except LookupError as exc:
        return jsonify({"message": str(exc)}), 404
    except (ValueError, Exception) as exc:
        return jsonify({"message": str(exc)}), 400
    except SQLAlchemyError:
        return _database_error("Unable to update user")


@admin_bp.route("/users/<int:user_id>", methods=["DELETE"])
def delete_user(user_id):
    admin, error = get_authenticated_admin()
    if error:
        message, status = error
        return jsonify({"message": message}), status
    try:
        result = delete_user_admin(user_id)
        return jsonify(result), 200
    except LookupError as exc:
        return jsonify({"message": str(exc)}), 404
    except SQLAlchemyError:
        return _database_error("Unable to delete user")


@admin_bp.route("/courses", methods=["GET"])
def courses():
    admin, error = get_authenticated_admin()
    if error:
        message, status = error
        return jsonify({"message": message}), status
    try:
        return jsonify({"courses": list_courses()}), 200
    except SQLAlchemyError:
        return _database_error("Unable to retrieve courses")


@admin_bp.route("/courses", methods=["POST"])
def create_course_route():
    admin, error = get_authenticated_admin()
    if error:
        message, status = error
        return jsonify({"message": message}), status
    data = request.get_json(silent=True) or {}
    try:
        course = create_course(data)
        return jsonify({"course": {"id": course.id, "name": course.name}}), 201
    except (ValueError, Exception) as exc:
        return jsonify({"message": str(exc)}), 400
    except SQLAlchemyError:
        return _database_error("Unable to create course")


@admin_bp.route("/courses/<int:course_id>", methods=["PUT"])
def update_course_route(course_id):
    admin, error = get_authenticated_admin()
    if error:
        message, status = error
        return jsonify({"message": message}), status
    data = request.get_json(silent=True) or {}
    try:
        course = update_course(course_id, data)
        return jsonify({"course": {"id": course.id, "name": course.name}}), 200
    except LookupError as exc:
        return jsonify({"message": str(exc)}), 404
    except (ValueError, Exception) as exc:
        return jsonify({"message": str(exc)}), 400
    except SQLAlchemyError:
        return _database_error("Unable to update course")


@admin_bp.route("/courses/<int:course_id>", methods=["DELETE"])
def delete_course_route(course_id):
    admin, error = get_authenticated_admin()
    if error:
        message, status = error
        return jsonify({"message": message}), status
    try:
        result = delete_course(course_id)
        return jsonify(result), 200
    except LookupError as exc:
        return jsonify({"message": str(exc)}), 404
    except SQLAlchemyError:
        return _database_error("Unable to delete course")


@admin_bp.route("/courses/<int:course_id>/students", methods=["POST"])
def enroll_student_route(course_id):
    admin, error = get_authenticated_admin()
    if error:
        message, status = error
        return jsonify({"message": message}), status
    data = request.get_json(silent=True) or {}
    student_id = data.get("student_id")
    if student_id is None:
        return jsonify({"message": "student_id is required"}), 400
    try:
        result = enroll_student(course_id, int(student_id))
        return jsonify(result), 201
    except LookupError as exc:
        return jsonify({"message": str(exc)}), 404
    except (ValueError, Exception) as exc:
        return jsonify({"message": str(exc)}), 400
    except SQLAlchemyError:
        return _database_error("Unable to enroll student")


@admin_bp.route("/courses/<int:course_id>/students/<int:student_id>", methods=["DELETE"])
def remove_student_route(course_id, student_id):
    admin, error = get_authenticated_admin()
    if error:
        message, status = error
        return jsonify({"message": message}), status
    try:
        result = remove_student(course_id, student_id)
        return jsonify(result), 200
    except LookupError as exc:
        return jsonify({"message": str(exc)}), 404
    except SQLAlchemyError:
        return _database_error("Unable to remove student")
