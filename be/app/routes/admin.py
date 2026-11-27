from flask import Blueprint, current_app, jsonify, request, make_response
import csv
from io import BytesIO, StringIO
from sqlalchemy.exc import SQLAlchemyError
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

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
from app.services.peer_feedback_service import (
    get_any_feedback,
    list_all_feedback,
)
from app.services.data_exchange_service import (
    ImportConflictError,
    ImportValidationError,
    export_records,
    import_records,
    parse_import_file,
    serialize_export,
)
from app.services.user_service import UserConflictError, UserValidationError
from app.security.rate_limit import limiter

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
    writer.writerow([
        "Date", "New users", "New teams", "New tasks", "Submissions",
        "Activity events",
    ])
    for row in report["timeline"]:
        writer.writerow(
            [
                row["date"], row["users"], row["teams"], row["tasks"],
                row["submissions"], row["activity_events"],
            ]
        )
    response = make_response("\ufeff" + output.getvalue())
    response.headers["Content-Type"] = "text/csv; charset=utf-8"
    response.headers["Content-Disposition"] = (
        f'attachment; filename="platform-analytics-{report["start_date"]}-'
        f'{report["end_date"]}.csv"'
    )
    response.headers["Cache-Control"] = "no-store"
    return response


@admin_bp.route("/analytics/export.pdf", methods=["GET"])
def export_analytics_pdf():
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

    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=landscape(letter),
        rightMargin=0.55 * inch,
        leftMargin=0.55 * inch,
        topMargin=0.55 * inch,
        bottomMargin=0.55 * inch,
        title="Platform analytics",
    )
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name="AnalyticsSubtitle",
        parent=styles["Normal"],
        alignment=TA_CENTER,
        textColor=colors.HexColor("#55716b"),
    ))
    story = [
        Paragraph("Platform analytics", styles["Title"]),
        Paragraph(
            f"Activity from {report['start_date']} through {report['end_date']}",
            styles["AnalyticsSubtitle"],
        ),
        Spacer(1, 0.2 * inch),
        Paragraph("Platform totals", styles["Heading2"]),
    ]
    total_items = list(report["totals"].items())
    totals_rows = [["Metric", "Count", "Metric", "Count"]]
    for index in range(0, len(total_items), 2):
        left = total_items[index]
        right = total_items[index + 1] if index + 1 < len(total_items) else ("", "")
        totals_rows.append([left[0].replace("_", " ").title(), str(left[1]), right[0].replace("_", " ").title(), str(right[1])])
    totals_table = Table(totals_rows, colWidths=[2.2 * inch, 1.1 * inch, 2.2 * inch, 1.1 * inch])
    totals_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#075e54")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d7e4e0")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f3f8f6")]),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    story.extend([totals_table, Spacer(1, 0.2 * inch), Paragraph("Activity by day", styles["Heading2"])])
    timeline_rows = [[
        "Date", "New users", "New teams", "New tasks", "Submissions",
        "Activity events",
    ]]
    timeline_rows.extend([
        [
            row["date"], str(row["users"]), str(row["teams"]),
            str(row["tasks"]), str(row["submissions"]),
            str(row["activity_events"]),
        ]
        for row in report["timeline"]
    ])
    timeline_table = Table(
        timeline_rows,
        repeatRows=1,
        colWidths=[1.65 * inch, 1.65 * inch, 1.65 * inch, 1.65 * inch, 1.65 * inch, 1.65 * inch],
    )
    timeline_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#075e54")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d7e4e0")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f3f8f6")]),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(timeline_table)
    document.build(story)
    response = make_response(buffer.getvalue())
    response.headers["Content-Type"] = "application/pdf"
    response.headers["Content-Disposition"] = (
        f'attachment; filename="platform-analytics-{report["start_date"]}-'
        f'{report["end_date"]}.pdf"'
    )
    response.headers["Cache-Control"] = "no-store"
    return response


@admin_bp.route("/data/export", methods=["GET"])
def export_data():
    admin, error = get_authenticated_admin()
    if error:
        message, status = error
        return jsonify({"message": message}), status
    entity = request.args.get("entity", "users").lower()
    export_format = request.args.get("format", "json").lower()
    try:
        records = export_records(entity)
        body, mimetype, extension = serialize_export(entity, export_format, records)
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    response = make_response(body)
    response.headers["Content-Type"] = mimetype
    response.headers["Content-Disposition"] = (
        f'attachment; filename="{entity}-export.{extension}"'
    )
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@admin_bp.route("/data/import", methods=["POST"])
@limiter.limit("10 per hour")
def import_data():
    admin, error = get_authenticated_admin()
    if error:
        message, status = error
        return jsonify({"message": message}), status

    try:
        if request.is_json:
            payload = request.get_json()
            entity = payload.get("entity", "users")
            records = payload.get("records")
        else:
            entity = request.form.get("entity", "users")
            upload = request.files.get("file")
            if upload is None or not upload.filename:
                return jsonify({"message": "A CSV or JSON import file is required"}), 400
            records = parse_import_file(
                upload.filename,
                upload.stream.read(2 * 1024 * 1024 + 1),
            )
        entity = entity.strip().lower() if isinstance(entity, str) else ""
        count = import_records(entity, records)
        return jsonify({
            "message": f"Imported {count} {entity} record(s)",
            "entity": entity,
            "imported": count,
        }), 201
    except ImportValidationError as exc:
        return jsonify({"message": str(exc), "errors": exc.errors}), 400
    except ImportConflictError as exc:
        return jsonify({"message": str(exc)}), 409
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    except SQLAlchemyError:
        return _database_error("Unable to import data")


@admin_bp.route("/users", methods=["GET"])
def users():
    admin, error = get_authenticated_admin()
    if error:
        message, status = error
        return jsonify({"message": message}), status
    search = request.args.get("search")
    role = request.args.get("role")
    try:
        page = int(request.args.get("page", 1))
    except (TypeError, ValueError):
        page = 1
    try:
        per_page = int(request.args.get("per_page", 50))
    except (TypeError, ValueError):
        per_page = 50
    try:
        return jsonify(list_users(search=search, role=role, page=page, per_page=per_page)), 200
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
    except (ValueError, UserValidationError) as exc:
        return jsonify({"message": str(exc)}), 400
    except UserConflictError as exc:
        return jsonify({"message": str(exc)}), 409
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
    except (ValueError, UserValidationError) as exc:
        return jsonify({"message": str(exc)}), 400
    except UserConflictError as exc:
        return jsonify({"message": str(exc)}), 409
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
    except ValueError as exc:
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
    except ValueError as exc:
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
    except ValueError as exc:
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


@admin_bp.route("/peer-feedback", methods=["GET"])
def peer_feedback_list():
    admin, error = get_authenticated_admin()
    if error:
        message, status = error
        return jsonify({"message": message}), status
    try:
        items = list_all_feedback(
            request.args.get("project_id"), request.args.get("student_id")
        )
        return jsonify({"peer_feedback": items}), 200
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    except SQLAlchemyError as exc:
        current_app.logger.exception("Unable to retrieve peer feedback: %s", exc)
        return _database_error("Unable to retrieve peer feedback")


@admin_bp.route("/peer-feedback/<int:feedback_id>", methods=["GET"])
def peer_feedback_detail(feedback_id):
    admin, error = get_authenticated_admin()
    if error:
        message, status = error
        return jsonify({"message": message}), status
    try:
        return jsonify({"peer_feedback": get_any_feedback(feedback_id)}), 200
    except LookupError as exc:
        return jsonify({"message": str(exc)}), 404
    except SQLAlchemyError as exc:
        current_app.logger.exception("Unable to retrieve peer feedback: %s", exc)
        return _database_error("Unable to retrieve peer feedback")
