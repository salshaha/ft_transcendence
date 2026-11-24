import os
import tempfile
import unittest
from decimal import Decimal

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("STORAGE_ROOT", tempfile.mkdtemp(prefix="ft-grading-test-"))

from sqlalchemy import BigInteger
from sqlalchemy.ext.compiler import compiles

from app import create_app
from app.extensions import db
from app.models.grade import Grade, GradeAudit
from app.models.student_dashboard import Course, CourseEnrollment, Project
from app.models.user import User


@compiles(BigInteger, "sqlite")
def _compile_big_integer_for_sqlite(_type, _compiler, **_kwargs):
    return "INTEGER"


CSRF_TOKEN = "test-csrf-token"


class GradingTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config.update(TESTING=True)
        self.context = self.app.app_context()
        self.context.push()
        db.create_all()
        self.client = self.app.test_client()
        self._seed()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.context.pop()

    def _seed(self):
        instructor = User(
            first_name="Ada", last_name="Instructor", email="ada@example.test",
            password_hash="x", role="instructor",
        )
        other_instructor = User(
            first_name="Grace", last_name="Other", email="grace@example.test",
            password_hash="x", role="instructor",
        )
        student = User(
            first_name="Alan", last_name="Student", student_id="ST-1",
            email="alan@example.test", password_hash="x", role="student",
        )
        other_student = User(
            first_name="Maya", last_name="Student", student_id="ST-2",
            email="maya@example.test", password_hash="x", role="student",
        )
        db.session.add_all([instructor, other_instructor, student, other_student])
        db.session.flush()

        course = Course(
            instructor_id=instructor.id, name="Web Development",
            academic_year="2026", semester="fall",
        )
        other_course = Course(
            instructor_id=other_instructor.id, name="Other Course",
            academic_year="2026", semester="fall",
        )
        db.session.add_all([course, other_course])
        db.session.flush()

        project = Project(
            course_id=course.id, title="Team Project",
            min_members_per_team=1, max_members_per_team=3,
            max_grade=Decimal("100"), prd="",
        )
        other_project = Project(
            course_id=other_course.id, title="Other Project",
            min_members_per_team=1, max_members_per_team=3,
            max_grade=Decimal("100"), prd="",
        )
        db.session.add_all([project, other_project])
        db.session.flush()

        db.session.add_all([
            CourseEnrollment(course_id=course.id, student_id=student.id),
            CourseEnrollment(course_id=course.id, student_id=other_student.id),
            CourseEnrollment(course_id=other_course.id, student_id=other_student.id),
        ])
        db.session.commit()

        self.instructor_id = instructor.id
        self.other_instructor_id = other_instructor.id
        self.student_id = student.id
        self.other_student_id = other_student.id
        self.course_id = course.id
        self.other_course_id = other_course.id
        self.project_id = project.id
        self.other_project_id = other_project.id

    def login(self, user_id):
        with self.client.session_transaction() as session:
            session["user_id"] = user_id
            session["_csrf_token"] = CSRF_TOKEN

    def post(self, path, payload=None):
        return self.client.post(
            path, json=payload or {}, headers={"X-CSRF-Token": CSRF_TOKEN}
        )

    def put(self, path, payload=None):
        return self.client.put(
            path, json=payload or {}, headers={"X-CSRF-Token": CSRF_TOKEN}
        )

    def create_grade(self, published=False):
        self.login(self.instructor_id)
        response = self.post("/api/instructor/grades", {
            "student_id": self.student_id,
            "project_id": self.project_id,
            "grade": 85.5,
            "feedback": "Strong implementation.",
            "published": published,
        })
        self.assertEqual(response.status_code, 200)
        return response.get_json()["grade"]

    def test_grade_lifecycle_audit_and_publishing(self):
        self.login(self.instructor_id)
        grade = self.create_grade()
        self.assertFalse(grade["published"])
        self.assertIsNone(grade["published_at"])
        self.assertEqual(grade["max_grade"], 100.0)
        self.assertEqual(grade["student_name"], "Alan Student")

        list_response = self.client.get(f"/api/instructor/grades?course_id={self.course_id}")
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.get_json()["grades"]), 1)

        history_response = self.client.get(f"/api/instructor/grades/{grade['id']}/audit")
        self.assertEqual(history_response.status_code, 200)
        audits = history_response.get_json()["audits"]
        self.assertEqual(len(audits), 1)
        self.assertEqual(audits[0]["changed_by_name"], "Ada Instructor")
        self.assertIsNone(audits[0]["old_grade"])
        self.assertEqual(audits[0]["new_grade"], 85.5)

        self.login(self.student_id)
        student_response = self.client.get("/api/student/grades")
        self.assertEqual(student_response.status_code, 200)
        self.assertEqual(student_response.get_json()["grades"], [])

        self.login(self.instructor_id)
        publish_response = self.put(
            f"/api/instructor/grades/{grade['id']}/publish", {"published": True}
        )
        self.assertEqual(publish_response.status_code, 200)
        self.assertTrue(publish_response.get_json()["grade"]["published"])
        self.assertIsNotNone(publish_response.get_json()["grade"]["published_at"])

        self.login(self.student_id)
        student_response = self.client.get("/api/student/grades")
        published = student_response.get_json()["grades"]
        self.assertEqual(len(published), 1)
        self.assertEqual(published[0]["grade"], 85.5)
        self.assertEqual(published[0]["feedback"], "Strong implementation.")
        self.assertTrue(published[0]["published"])
        self.assertNotIn("audits", published[0])

        self.login(self.instructor_id)
        edit_response = self.put(f"/api/instructor/grades/{grade['id']}", {
            "grade": 90,
            "feedback": "Revised after review.",
        })
        self.assertEqual(edit_response.status_code, 200)
        updated = edit_response.get_json()["grade"]
        self.assertEqual(updated["grade"], 90.0)
        self.assertFalse(updated["published"])
        self.assertIsNone(updated["published_at"])

        history_response = self.client.get(f"/api/instructor/grades/{grade['id']}/audit")
        self.assertEqual(len(history_response.get_json()["audits"]), 2)

        self.login(self.student_id)
        self.assertEqual(self.client.get("/api/student/grades").get_json()["grades"], [])

    def test_grade_validation_and_enrollment(self):
        self.login(self.instructor_id)
        response = self.post("/api/instructor/grades", {
            "student_id": self.student_id,
            "project_id": self.project_id,
            "grade": 120,
            "feedback": "Too high",
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn("grade must be between", response.get_json()["message"])

        response = self.post("/api/instructor/grades", {
            "student_id": self.other_student_id,
            "project_id": self.other_project_id,
            "grade": 80,
        })
        self.assertEqual(response.status_code, 404)

        response = self.post("/api/instructor/grades", {
            "student_id": self.student_id,
            "project_id": self.project_id,
            "grade": -1,
        })
        self.assertEqual(response.status_code, 400)

        self.assertEqual(Grade.query.count(), 0)
        self.assertEqual(GradeAudit.query.count(), 0)

    def test_permissions_are_enforced(self):
        grade = self.create_grade(published=True)

        self.login(self.other_instructor_id)
        self.assertEqual(
            self.client.get(f"/api/instructor/grades?course_id={self.course_id}").status_code,
            404,
        )
        self.assertEqual(
            self.client.get(f"/api/instructor/grades/{grade['id']}/audit").status_code,
            404,
        )
        self.assertEqual(
            self.put(
                f"/api/instructor/grades/{grade['id']}/publish", {"published": False}
            ).status_code,
            404,
        )

        self.login(self.student_id)
        self.assertEqual(
            self.post("/api/instructor/grades", {
                "student_id": self.student_id,
                "project_id": self.project_id,
                "grade": 99,
            }).status_code,
            403,
        )

    def test_student_only_sees_own_published_grades(self):
        self.create_grade(published=True)
        self.login(self.instructor_id)
        self.post("/api/instructor/grades", {
            "student_id": self.other_student_id,
            "project_id": self.project_id,
            "grade": 70,
            "feedback": "Private draft.",
            "published": False,
        })

        self.login(self.student_id)
        response = self.client.get("/api/student/grades")
        grades = response.get_json()["grades"]
        self.assertEqual(len(grades), 1)
        self.assertEqual(grades[0]["feedback"], "Strong implementation.")
        self.assertTrue(all(grade["published"] for grade in grades))


if __name__ == "__main__":
    unittest.main()
