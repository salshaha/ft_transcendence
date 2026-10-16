from flask import Blueprint, jsonify, request, session
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash
from email_validator import EmailNotValidError, validate_email

from app.extensions import db
from app.models.user import User

users_bp = Blueprint("users", __name__)


@users_bp.route("/update_info", methods=["PUT"])
def update_info():
	user_id = session.get("user_id")
	if user_id is None:
		return jsonify({"message": "No user is logged in"}), 401

	user = db.session.get(User, user_id)
	if user is None:
		session.clear()
		return jsonify({"message": "User not found"}), 404

	data = request.get_json(silent=True) or request.form
	password = data.get("password")
	email = data.get("email")

	if password is not None:
		user.password_hash = generate_password_hash(password)

	if email is not None:
		normalized_email = see_if_validate_email(email)
		if not normalized_email:
			return jsonify({"message": "Invalid email address"}), 400
		user.email = normalized_email

	try:
		db.session.commit()
	except IntegrityError:
		db.session.rollback()
		return jsonify({"message": "Email already exists"}), 409

	return jsonify({"message": "Information updated successfully"}), 200


@users_bp.route("/login", methods=["POST"])
def login():
	data = request.get_json(silent=True) or {}
	password = data.get("password")
	email = data.get("email")

	if not email or not password:
		return jsonify({"message": "Wrong email or password"}), 401

	user = User.query.filter_by(email=email).first()
	if user and user.password_hash and check_password_hash(user.password_hash, password):
		session.clear()
		session.permanent = True
		session["user_id"] = user.id
		session["email"] = user.email
		return jsonify({"message": "Login successful"}), 200

	return jsonify({"message": "Wrong email or password"}), 401


@users_bp.route("/logout", methods=["GET", "POST"])
def logout():
	session.clear()
	return jsonify({"message": "Logout successful"}), 200


def see_if_validate_email(email):
	try:
		normalized = validate_email(email, check_deliverability=False)
		return normalized.email
	except EmailNotValidError:
		return False

@users_bp.route("/signup", methods=["POST"])
def signup():
	data = request.get_json(silent=True) or {}
	first_name = data.get("first_name")
	last_name = data.get("last_name")
	email = data.get("email")
	password = data.get("password")
	major = data.get("major")
	joined_year = data.get("joined_year")
	role = data.get("role")
	microsoft_id = data.get("microsoft_id")
	student_id = data.get("student_id")
	domain = data.get("domain")

	if not first_name or not last_name or not email or not role \
			or (not password and not microsoft_id):
		return jsonify({
			"message": "First name, last name, email, role, and a password "
			"or Microsoft ID are required"
		}), 400

	if role not in ["student", "instructor", "admin"]:
			return jsonify({"message": "Invalid role"}), 400

	if role == "student" and not student_id:
		return jsonify({
			"message": "Student ID are required for students"
		}), 400

	email = see_if_validate_email(email)
	if not email:
		return jsonify({"message": "Invalid email address"}), 400

	if User.query.filter_by(email=email).first():
		return jsonify({"message": "Email already exists"}), 409


	password_hash = generate_password_hash(password)

	new_user = User(
		first_name = first_name,
		last_name = last_name,
		email = email,
		password_hash = password_hash,
		major = major,
		joined_year = joined_year,
		role = role,
		microsoft_id = microsoft_id or None,
		student_id = student_id or None,
		domain = domain or None
	)

	db.session.add(new_user)
	try:
		db.session.commit()
	except IntegrityError:
		db.session.rollback()
		return jsonify({"message": "Email or Microsoft ID already exists"}), 409

	return jsonify({
		"message": "User created successfully",
		"user": {
			"id": new_user.id,
			"name": f"{new_user.first_name} {new_user.last_name}",
			"email": new_user.email,
			"major": new_user.major,
			"joined_year": new_user.joined_year,
			"role": new_user.role,
			"microsoft_id": new_user.microsoft_id,
			"student_id": new_user.student_id,
			"domain": new_user.domain,
		},
	}), 201

