import os
import tempfile
import unittest

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("STORAGE_ROOT", tempfile.mkdtemp(prefix="ft-one-project-test-"))

from sqlalchemy import BigInteger
from sqlalchemy.ext.compiler import compiles

from app import create_app
from app.extensions import db
from app.models.student_dashboard import Course, Project, Task, Team, TeamMember
from app.models.user import User
from app.services.instructor_service import create_project


@compiles(BigInteger, "sqlite")
def _compile_big_integer_for_sqlite(_type, _compiler, **_kwargs):
    return "INTEGER"


CSRF_TOKEN = "test-csrf-token"


class OneProjectPerCourseTests(unittest.TestCase):
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
        db.session.add_all([instructor, other_instructor, student])
        db.session.flush()

        self.course = Course(
            instructor_id=instructor.id, name="Web Development",
            academic_year="2026", semester="fall",
        )
        self.empty_course = Course(
            instructor_id=instructor.id, name="Databases",
            academic_year="2026", semester="fall",
        )
        self.foreign_course = Course(
            instructor_id=other_instructor.id, name="Other Course",
            academic_year="2026", semester="fall",
        )
        db.session.add_all([self.course, self.empty_course, self.foreign_course])
        db.session.flush()

        self.project = Project(
            course_id=self.course.id, title="First project",
            min_members_per_team=1, max_members_per_team=3, prd="",
        )
        db.session.add(self.project)
        db.session.flush()
        self.team = Team(
            project_id=self.project.id, name="Team Alpha",
            leader_id=student.id, status="active",
        )
        db.session.add(self.team)
        db.session.flush()
        db.session.add(TeamMember(team_id=self.team.id, student_id=student.id))
        self.task = Task(
            team_id=self.team.id, created_by=student.id,
            title="Existing task", status="todo",
        )
        db.session.add(self.task)
        db.session.commit()

        self.instructor_id = instructor.id
        self.other_instructor_id = other_instructor.id
        self.student_id = student.id

    def login(self, user_id):
        with self.client.session_transaction() as session:
            session["user_id"] = user_id
            session["_csrf_token"] = CSRF_TOKEN

    def post_project(self, course_id):
        return self.client.post(
            f"/api/instructor/courses/{course_id}/project",
            json={"title": "Second project", "min_members_per_team": 2,
                  "max_members_per_team": 4},
            headers={"X-CSRF-Token": CSRF_TOKEN},
        )

    def test_only_first_project_is_accepted(self):
        self.login(self.instructor_id)
        response = self.post_project(self.empty_course.id)
        self.assertEqual(response.status_code, 201)

        response = self.post_project(self.course.id)
        self.assertEqual(response.status_code, 400)
        self.assertIn("already has a project", response.get_json()["message"])

        self.assertEqual(Project.query.filter_by(course_id=self.course.id).count(), 1)
        self.assertEqual(Project.query.filter_by(course_id=self.empty_course.id).count(), 1)

    def test_direct_service_call_cannot_bypass_restriction(self):
        with self.assertRaisesRegex(ValueError, "already has a project"):
            create_project(self.instructor_id, self.course.id, {"title": "API bypass"})

    def test_existing_project_records_remain_intact(self):
        self.login(self.instructor_id)
        self.assertEqual(self.post_project(self.course.id).status_code, 400)
        self.assertEqual(self.project.title, "First project")
        self.assertEqual(Team.query.filter_by(project_id=self.project.id).count(), 1)
        self.assertEqual(
            TeamMember.query.filter_by(team_id=self.team.id).count(), 1
        )
        self.assertEqual(Task.query.filter_by(team_id=self.team.id).count(), 1)

    def test_authorization_is_still_enforced(self):
        self.login(self.student_id)
        self.assertEqual(self.post_project(self.course.id).status_code, 403)

        self.login(self.other_instructor_id)
        self.assertEqual(self.post_project(self.course.id).status_code, 404)


if __name__ == "__main__":
    unittest.main()
