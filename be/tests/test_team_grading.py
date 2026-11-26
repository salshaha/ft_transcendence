import os
import tempfile
import unittest

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("STORAGE_ROOT", tempfile.mkdtemp(prefix="ft-team-grading-test-"))

from sqlalchemy import BigInteger
from sqlalchemy.ext.compiler import compiles

from app import create_app
from app.extensions import db
from app.models.grade import Grade, GradeAudit
from app.models.student_dashboard import (
    Course, CourseEnrollment, Project, Team, TeamMember,
)
from app.models.user import User


@compiles(BigInteger, "sqlite")
def _compile_big_integer_for_sqlite(_type, _compiler, **_kwargs):
    return "INTEGER"


CSRF_TOKEN = "test-csrf-token"


class TeamGradingTests(unittest.TestCase):
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
        students = [
            User(first_name=name, last_name="Student", student_id=f"ST-{index}",
                 email=f"student{index}@example.test", password_hash="x",
                 role="student")
            for index, name in enumerate(["Alan", "Maya", "Noah", "Iris", "Elena"], start=1)
        ]
        db.session.add_all([instructor, other_instructor, *students])
        db.session.flush()

        self.course = Course(
            instructor_id=instructor.id, name="Web Development",
            academic_year="2026", semester="fall",
        )
        self.other_course = Course(
            instructor_id=other_instructor.id, name="Other Course",
            academic_year="2026", semester="fall",
        )
        db.session.add_all([self.course, self.other_course])
        db.session.flush()

        self.project = Project(
            course_id=self.course.id, title="Team Project",
            min_members_per_team=1, max_members_per_team=3, prd="",
        )
        self.other_project = Project(
            course_id=self.other_course.id, title="Other Project",
            min_members_per_team=1, max_members_per_team=3, prd="",
        )
        db.session.add_all([self.project, self.other_project])
        db.session.flush()

        self.team = Team(
            project_id=self.project.id, name="Team Alpha",
            leader_id=students[0].id, status="active",
        )
        self.other_team = Team(
            project_id=self.project.id, name="Team Beta",
            leader_id=students[2].id, status="active",
        )
        self.foreign_team = Team(
            project_id=self.other_project.id, name="Foreign Team",
            leader_id=students[3].id, status="active",
        )
        db.session.add_all([self.team, self.other_team, self.foreign_team])
        db.session.flush()
        db.session.add_all([
            TeamMember(team_id=self.team.id, student_id=students[0].id),
            TeamMember(team_id=self.team.id, student_id=students[1].id),
            TeamMember(team_id=self.other_team.id, student_id=students[2].id),
            TeamMember(team_id=self.other_team.id, student_id=students[4].id),
            TeamMember(team_id=self.foreign_team.id, student_id=students[3].id),
        ])
        db.session.add_all([
            CourseEnrollment(course_id=self.course.id, student_id=student.id)
            for student in [*students[:3], students[4]]
        ])
        db.session.add(
            CourseEnrollment(course_id=self.other_course.id, student_id=students[3].id)
        )
        db.session.commit()

        self.instructor_id = instructor.id
        self.other_instructor_id = other_instructor.id
        self.student_ids = [student.id for student in students]
        self.course_id = self.course.id
        self.other_course_id = self.other_course.id
        self.project_id = self.project.id
        self.other_project_id = self.other_project.id
        self.team_id = self.team.id
        self.other_team_id = self.other_team.id
        self.foreign_team_id = self.foreign_team.id

    def login(self, user_id):
        with self.client.session_transaction() as session:
            session["user_id"] = user_id
            session["_csrf_token"] = CSRF_TOKEN

    def request(self, method, path, payload=None):
        return getattr(self.client, method)(
            path, json=payload or {}, headers={"X-CSRF-Token": CSRF_TOKEN}
        )

    def save_grade(self, student_id, grade, feedback, team_id=None, project_id=None):
        return self.request("post", "/api/instructor/grades", {
            "student_id": student_id,
            "project_id": project_id or self.project_id,
            "team_id": team_id,
            "grade": grade,
            "feedback": feedback,
        })

    def test_kanban_exposes_team_members_and_their_individual_grades(self):
        self.login(self.instructor_id)
        self.assertEqual(
            self.save_grade(self.student_ids[0], 88, "Strong work", self.team_id).status_code,
            200,
        )
        response = self.client.get(
            f"/api/instructor/teams/{self.team_id}/kanban?project_id={self.project_id}"
        )
        self.assertEqual(response.status_code, 200)
        board = response.get_json()
        self.assertEqual(
            [member["full_name"] for member in board["team"]["members"]],
            ["Alan Student", "Maya Student"],
        )
        self.assertEqual(len(board["grades"]), 1)
        self.assertEqual(board["grades"][0]["student_id"], self.student_ids[0])
        self.assertEqual(board["grades"][0]["student_name"], "Alan Student")
        self.assertEqual(board["project"]["max_grade"], 100.0)

    def test_each_team_member_has_individual_grade_feedback_and_audit(self):
        self.login(self.instructor_id)
        first = self.save_grade(self.student_ids[0], 88, "Strong work", self.team_id).get_json()["grade"]
        second = self.save_grade(self.student_ids[1], 73, "Needs more testing", self.team_id).get_json()["grade"]

        self.assertEqual(first["student_id"], self.student_ids[0])
        self.assertEqual(second["student_id"], self.student_ids[1])
        self.assertEqual(first["feedback"], "Strong work")
        self.assertEqual(second["feedback"], "Needs more testing")
        self.assertEqual(Grade.query.count(), 2)
        self.assertEqual(GradeAudit.query.count(), 2)

        edited = self.request("put", f"/api/instructor/grades/{second['id']}", {
            "grade": 80, "feedback": "Improved after review",
        })
        self.assertEqual(edited.status_code, 200)
        self.assertEqual(edited.get_json()["grade"]["grade"], 80.0)
        self.assertFalse(edited.get_json()["grade"]["published"])

        history = self.client.get(f"/api/instructor/grades/{second['id']}/audit")
        self.assertEqual(len(history.get_json()["audits"]), 2)
        self.assertEqual(
            history.get_json()["audits"][0]["changed_by_name"], "Ada Instructor"
        )
        self.assertEqual(db.session.get(Grade,first["id"]).grade, 88)

    def test_cannot_grade_students_outside_selected_team_or_project(self):
        self.login(self.instructor_id)
        response = self.save_grade(
            self.student_ids[2], 90, "Wrong team", self.team_id
        )
        self.assertEqual(response.status_code, 404)
        response = self.save_grade(
            self.student_ids[3], 90, "Foreign project", self.foreign_team_id,
            project_id=self.project_id,
        )
        self.assertEqual(response.status_code, 404)
        self.assertEqual(Grade.query.count(), 0)
        self.assertEqual(GradeAudit.query.count(), 0)

        self.login(self.other_instructor_id)
        response = self.save_grade(
            self.student_ids[0], 90, "Foreign instructor", self.team_id
        )
        self.assertEqual(response.status_code, 404)

    def test_publish_all_is_limited_to_selected_team_and_skips_empty_grades(self):
        self.login(self.instructor_id)
        first = self.save_grade(self.student_ids[0], 88, "Alpha one", self.team_id).get_json()["grade"]
        second = self.save_grade(self.student_ids[1], 73, "Alpha two", self.team_id).get_json()["grade"]
        draft = self.save_grade(self.student_ids[4], None, "Draft only", self.other_team_id)
        self.assertEqual(draft.status_code, 200)
        beta = self.save_grade(self.student_ids[2], 95, "Beta", self.other_team_id).get_json()["grade"]

        self.login(self.other_instructor_id)
        foreign = self.save_grade(
            self.student_ids[3], 60, "Foreign", self.foreign_team_id,
            project_id=self.other_project_id,
        ).get_json()["grade"]

        self.login(self.instructor_id)
        response = self.request("post", "/api/instructor/grades/publish-all", {
            "course_id": self.course_id,
            "project_id": self.project_id,
            "team_id": self.team_id,
        })
        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual(body["published_count"], 2)
        self.assertEqual(body["skipped_count"], 0)
        self.assertTrue(db.session.get(Grade,first["id"]).published)
        self.assertTrue(db.session.get(Grade,second["id"]).published)
        self.assertIsNotNone(db.session.get(Grade,first["id"]).published_at)
        self.assertFalse(db.session.get(Grade,beta["id"]).published)
        self.assertFalse(db.session.get(Grade,draft.get_json()["grade"]["id"]).published)
        self.assertFalse(db.session.get(Grade,foreign["id"]).published)

        course_scope = self.request("post", "/api/instructor/grades/publish-all", {
            "course_id": self.course_id,
        })
        self.assertEqual(course_scope.status_code, 200)
        self.assertEqual(course_scope.get_json()["published_count"], 1)
        self.assertEqual(course_scope.get_json()["skipped_count"], 1)
        self.assertFalse(db.session.get(Grade,draft.get_json()["grade"]["id"]).published)
        self.assertFalse(db.session.get(Grade,foreign["id"]).published)

        self.login(self.student_ids[0])
        visible = self.client.get("/api/student/grades").get_json()["grades"]
        self.assertEqual(len(visible), 1)
        self.assertEqual(visible[0]["grade"], 88.0)
        self.assertEqual(visible[0]["feedback"], "Alpha one")

        self.login(self.student_ids[2])
        beta_visible = self.client.get("/api/student/grades").get_json()["grades"]
        self.assertEqual(len(beta_visible), 1)
        self.assertEqual(beta_visible[0]["feedback"], "Beta")

    def test_publish_all_with_course_scope_publishes_only_that_course(self):
        self.login(self.instructor_id)
        alpha = self.save_grade(self.student_ids[0], 88, "Alpha", self.team_id).get_json()["grade"]
        beta = self.save_grade(self.student_ids[2], 95, "Beta", self.other_team_id).get_json()["grade"]

        self.login(self.other_instructor_id)
        foreign = self.save_grade(
            self.student_ids[3], 60, "Foreign", self.foreign_team_id,
            project_id=self.other_project_id,
        ).get_json()["grade"]

        self.login(self.instructor_id)
        response = self.request("post", "/api/instructor/grades/publish-all", {
            "course_id": self.course_id,
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["published_count"], 2)
        self.assertTrue(db.session.get(Grade,alpha["id"]).published)
        self.assertTrue(db.session.get(Grade,beta["id"]).published)
        self.assertFalse(db.session.get(Grade,foreign["id"]).published)

    def test_invalid_grade_is_not_published_or_persisted(self):
        self.login(self.instructor_id)
        response = self.save_grade(self.student_ids[0], 120, "Too high", self.team_id)
        self.assertEqual(response.status_code, 400)
        response = self.request("post", "/api/instructor/grades/publish-all", {
            "course_id": self.course_id,
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["published_count"], 0)
        self.assertEqual(Grade.query.count(), 0)
        self.assertEqual(GradeAudit.query.count(), 0)


if __name__ == "__main__":
    unittest.main()
