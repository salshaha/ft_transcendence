import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from io import BytesIO

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("STORAGE_ROOT", tempfile.mkdtemp(prefix="ft-kanban-test-"))

from sqlalchemy import BigInteger
from sqlalchemy.ext.compiler import compiles

from app import create_app
from app.extensions import db
from app.models.student_dashboard import Course, Project, Task, Team, TeamMember
from app.models.task_collaboration import TaskAttachment, TaskComment
from app.models.user import User


@compiles(BigInteger, "sqlite")
def _compile_big_integer_for_sqlite(_type, _compiler, **_kwargs):
    return "INTEGER"


CSRF_TOKEN = "test-csrf-token"


class InstructorTeamKanbanTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.app.config.update(TESTING=True)
        cls.context = cls.app.app_context()
        cls.context.push()
        db.create_all()
        cls._seed()
        cls.client = cls.app.test_client()

    @classmethod
    def tearDownClass(cls):
        db.session.remove()
        db.drop_all()
        cls.context.pop()

    @classmethod
    def _seed(cls):
        instructor = User(
            first_name="Ada", last_name="Instructor",
            email="ada@example.test", password_hash="x", role="instructor",
        )
        other_instructor = User(
            first_name="Grace", last_name="Other",
            email="grace@example.test", password_hash="x", role="instructor",
        )
        student = User(
            first_name="Alan", last_name="Student", student_id="ST-1",
            email="alan@example.test", password_hash="x", role="student",
        )
        other_student = User(
            first_name="Grace", last_name="Student", student_id="ST-2",
            email="grace-student@example.test", password_hash="x", role="student",
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
            min_members_per_team=1, max_members_per_team=3, prd="",
        )
        other_project = Project(
            course_id=other_course.id, title="Other Project",
            min_members_per_team=1, max_members_per_team=3, prd="",
        )
        db.session.add_all([project, other_project])
        db.session.flush()

        team = Team(
            project_id=project.id, name="Team Alpha",
            leader_id=student.id, status="active",
        )
        other_team = Team(
            project_id=project.id, name="Team Beta",
            leader_id=other_student.id, status="active",
        )
        foreign_team = Team(
            project_id=other_project.id, name="Foreign Team",
            leader_id=other_student.id, status="active",
        )
        db.session.add_all([team, other_team, foreign_team])
        db.session.flush()
        db.session.add_all([
            TeamMember(team_id=team.id, student_id=student.id),
            TeamMember(team_id=other_team.id, student_id=other_student.id),
            TeamMember(team_id=foreign_team.id, student_id=other_student.id),
        ])

        now = datetime.now(timezone.utc)
        overdue = Task(
            team_id=team.id, assignee_id=student.id, created_by=student.id,
            title="Overdue task", status="todo", description="Finish the wireframes",
            due_date=now - timedelta(days=2),
        )
        in_progress = Task(
            team_id=team.id, assignee_id=student.id, created_by=student.id,
            title="Build API", status="in_progress", description="Implement endpoints",
            due_date=now + timedelta(days=3),
        )
        review = Task(
            team_id=team.id, assignee_id=None, created_by=student.id,
            title="Review docs", status="review", description="Peer review the docs",
        )
        done = Task(
            team_id=team.id, assignee_id=student.id, created_by=student.id,
            title="Setup repo", status="done", description="Create the repository",
            due_date=now - timedelta(days=5),
        )
        other_task = Task(
            team_id=other_team.id, assignee_id=other_student.id,
            created_by=other_student.id, title="Other team task", status="todo",
        )
        foreign_task = Task(
            team_id=foreign_team.id, assignee_id=other_student.id,
            created_by=other_student.id, title="Foreign task", status="todo",
        )
        db.session.add_all([overdue, in_progress, review, done, other_task, foreign_task])
        db.session.flush()

        db.session.add_all([
            TaskComment(
                task_id=overdue.id, author_id=student.id,
                body="Working on it", kind="comment",
            ),
            TaskComment(
                task_id=overdue.id, author_id=instructor.id,
                body="Please prioritize this", kind="instructor_feedback",
            ),
            TaskAttachment(
                task_id=overdue.id, uploader_id=student.id,
                file_key="task_attachment/1/mock.pdf", original_name="mock.pdf",
                content_type="application/pdf", size=128, sha256="a" * 64,
            ),
        ])
        db.session.commit()

        cls.instructor_id = instructor.id
        cls.other_instructor_id = other_instructor.id
        cls.student_id = student.id
        cls.project_id = project.id
        cls.other_project_id = other_project.id
        cls.team_id = team.id
        cls.foreign_team_id = foreign_team.id
        cls.overdue_task_id = overdue.id

    def login(self, user_id):
        with self.client.session_transaction() as session:
            session["user_id"] = user_id
            session["_csrf_token"] = CSRF_TOKEN

    def post(self, path, payload=None, data=None):
        headers = {"X-CSRF-Token": CSRF_TOKEN}
        if payload is not None:
            return self.client.post(path, json=payload, headers=headers)
        return self.client.post(path, data=data, headers=headers)

    def test_owner_sees_only_selected_team_tasks_with_counts_and_metadata(self):
        self.login(self.instructor_id)
        response = self.client.get(
            f"/api/instructor/teams/{self.team_id}/kanban?project_id={self.project_id}"
        )
        self.assertEqual(response.status_code, 200)
        body = response.get_json()

        self.assertTrue(body["read_only"])
        self.assertEqual(body["team"]["name"], "Team Alpha")
        self.assertEqual(body["team"]["members"][0]["full_name"], "Alan Student")
        self.assertEqual(body["project"]["title"], "Team Project")
        self.assertEqual(body["project"]["course"]["name"], "Web Development")
        self.assertEqual(
            body["task_counts"],
            {
                "total": 4, "todo": 1, "in_progress": 1,
                "review": 1, "done": 1, "overdue": 1,
            },
        )
        self.assertEqual(set(body["tasks_by_status"]), {"todo", "in_progress", "review", "done"})
        self.assertEqual(
            [task["title"] for task in body["tasks_by_status"]["todo"]],
            ["Overdue task"],
        )
        self.assertTrue(body["tasks_by_status"]["todo"][0]["is_overdue"])
        self.assertFalse(body["tasks_by_status"]["done"][0]["is_overdue"])
        self.assertEqual(
            body["tasks_by_status"]["todo"][0]["assignee"]["name"], "Alan Student"
        )
        self.assertEqual(body["tasks_by_status"]["todo"][0]["comment_count"], 2)
        self.assertEqual(body["tasks_by_status"]["todo"][0]["attachment_count"], 1)
        self.assertEqual(len(body["tasks_by_status"]["todo"][0]["instructor_feedback"]), 1)
        self.assertTrue(
            all(task["team_id"] == self.team_id for task in body["tasks"])
        )
        self.assertFalse(any(task["title"] == "Other team task" for task in body["tasks"]))

    def test_unauthorized_access_is_rejected(self):
        anonymous = self.app.test_client()
        response = anonymous.get(f"/api/instructor/teams/{self.team_id}/kanban")
        self.assertEqual(response.status_code, 401)

        self.login(self.student_id)
        response = self.client.get(f"/api/instructor/teams/{self.team_id}/kanban")
        self.assertEqual(response.status_code, 403)

        self.login(self.other_instructor_id)
        response = self.client.get(f"/api/instructor/teams/{self.team_id}/kanban")
        self.assertEqual(response.status_code, 404)

        self.login(self.instructor_id)
        response = self.client.get(
            f"/api/instructor/teams/{self.team_id}/kanban?project_id={self.other_project_id}"
        )
        self.assertEqual(response.status_code, 404)
        response = self.client.get(
            f"/api/instructor/teams/{self.team_id}/kanban?project_id=not-an-int"
        )
        self.assertEqual(response.status_code, 400)

    def test_instructors_cannot_modify_tasks_or_upload_attachments(self):
        self.login(self.student_id)
        created = self.post("/api/tasks", {"team_id": self.team_id, "title": "Feedback target"})
        self.assertEqual(created.status_code, 201)
        feedback_task_id = created.get_json()["id"]

        self.login(self.instructor_id)
        response = self.post("/api/tasks", {"team_id": self.team_id, "title": "New task"})
        self.assertEqual(response.status_code, 403)
        response = self.client.put(
            f"/api/tasks/{self.overdue_task_id}",
            json={"title": "Hacked"},
            headers={"X-CSRF-Token": CSRF_TOKEN},
        )
        self.assertEqual(response.status_code, 403)
        response = self.client.delete(
            f"/api/tasks/{self.overdue_task_id}",
            headers={"X-CSRF-Token": CSRF_TOKEN},
        )
        self.assertEqual(response.status_code, 403)

        response = self.post(
            f"/api/tasks/{feedback_task_id}/attachments",
            data={"file": (BytesIO(b"fake"), "note.txt", "text/plain")},
        )
        self.assertEqual(response.status_code, 403)

        response = self.post(
            f"/api/tasks/{feedback_task_id}/comments",
            {"body": "Please revise", "kind": "comment"},
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.get_json()["comment"]["kind"], "instructor_feedback")

        self.login(self.student_id)
        response = self.client.delete(
            f"/api/tasks/{feedback_task_id}",
            headers={"X-CSRF-Token": CSRF_TOKEN},
        )
        self.assertEqual(response.status_code, 200)

    def test_instructor_can_update_task_status_only(self):
        self.login(self.student_id)
        created = self.post("/api/tasks", {"team_id": self.team_id, "title": "Status target"})
        self.assertEqual(created.status_code, 201)
        task_id = created.get_json()["id"]

        self.login(self.instructor_id)
        response = self.client.put(
            f"/api/tasks/{task_id}",
            json={"status": "done"},
            headers={"X-CSRF-Token": CSRF_TOKEN},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["status"], "done")
        with self.app.app_context():
            self.assertEqual(db.session.get(Task, task_id).status, "done")

        forbidden = self.client.put(
            f"/api/tasks/{task_id}",
            json={"status": "todo", "title": "Still not allowed"},
            headers={"X-CSRF-Token": CSRF_TOKEN},
        )
        self.assertEqual(forbidden.status_code, 403)

        self.login(self.student_id)
        self.client.delete(f"/api/tasks/{task_id}", headers={"X-CSRF-Token": CSRF_TOKEN})

    def test_students_can_still_manage_their_team_tasks(self):
        self.login(self.student_id)
        response = self.post("/api/tasks", {"team_id": self.team_id, "title": "Student task"})
        self.assertEqual(response.status_code, 201)
        task_id = response.get_json()["id"]

        response = self.client.put(
            f"/api/tasks/{task_id}",
            json={"title": "Updated by student", "status": "in_progress"},
            headers={"X-CSRF-Token": CSRF_TOKEN},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["status"], "in_progress")

        response = self.client.delete(
            f"/api/tasks/{task_id}",
            headers={"X-CSRF-Token": CSRF_TOKEN},
        )
        self.assertEqual(response.status_code, 200)


if __name__ == "__main__":
    unittest.main()
