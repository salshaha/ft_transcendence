import mimetypes

from flask import Blueprint, current_app, jsonify, request, send_file, session
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.utils import secure_filename

from app.extensions import db
from app.models.user import User
from app.security.csrf import rotate_csrf_token
from app.services.auth_service import get_authenticated_user
from app.services.student_directory_service import can_view_avatar
from app.services.storage import StorageError, StorageValidationError
from app.services.user_service import (
    UserAuthenticationError,
    UserConflictError,
    UserValidationError,
    add_user_skill,
    remove_user_skill,
    update_credentials,
    update_profile,
    update_user_skill,
)

users_bp = Blueprint("users", __name__)


@users_bp.route("/update_info", methods=["PUT"])
def update_info():
    user, error = get_authenticated_user()
    if error:
        message, status = error
        return jsonify({"message": message}), status

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        data = request.form

    new_password = data.get("new_password")
    legacy_password = data.get("password")
    if (
        new_password is not None
        and legacy_password is not None
        and new_password != legacy_password
    ):
        return jsonify({
            "message": "Provide either new_password or password, not both"
        }), 400
    if new_password is None:
        new_password = legacy_password

    email = data.get("email")

    try:
        updated_user = update_credentials(
            user,
            current_password=data.get("current_password"),
            email=email,
            new_password=new_password,
        )
    except UserValidationError as exc:
        return jsonify({"message": str(exc)}), 400
    except UserAuthenticationError as exc:
        return jsonify({"message": str(exc)}), 403
    except UserConflictError as exc:
        return jsonify({"message": str(exc)}), 409
    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception("Unable to update user information")
        return jsonify({"message": "Unable to update account information"}), 500

    session["email"] = updated_user.email
    return jsonify({
        "message": "Information updated successfully",
        "user": {
            "id": updated_user.id,
            "email": updated_user.email,
        },
        "csrf_token": rotate_csrf_token(),
    }), 200


@users_bp.route("/me", methods=["GET"])
def me():
    user, error = get_authenticated_user()
    if error:
        message, status = error
        return jsonify({"message": message}), status

    skills = [
        {
            "id": ss.skill_id,
            "skill_id": ss.skill_id,
            "name": ss.skill.name,
            "category": ss.skill.category,
            "proficiency_level": ss.proficiency_level,
        }
        for ss in user.skills
    ]
    return jsonify({
        "user": {
            "id": user.id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
            "role": user.role,
            "major": user.major,
            "joined_year": user.joined_year,
            "domain": user.domain,
            "student_id": user.student_id,
            "profile_picture": user.profile_picture,
            "gpa": float(user.gpa.gpa) if user.gpa else None,
            "skills": skills,
        }
    }), 200


@users_bp.route("/me", methods=["PUT"])
def update_me():
    user, error = get_authenticated_user()
    if error:
        message, status = error
        return jsonify({"message": message}), status

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        data = request.form

    try:
        updated = update_profile(
            user,
            first_name=data.get("first_name"),
            last_name=data.get("last_name"),
            major=data.get("major"),
            joined_year=data.get("joined_year"),
            domain=data.get("domain"),
            student_id=data.get("student_id"),
        )
    except (UserValidationError, UserConflictError) as exc:
        return jsonify({"message": str(exc)}), 400
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"message": "Unable to update profile"}), 500

    return jsonify({"message": "Profile updated", "user_id": updated.id}), 200


@users_bp.route("/me/avatar", methods=["POST"])
def upload_avatar():
    user, error = get_authenticated_user()
    if error:
        message, status = error
        return jsonify({"message": message}), status

    file_storage = request.files.get("avatar") or request.files.get("file")
    if file_storage is None:
        return jsonify({"message": "avatar file is required"}), 400

    storage = current_app.extensions["storage"]
    try:
        stored = storage.save_upload(file_storage, "avatar", user.id)
    except StorageValidationError as exc:
        return jsonify({"message": str(exc)}), 400
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"message": "Unable to upload avatar"}), 500

    old_key = user.profile_picture
    user.profile_picture = stored.key
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        storage.delete(stored.key)
        return jsonify({"message": "Unable to save avatar"}), 500

    if old_key and old_key != stored.key:
        storage.delete(old_key)
    return jsonify({
        "message": "Avatar uploaded",
        "profile_picture": stored.key,
    }), 200


@users_bp.route("/me/avatar", methods=["DELETE"])
def delete_avatar():
    user, error = get_authenticated_user()
    if error:
        message, status = error
        return jsonify({"message": message}), status

    key = user.profile_picture
    user.profile_picture = None
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"message": "Unable to remove avatar"}), 500

    if key:
        current_app.extensions["storage"].delete(key)
    return jsonify({"message": "Avatar removed"}), 200


def _avatar_response(user):
    key = user.profile_picture
    if not key:
        return jsonify({"message": "Avatar not found"}), 404
    try:
        stream = current_app.extensions["storage"].open(key)
    except (StorageError, OSError):
        return jsonify({"message": "Unable to read avatar"}), 404
    content_type = mimetypes.guess_type(key)[0] or "application/octet-stream"
    return send_file(
        stream,
        mimetype=content_type,
        as_attachment=False,
        download_name="avatar",
    )


@users_bp.route("/me/avatar", methods=["GET"])
def my_avatar():
    user, error = get_authenticated_user()
    if error:
        message, status = error
        return jsonify({"message": message}), status
    return _avatar_response(user)


@users_bp.route("/users/<int:user_id>/avatar", methods=["GET"])
def user_avatar(user_id):
    viewer, error = get_authenticated_user()
    if error:
        message, status = error
        return jsonify({"message": message}), status

    try:
        if not can_view_avatar(viewer, user_id):
            return jsonify({
                "message": "You do not have permission to view this avatar"
            }), 403
        target = db.session.get(User, user_id)
    except LookupError as exc:
        return jsonify({"message": str(exc)}), 404

    return _avatar_response(target)


@users_bp.route("/skills", methods=["GET"])
def list_skills():
    user, error = get_authenticated_user()
    if error:
        message, status = error
        return jsonify({"message": message}), status

    from app.models.skill import Skill

    query = Skill.query
    search = request.args.get("search") or request.args.get("q")
    if search:
        pattern = f"%{search}%"
        query = query.filter(Skill.name.ilike(pattern))
    category = request.args.get("category")
    if category:
        query = query.filter(Skill.category == category)
    skills = query.order_by(Skill.name.asc()).limit(100).all()
    return jsonify({
        "skills": [
            {
                "id": s.id,
                "name": s.name,
                "category": s.category,
                "description": s.description,
            }
            for s in skills
        ]
    }), 200


@users_bp.route("/me/skills", methods=["POST"])
def add_skill():
    user, error = get_authenticated_user()
    if error:
        message, status = error
        return jsonify({"message": message}), status

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        data = request.form

    try:
        skill, membership = add_user_skill(
            user,
            skill_id=data.get("skill_id"),
            name=data.get("name") or data.get("skill"),
            category=data.get("category"),
            proficiency_level=data.get("proficiency_level", 3),
        )
    except (UserValidationError, UserConflictError) as exc:
        return jsonify({"message": str(exc)}), 400
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"message": "Unable to add skill"}), 500

    return jsonify({
        "message": "Skill added",
        "skill": {
            "id": skill.id,
            "name": skill.name,
            "category": skill.category,
        },
        "proficiency_level": membership.proficiency_level,
    }), 201


@users_bp.route("/me/skills/<int:skill_id>", methods=["PUT"])
def update_skill(skill_id):
    user, error = get_authenticated_user()
    if error:
        message, status = error
        return jsonify({"message": message}), status

    data = request.get_json(silent=True) or {}
    try:
        membership = update_user_skill(
            user, skill_id, data.get("proficiency_level", 3)
        )
    except (UserValidationError, UserConflictError) as exc:
        return jsonify({"message": str(exc)}), 400
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"message": "Unable to update skill"}), 500

    return jsonify({
        "message": "Skill updated",
        "skill_id": skill_id,
        "proficiency_level": membership.proficiency_level,
    }), 200


@users_bp.route("/me/skills/<int:skill_id>", methods=["DELETE"])
def remove_skill(skill_id):
    user, error = get_authenticated_user()
    if error:
        message, status = error
        return jsonify({"message": message}), status

    try:
        remove_user_skill(user, skill_id)
    except (UserValidationError, UserConflictError) as exc:
        return jsonify({"message": str(exc)}), 400
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"message": "Unable to remove skill"}), 500

    return jsonify({"message": "Skill removed"}), 200