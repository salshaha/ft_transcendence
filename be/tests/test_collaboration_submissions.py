import io
import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone


TEST_DIR = tempfile.mkdtemp(prefix="ft-transcendence-collab-tests-")
os.environ.setdefault(
    "DATABASE_URL", f"sqlite:///{os.path.join(TEST_DIR, 'test.db')}"
)
os.environ.setdefault("STORAGE_ROOT", os.path.join(TEST_DIR, "uploads"))

PDF_BYTES = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n"


class CollaborationAndSubmissionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from app import create_app
        from app.extensions import db, socketio
        from app.models.student_dashboard import (
            Course,
            CourseEnrollment,
            Project,
            Task,
            Team,
            TeamMember,
        )
        from app.models.user import User
        from app.models.submission import Submission

        cls.db = db
        cls.socketio = socketio
        cls.Task = Task
        cls.Team = Team
        cls.Submission = Submission
        cls.app = create_app()
        cls.app.config.update(
            TESTING=True,
            STORAGE_MAX_PROJECT_SUBMISSION_BYTES=2048,
        )
        with cls.app.app_context():
            db.create_all()
            instructor = User(
                id=101, first_name="Instructor", last_name="One",
                email="instructor101@example.com", password_hash="hash",
                role="instructor",
            )
            alice = User(
                id=102, first_name="Alice", last_name="Two",
                email="alice102@example.com", password_hash="hash",
                role="student", student_id="2001",
            )
            bob = User(
                id=103, first_name="Bob", last_name="Three",
                email="bob103@example.com", password_hash="hash",
                role="student", student_id="2002",
            )
            carol = User(
                id=104, first_name="Carol", last_name="Four",
                email="carol104@example.com", password_hash="hash",
                role="student", student_id="2003",
            )
            db.session.add_all([instructor, alice, bob, carol])
            db.session.flush()

            course = Course(
                id=101, instructor_id=instructor.id, name="Collaboration",
                academic_year="2026", semester="fall",
            )
            db.session.add(course)
            db.session.flush()
            for student in (alice, bob, carol):
                db.session.add(
                    CourseEnrollment(student_id=student.id, course_id=course.id)
                )

            future_project = Project(
                id=101, course_id=course.id, title="Team App",
                min_members_per_team=2, max_members_per_team=4,
                deadline=datetime.now(timezone.utc) + timedelta(days=7),
                prd="",
            )
            past_project = Project(
                id=102, course_id=course.id, title="Late App",
                min_members_per_team=1, max_members_per_team=4,
                deadline=datetime.now(timezone.utc) - timedelta(days=1),
                prd="",
            )
            db.session.add_all([future_project, past_project])
            db.session.flush()

            team_a = Team(
                id=101, project_id=future_project.id,
                name="Team A", leader_id=alice.id, status="active",
            )
            team_b = Team(
                id=102, project_id=future_project.id,
                name="Team B", leader_id=carol.id, status="active",
            )
            late_team = Team(
                id=103, project_id=past_project.id,
                name="Late Team", leader_id=alice.id, status="active",
            )
            db.session.add_all([team_a, team_b, late_team])
            db.session.flush()
            for team_id, student_ids in (
                (101, [alice.id, bob.id]),
                (102, [carol.id]),
                (103, [alice.id, bob.id]),
            ):
                for student_id in student_ids:
                    db.session.add(
                        TeamMember(team_id=team_id, student_id=student_id)
                    )
            db.session.commit()

            cls.alice_id = alice.id
            cls.bob_id = bob.id
            cls.carol_id = carol.id
            cls.course_id = course.id
            cls.project_id = future_project.id
            cls.team_a_id = team_a.id
            cls.team_b_id = team_b.id
            cls.late_team_id = late_team.id

    def setUp(self):
        self.alice = self.app.test_client()
        self.bob = self.app.test_client()
        self.carol = self.app.test_client()
        self.alice_headers = self.authenticate(self.alice, self.alice_id)
        self.bob_headers = self.authenticate(self.bob, self.bob_id)
        self.carol_headers = self.authenticate(self.carol, self.carol_id)

    @staticmethod
    def authenticate(client, user_id):
        with client.session_transaction() as session:
            session["user_id"] = user_id
            session["_csrf_token"] = "csrf-token"
        return {"X-CSRF-Token": "csrf-token"}

    @staticmethod
    def names(received):
        return [item["name"] for item in received]

    def create_task(self, team_id, title="Collaboration task"):
        response = self.alice.post(
            "/api/tasks",
            json={
                "team_id": team_id,
                "title": title,
                "description": "Build the feature",
                "assignee_id": self.alice_id,
                "status": "todo",
                "due_date": "2026-12-01T10:00:00Z",
            },
            headers=self.alice_headers,
        )
        self.assertEqual(response.status_code, 201, response.get_data(as_text=True))
        return response.get_json()

    def cleanup_task(self, task_id):
        self.alice.delete(f"/api/tasks/{task_id}", headers=self.alice_headers)

    def test_kanban_task_list_status_persistence_and_authorization(self):
        task = self.create_task(self.team_a_id)
        try:
            listed = self.alice.get(
                f"/api/tasks?team_id={self.team_a_id}", headers=self.alice_headers
            )
            self.assertEqual(listed.status_code, 200)
            self.assertTrue(any(item["id"] == task["id"] for item in listed.get_json()))

            updated = self.alice.put(
                f"/api/tasks/{task['id']}",
                json={"status": "in_progress"},
                headers=self.alice_headers,
            )
            self.assertEqual(updated.status_code, 200)
            self.assertEqual(updated.get_json()["status"], "in_progress")

            with self.app.app_context():
                stored = self.db.session.get(self.Task, task["id"])
                self.assertEqual(stored.status, "in_progress")

            forbidden = self.carol.get(
                f"/api/tasks?team_id={self.team_a_id}", headers=self.carol_headers
            )
            self.assertEqual(forbidden.status_code, 403)

            invalid = self.alice.put(
                f"/api/tasks/{task['id']}",
                json={"status": "unknown"},
                headers=self.alice_headers,
            )
            self.assertEqual(invalid.status_code, 400)

            other_team = self.alice.post(
                "/api/tasks",
                json={"team_id": self.team_b_id, "title": "Not allowed"},
                headers=self.alice_headers,
            )
            self.assertEqual(other_team.status_code, 403)
        finally:
            self.cleanup_task(task["id"])

    def test_websocket_task_comment_events_and_team_isolation(self):
        alice_socket = self.socketio.test_client(self.app, flask_test_client=self.alice)
        carol_socket = self.socketio.test_client(self.app, flask_test_client=self.carol)
        self.assertTrue(alice_socket.is_connected())
        self.assertTrue(carol_socket.is_connected())
        try:
            alice_socket.emit("join_team", {"team_id": self.team_a_id})
            carol_socket.emit("join_team", {"team_id": self.team_b_id})
            self.assertIn("team_joined", self.names(alice_socket.get_received()))
            self.assertIn("team_joined", self.names(carol_socket.get_received()))

            carol_socket.emit("join_team", {"team_id": self.team_a_id})
            self.assertIn("realtime_error", self.names(carol_socket.get_received()))

            task = self.create_task(self.team_a_id, "Realtime task")
            try:
                alice_events = self.names(alice_socket.get_received())
                self.assertIn("task_created", alice_events)
                self.assertNotIn("task_created", self.names(carol_socket.get_received()))

                self.alice.put(
                    f"/api/tasks/{task['id']}",
                    json={"status": "review", "assignee_id": self.bob_id},
                    headers=self.alice_headers,
                )
                alice_events = self.names(alice_socket.get_received())
                self.assertIn("task_updated", alice_events)
                self.assertIn("task_status_changed", alice_events)
                self.assertIn("task_assigned", alice_events)
                self.assertEqual(
                    [], self.names(carol_socket.get_received())
                )

                comment = self.alice.post(
                    f"/api/tasks/{task['id']}/comments",
                    json={"body": "Hello team"},
                    headers=self.alice_headers,
                )
                self.assertEqual(comment.status_code, 201)
                comment_id = comment.get_json()["comment"]["id"]
                self.assertIn(
                    "comment_created", self.names(alice_socket.get_received())
                )
                self.assertEqual(
                    [], self.names(carol_socket.get_received())
                )

                edited = self.alice.put(
                    f"/api/comments/{comment_id}",
                    json={"body": "Edited comment"},
                    headers=self.alice_headers,
                )
                self.assertEqual(edited.status_code, 200)
                self.assertIn(
                    "comment_updated", self.names(alice_socket.get_received())
                )

                removed = self.alice.delete(
                    f"/api/comments/{comment_id}", headers=self.alice_headers
                )
                self.assertEqual(removed.status_code, 200)
                self.assertIn(
                    "comment_deleted", self.names(alice_socket.get_received())
                )
                self.assertEqual(
                    [], self.names(carol_socket.get_received())
                )
            finally:
                self.cleanup_task(task["id"])
                self.assertIn(
                    "task_deleted", self.names(alice_socket.get_received())
                )
        finally:
            alice_socket.disconnect()
            carol_socket.disconnect()

    def test_submission_deadline_validation_status_and_access(self):
        response = self.bob.post(
            f"/api/student/teams/{self.team_a_id}/submission",
            data={"file": (io.BytesIO(PDF_BYTES), "project.pdf", "application/pdf")},
            content_type="multipart/form-data",
            headers=self.bob_headers,
        )
        self.assertEqual(response.status_code, 201, response.get_data(as_text=True))
        submission = response.get_json()["submission"]
        self.assertEqual(submission["status"], "on_time")
        self.assertTrue(submission["on_time"])
        self.assertEqual(submission["file"]["original_name"], "project.pdf")
        self.assertIsNotNone(submission["submitted_at"])
        self.assertIsNotNone(submission["deadline"])

        teammate_view = self.alice.get(
            f"/api/student/teams/{self.team_a_id}/submission",
            headers=self.alice_headers,
        )
        self.assertEqual(teammate_view.status_code, 200)
        self.assertEqual(
            teammate_view.get_json()["submission"]["file"]["sha256"],
            submission["file"]["sha256"],
        )

        download = self.alice.get(
            f"/api/student/teams/{self.team_a_id}/submission/file",
            headers=self.alice_headers,
        )
        self.assertEqual(download.status_code, 200)
        self.assertEqual(download.data, PDF_BYTES)

        outsider_view = self.carol.get(
            f"/api/student/teams/{self.team_a_id}/submission",
            headers=self.carol_headers,
        )
        self.assertEqual(outsider_view.status_code, 403)
        outsider_download = self.carol.get(
            f"/api/student/teams/{self.team_a_id}/submission/file",
            headers=self.carol_headers,
        )
        self.assertEqual(outsider_download.status_code, 403)

        invalid_type = self.alice.post(
            f"/api/student/teams/{self.team_a_id}/submission",
            data={"file": (io.BytesIO(PDF_BYTES), "virus.exe", "application/pdf")},
            content_type="multipart/form-data",
            headers=self.alice_headers,
        )
        self.assertEqual(invalid_type.status_code, 400)
        self.assertIn("Unsupported file type", invalid_type.get_json()["message"])

        invalid_content = self.alice.post(
            f"/api/student/teams/{self.team_a_id}/submission",
            data={"file": (io.BytesIO(b"just text"), "fake.pdf", "application/pdf")},
            content_type="multipart/form-data",
            headers=self.alice_headers,
        )
        self.assertEqual(invalid_content.status_code, 400)
        self.assertIn("contents do not match", invalid_content.get_json()["message"])

        oversized = self.alice.post(
            f"/api/student/teams/{self.team_a_id}/submission",
            data={
                "file": (
                    io.BytesIO(PDF_BYTES + b"x" * 4096),
                    "large.pdf",
                    "application/pdf",
                )
            },
            content_type="multipart/form-data",
            headers=self.alice_headers,
        )
        self.assertEqual(oversized.status_code, 400)
        self.assertIn("exceeds", oversized.get_json()["message"])

        replacement = self.alice.post(
            f"/api/student/teams/{self.team_a_id}/submission",
            data={
                "file": (
                    io.BytesIO(PDF_BYTES + b"% comment updated\n"),
                    "final.pdf",
                    "application/pdf",
                )
            },
            content_type="multipart/form-data",
            headers=self.alice_headers,
        )
        self.assertEqual(replacement.status_code, 201)
        self.assertEqual(
            replacement.get_json()["submission"]["file"]["original_name"],
            "final.pdf",
        )
        with self.app.app_context():
            rows = self.Submission.query.filter_by(team_id=self.team_a_id).count()
            self.assertEqual(rows, 1)

        late = self.alice.post(
            f"/api/student/teams/{self.late_team_id}/submission",
            data={"file": (io.BytesIO(PDF_BYTES), "late.pdf", "application/pdf")},
            content_type="multipart/form-data",
            headers=self.alice_headers,
        )
        self.assertEqual(late.status_code, 400)
        self.assertIn("deadline has passed", late.get_json()["message"])
        with self.app.app_context():
            self.assertIsNone(
                self.Submission.query.filter_by(team_id=self.late_team_id).first()
            )

        rules = self.bob.get(
            f"/api/student/courses/{self.course_id}/teams",
            headers=self.bob_headers,
        )
        self.assertEqual(rules.status_code, 200)
        project = rules.get_json()["project"]
        self.assertEqual(
            project["submission_file_rules"]["max_size_bytes"], 2048
        )
        self.assertIn("pdf", project["submission_file_rules"]["accepted_extensions"])


if __name__ == "__main__":
    unittest.main()
