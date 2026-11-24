import base64
import io
import json
import unittest

PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=="
)


class StudentFeatureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from app import create_app
        from app.extensions import db
        from app.models.skill import Skill, StudentSkill
        from app.models.student_dashboard import (
            Course,
            CourseEnrollment,
            Project,
            Team,
            TeamMember,
        )
        from app.models.student_gpa import StudentGPA
        from app.models.user import User

        cls.db = db
        cls.User = User
        cls.StudentGPA = StudentGPA
        cls.Skill = Skill
        cls.StudentSkill = StudentSkill
        cls.Course = Course
        cls.CourseEnrollment = CourseEnrollment
        cls.Project = Project
        cls.Team = Team
        cls.TeamMember = TeamMember

        cls.app = create_app()
        cls.app.config["TESTING"] = True
        with cls.app.app_context():
            db.create_all()
            instructor = User(
                id=1,
                first_name="Ivana", last_name="Instructor",
                email="instructor@example.com", password_hash="hash",
                role="instructor",
            )
            alice = User(
                id=2,
                first_name="Alice", last_name="Student",
                email="alice@example.com", password_hash="hash",
                role="student", student_id="1001", major="Computer Science",
                joined_year=2024, domain="Engineering",
            )
            bob = User(
                id=3,
                first_name="Bob", last_name="Student",
                email="bob@example.com", password_hash="hash",
                role="student", student_id="1002", major="Computer Science",
            )
            carol = User(
                id=4,
                first_name="Carol", last_name="Outsider",
                email="carol@example.com", password_hash="hash",
                role="student", student_id="1003",
            )
            db.session.add_all([instructor, alice, bob, carol])
            db.session.flush()

            db.session.add_all([
                StudentGPA(student_id=alice.id, gpa=3.8),
                StudentGPA(student_id=bob.id, gpa=3.4),
            ])
            python = Skill(id=1, name="Python", category="technical", created_by=instructor.id)
            react = Skill(id=2, name="React", category="technical", created_by=instructor.id)
            db.session.add_all([python, react])
            db.session.flush()
            db.session.add_all([
                StudentSkill(student_id=alice.id, skill_id=python.id, proficiency_level=4),
                StudentSkill(student_id=bob.id, skill_id=python.id, proficiency_level=2),
                StudentSkill(student_id=bob.id, skill_id=react.id, proficiency_level=3),
            ])

            course = Course(
                id=1,
                instructor_id=instructor.id, name="Web Engineering",
                academic_year="2026", semester="fall",
            )
            db.session.add(course)
            db.session.flush()
            db.session.add_all([
                CourseEnrollment(student_id=alice.id, course_id=course.id),
                CourseEnrollment(student_id=bob.id, course_id=course.id),
            ])
            project = Project(
                id=1,
                course_id=course.id, title="Team Platform",
                description="Build the platform", min_members_per_team=1,
                max_members_per_team=4, prd="",
            )
            db.session.add(project)
            db.session.flush()
            team = Team(
                id=1,
                project_id=project.id, name="Teal Team",
                leader_id=alice.id, status="active",
            )
            db.session.add(team)
            db.session.flush()
            db.session.add_all([
                TeamMember(team_id=team.id, student_id=alice.id),
                TeamMember(team_id=team.id, student_id=bob.id),
            ])
            db.session.commit()

            cls.instructor_id = instructor.id
            cls.alice_id = alice.id
            cls.bob_id = bob.id
            cls.carol_id = carol.id
            cls.python_id = python.id
            cls.react_id = react.id
            cls.course_id = course.id
            cls.project_id = project.id
            cls.team_id = team.id

    def setUp(self):
        self.client = self.app.test_client()
        from app.services import presence_service

        self.presence = presence_service
        self.connections = []

    def tearDown(self):
        for connection_id in self.connections:
            self.presence.unregister_connection(connection_id)

    def authenticate(self, user_id):
        with self.client.session_transaction() as session:
            session["user_id"] = user_id
            session["_csrf_token"] = "test-csrf-token"
        return {"X-CSRF-Token": "test-csrf-token"}

    def connect(self, user_id):
        connection_id = self.presence.register_connection(user_id)
        self.connections.append(connection_id)
        return connection_id

    def test_avatar_upload_replace_remove_and_access(self):
        headers = self.authenticate(self.alice_id)
        response = self.client.post(
            "/api/me/avatar",
            data={"avatar": (io.BytesIO(PNG_BYTES), "avatar.png", "image/png")},
            content_type="multipart/form-data",
            headers=headers,
        )
        self.assertEqual(response.status_code, 200)
        first_key = response.get_json()["profile_picture"]
        self.assertTrue(first_key)

        own = self.client.get(f"/api/users/{self.alice_id}/avatar")
        self.assertEqual(own.status_code, 200)
        self.assertIn("image", own.headers["Content-Type"])

        classmate = self.authenticate(self.bob_id)
        self.assertEqual(
            self.client.get(f"/api/users/{self.alice_id}/avatar").status_code, 200
        )
        self.assertEqual(classmate["X-CSRF-Token"], "test-csrf-token")

        outsider_headers = self.authenticate(self.carol_id)
        self.assertEqual(outsider_headers["X-CSRF-Token"], "test-csrf-token")
        self.assertEqual(
            self.client.get(f"/api/users/{self.alice_id}/avatar").status_code, 403
        )

        self.authenticate(self.alice_id)
        replaced = self.client.post(
            "/api/me/avatar",
            data={"avatar": (io.BytesIO(PNG_BYTES), "second.png", "image/png")},
            content_type="multipart/form-data",
            headers=headers,
        )
        self.assertEqual(replaced.status_code, 200)
        self.assertNotEqual(replaced.get_json()["profile_picture"], first_key)

        invalid = self.client.post(
            "/api/me/avatar",
            data={"avatar": (io.BytesIO(b"not an image"), "fake.png", "image/png")},
            content_type="multipart/form-data",
            headers=headers,
        )
        self.assertEqual(invalid.status_code, 400)

        removed = self.client.delete("/api/me/avatar", headers=headers)
        self.assertEqual(removed.status_code, 200)
        self.assertEqual(self.client.get(f"/api/users/{self.alice_id}/avatar").status_code, 404)

    def test_skill_crud_and_duplicate_handling(self):
        headers = self.authenticate(self.alice_id)
        created = self.client.post(
            "/api/me/skills",
            json={"skill_id": self.react_id, "proficiency_level": 2},
            headers=headers,
        )
        self.assertEqual(created.status_code, 201)
        skill_id = created.get_json()["skill"]["id"]

        duplicate = self.client.post(
            "/api/me/skills",
            json={"skill_id": self.react_id, "proficiency_level": 4},
            headers=headers,
        )
        self.assertEqual(duplicate.status_code, 201)
        self.assertEqual(duplicate.get_json()["proficiency_level"], 4)

        updated = self.client.put(
            f"/api/me/skills/{skill_id}",
            json={"proficiency_level": 1},
            headers=headers,
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.get_json()["proficiency_level"], 1)

        invalid = self.client.put(
            f"/api/me/skills/{skill_id}",
            json={"proficiency_level": 9},
            headers=headers,
        )
        self.assertEqual(invalid.status_code, 400)

        removed = self.client.delete(f"/api/me/skills/{skill_id}", headers=headers)
        self.assertEqual(removed.status_code, 200)

    def test_profile_uses_database_relationships(self):
        self.connect(self.alice_id)
        self.authenticate(self.alice_id)
        response = self.client.get("/api/student/profile")
        self.assertEqual(response.status_code, 200)
        student = response.get_json()["student"]
        self.assertEqual(student["full_name"], "Alice Student")
        self.assertEqual(student["gpa"], 3.8)
        self.assertTrue(student["is_online"])
        self.assertEqual([course["name"] for course in student["courses"]], ["Web Engineering"])
        self.assertEqual(student["current_project"]["title"], "Team Platform")
        self.assertEqual(student["team"]["name"], "Teal Team")
        self.assertEqual(len(student["team"]["members"]), 2)
        self.assertTrue(all(
            "is_online" in member and "avatar_url" in member
            for member in student["team"]["members"]
        ))

    def test_directory_search_filters_and_public_profile_privacy(self):
        self.connect(self.bob_id)
        headers = self.authenticate(self.alice_id)
        response = self.client.get(
            f"/api/students?search=Bob&skill_id={self.python_id}"
            f"&course_id={self.course_id}"
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["total"], 1)
        student = data["students"][0]
        self.assertEqual(student["id"], self.bob_id)
        self.assertTrue(student["is_online"])
        self.assertNotIn("email", student)
        self.assertNotIn("gpa", student)
        self.assertNotIn("student_id", student)

        empty = self.client.get(f"/api/students?skill_id={self.react_id}&search=Alice")
        self.assertEqual(empty.get_json()["total"], 0)

        profile = self.client.get(f"/api/students/{self.bob_id}")
        self.assertEqual(profile.status_code, 200)
        public = profile.get_json()["student"]
        self.assertEqual(public["full_name"], "Bob Student")
        self.assertNotIn("email", public)
        self.assertNotIn("gpa", public)
        self.assertEqual(public["courses"][0]["name"], "Web Engineering")
        self.assertEqual(public["current_project"]["title"], "Team Platform")

        forbidden = self.client.get(f"/api/students/{self.carol_id}")
        self.assertEqual(forbidden.status_code, 403)
        edit_attempt = self.client.put(
            f"/api/students/{self.bob_id}", json={}, headers=headers
        )
        self.assertEqual(edit_attempt.status_code, 405)

    def test_presence_status_ping_and_disconnect(self):
        headers = self.authenticate(self.alice_id)
        connection_id = self.connect(self.alice_id)
        status = self.client.get(f"/api/presence/students?ids={self.alice_id}")
        self.assertEqual(status.status_code, 200)
        self.assertTrue(
            status.get_json()["presence"][str(self.alice_id)]["online"]
        )

        ping = self.client.post(
            "/api/presence/ping",
            json={"connection_id": connection_id},
            headers=headers,
        )
        self.assertEqual(ping.status_code, 200)
        self.assertTrue(ping.get_json()["ok"])

        missing = self.client.post(
            "/api/presence/ping",
            json={"connection_id": "unknown"},
            headers=headers,
        )
        self.assertEqual(missing.status_code, 404)

        self.presence.unregister_connection(connection_id)
        self.connections.remove(connection_id)
        offline = self.client.get(f"/api/presence/students?ids={self.alice_id}")
        self.assertFalse(
            offline.get_json()["presence"][str(self.alice_id)]["online"]
        )

    def test_presence_stream_route_emits_events_and_accepts_pings(self):
        headers = self.authenticate(self.alice_id)
        response = self.client.get("/api/presence/stream", buffered=False)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.mimetype, "text/event-stream")

        chunk = next(response.response).decode("utf-8")
        self.assertIn("event: presence", chunk)
        payload = json.loads(chunk.split("data: ", 1)[1].split("\n", 1)[0])
        connection_id = payload["connection_id"]

        ping = self.client.post(
            "/api/presence/ping",
            json={"connection_id": connection_id},
            headers=headers,
        )
        self.assertEqual(ping.status_code, 200)
        self.assertTrue(ping.get_json()["ok"])
        response.close()


if __name__ == "__main__":
    unittest.main()
