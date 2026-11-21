from sqlalchemy import func

from app.extensions import db
from app.models.student_dashboard import Course, CourseEnrollment, Project, Team
from app.models.submission import Submission
from app.models.user import User
from app.services.auth_service import get_authenticated_user
from app.services.user_service import (
    UserConflictError,
    UserValidationError,
    create_user,
    update_profile_fields,
)


def get_authenticated_admin():
    return get_authenticated_user(allowed_roles={"admin"})


def get_stats():
    return {
        "users": User.query.count(),
        "students": User.query.filter_by(role="student").count(),
        "instructors": User.query.filter_by(role="instructor").count(),
        "admins": User.query.filter_by(role="admin").count(),
        "courses": Course.query.count(),
        "projects": Project.query.count(),
        "teams": Team.query.count(),
        "submissions": Submission.query.count(),
    }


def list_users(search=None, role=None):
    query = User.query
    if role:
        query = query.filter(User.role == role)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (User.first_name.ilike(pattern))
            | (User.last_name.ilike(pattern))
            | (User.email.ilike(pattern))
            | (User.student_id.ilike(pattern))
        )
    users = query.order_by(User.id.asc()).limit(200).all()
    return [
        {
            "id": u.id,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "email": u.email,
            "role": u.role,
            "student_id": u.student_id,
            "profile_picture": u.profile_picture,
        }
        for u in users
    ]


def create_user_admin(data):
    user = create_user(
        first_name=data.get("first_name"),
        last_name=data.get("last_name"),
        email=data.get("email"),
        password=data.get("password"),
        role=data.get("role", "student"),
        student_id=data.get("student_id"),
    )
    return user


def update_user_admin(user_id, data):
    user = db.session.get(User, user_id)
    if user is None:
        raise LookupError("User not found")

    if "role" in data and data.get("role") is not None:
        if data["role"] not in {"student", "instructor", "admin"}:
            raise ValueError("Invalid role")
        user.role = data["role"]
        if user.role != "student":
            user.student_id = None

    update_profile_fields(
        user,
        first_name=data.get("first_name"),
        last_name=data.get("last_name"),
        student_id=data.get("student_id"),
    )
    db.session.commit()
    return user


def delete_user_admin(user_id):
    user = db.session.get(User, user_id)
    if user is None:
        raise LookupError("User not found")
    db.session.delete(user)
    db.session.commit()
    return {"message": "User deleted"}


def list_courses():
    courses = Course.query.options().order_by(Course.id.asc()).all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "academic_year": c.academic_year,
            "semester": c.semester,
            "instructor_id": c.instructor_id,
            "microsoft_class_id": c.microsoft_class_id,
            "student_count": CourseEnrollment.query.filter_by(course_id=c.id).count(),
            "projects": [
                {"id": project.id, "title": project.title}
                for project in sorted(c.projects, key=lambda item: item.id, reverse=True)
            ],
        }
        for c in courses
    ]


def create_course(data):
    instructor_id = data.get("instructor_id")
    if instructor_id is not None:
        instructor = User.query.filter_by(id=instructor_id, role="instructor").first()
        if instructor is None:
            raise ValueError("Instructor not found")
    course = Course(
        instructor_id=instructor_id,
        name=data.get("name"),
        academic_year=data.get("academic_year"),
        semester=data.get("semester"),
        microsoft_class_id=data.get("microsoft_class_id"),
    )
    if not course.name or not course.academic_year or not course.semester:
        raise ValueError("name, academic_year and semester are required")
    if course.semester not in {"fall", "spring", "summer"}:
        raise ValueError("Invalid semester")
    db.session.add(course)
    db.session.commit()
    return course


def update_course(course_id, data):
    course = db.session.get(Course, course_id)
    if course is None:
        raise LookupError("Course not found")
    if "name" in data and data.get("name") is not None:
        course.name = data["name"]
    if "academic_year" in data and data.get("academic_year") is not None:
        course.academic_year = data["academic_year"]
    if "semester" in data and data.get("semester") is not None:
        if data["semester"] not in {"fall", "spring", "summer"}:
            raise ValueError("Invalid semester")
        course.semester = data["semester"]
    if "instructor_id" in data:
        iid = data.get("instructor_id")
        if iid is None:
            raise ValueError("instructor_id is required")
        instructor = User.query.filter_by(id=iid, role="instructor").first()
        if instructor is None:
            raise ValueError("Instructor not found")
        course.instructor_id = iid
    if "microsoft_class_id" in data:
        course.microsoft_class_id = data.get("microsoft_class_id")
    db.session.commit()
    return course


def delete_course(course_id):
    course = db.session.get(Course, course_id)
    if course is None:
        raise LookupError("Course not found")
    db.session.delete(course)
    db.session.commit()
    return {"message": "Course deleted"}


def enroll_student(course_id, student_id):
    course = db.session.get(Course, course_id)
    if course is None:
        raise LookupError("Course not found")
    student = User.query.filter_by(id=student_id, role="student").first()
    if student is None:
        raise LookupError("Student not found")
    exists = CourseEnrollment.query.filter_by(
        student_id=student_id, course_id=course_id
    ).first()
    if exists is not None:
        raise ValueError("Student already enrolled")
    enrollment = CourseEnrollment(student_id=student_id, course_id=course_id)
    db.session.add(enrollment)
    db.session.commit()
    return {"message": "Student enrolled"}


def remove_student(course_id, student_id):
    enrollment = CourseEnrollment.query.filter_by(
        student_id=student_id, course_id=course_id
    ).first()
    if enrollment is None:
        raise LookupError("Enrollment not found")
    db.session.delete(enrollment)
    db.session.commit()
    return {"message": "Student removed"}