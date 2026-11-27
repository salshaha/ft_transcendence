import unittest
from datetime import datetime, timezone

from werkzeug.security import generate_password_hash


class ProjectDeadlineUpdateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from app import create_app
        from app.extensions import db
        from app.models.student_dashboard import Course, CourseEnrollment, Project
        from app.models.user import User

        cls.db = db
        cls.Project = Project
        cls.app = create_app()
        cls.app.config["TESTING"] = True
        cls.context = cls.app.app_context()
        cls.context.push()
        db.create_all()

        instructor = User(
            id=301,
            first_name="Deadline",
            last_name="Instructor",
            email="deadline-instructor@example.com",
            password_hash=generate_password_hash("Password123!"),
            role="instructor",
        )
        student = User(
            id=302,
            first_name="Deadline",
            last_name="Student",
            email="deadline-student@example.com",
            password_hash=generate_password_hash("Password123!"),
            role="student",
        )
        db.session.add_all([instructor, student])
        db.session.flush()

        course = Course(
            id=301,
            instructor_id=instructor.id,
            name="Deadline Course",
            academic_year="2026",
            semester="fall",
        )
        db.session.add(course)
        db.session.flush()
        project = Project(
            id=301,
            course_id=course.id,
            title="Deadline Project",
            min_members_per_team=1,
            max_members_per_team=3,
            deadline=datetime(2026, 11, 30, 12, tzinfo=timezone.utc),
            prd="",
        )
        db.session.add_all([project, CourseEnrollment(student_id=student.id, course_id=course.id)])
        db.session.commit()

        cls.instructor_id = instructor.id
        cls.student_id = student.id
        cls.course_id = course.id
        cls.project_id = project.id
        cls.csrf_token = "deadline-csrf-token"

    @classmethod
    def tearDownClass(cls):
        cls.db.session.remove()
        cls.db.drop_all()
        cls.context.pop()

    def setUp(self):
        self.client = self.app.test_client()

    def login(self, user_id):
        with self.client.session_transaction() as session:
            session["user_id"] = user_id
            session["_csrf_token"] = self.csrf_token

    def request(self, method, path, payload=None):
        return getattr(self.client, method)(
            path,
            json=payload or {},
            headers={"X-CSRF-Token": self.csrf_token},
        )

    def test_instructor_deadline_update_persists_and_is_visible_to_student(self):
        expected = datetime(2026, 12, 1, 7, tzinfo=timezone.utc)
        self.login(self.instructor_id)
        response = self.request(
            "put",
            f"/api/instructor/projects/{self.project_id}",
            {"deadline": "2026-12-01T10:00:00+03:00"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self._as_utc(response.get_json()["project"]["deadline"]), expected)

        stored = self.db.session.get(self.Project, self.project_id).deadline
        self.assertEqual(self._as_utc(stored.isoformat()), expected)

        self.login(self.student_id)
        student_response = self.client.get(
            f"/api/student/courses/{self.course_id}/project"
        )
        self.assertEqual(student_response.status_code, 200)
        self.assertEqual(
            self._as_utc(student_response.get_json()["project"]["deadline"]),
            expected,
        )

    @staticmethod
    def _as_utc(value):
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)

    def test_student_cannot_update_deadline(self):
        self.login(self.student_id)
        response = self.request(
            "put",
            f"/api/instructor/projects/{self.project_id}",
            {"deadline": "2027-01-01T10:00:00+00:00"},
        )
        self.assertEqual(response.status_code, 403)
