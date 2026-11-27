import unittest
from datetime import datetime, timedelta, timezone


class StudentRuntimeRulesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from app import create_app
        from app.extensions import db
        from app.models.student_dashboard import (
            Course,
            CourseEnrollment,
            Project,
            Team,
            TeamMember,
        )
        from app.models.user import User

        cls.db = db
        cls.TeamMember = TeamMember
        cls.User = User
        cls.app = create_app()
        cls.app.config["TESTING"] = True

        with cls.app.app_context():
            db.create_all()
            deadline = datetime.now(timezone.utc) + timedelta(days=2)
            instructor = User(
                id=900,
                first_name="Runtime",
                last_name="Instructor",
                email="runtime-instructor@example.com",
                password_hash="hash",
                role="instructor",
            )
            alice = User(
                id=901,
                first_name="Runtime",
                last_name="Alice",
                email="runtime-alice@example.com",
                password_hash="hash",
                role="student",
                student_id="9001",
                major="Computer Science",
                domain="Engineering",
                joined_year=2024,
            )
            bob = User(
                id=902,
                first_name="Runtime",
                last_name="Bob",
                email="runtime-bob@example.com",
                password_hash="hash",
                role="student",
                student_id="9002",
            )
            carol = User(
                id=903,
                first_name="Runtime",
                last_name="Carol",
                email="runtime-carol@example.com",
                password_hash="hash",
                role="student",
                student_id="9003",
            )
            db.session.add_all([instructor, alice, bob, carol])
            db.session.flush()

            course = Course(
                id=900,
                instructor_id=instructor.id,
                name="Runtime Rules",
                academic_year="2026",
                semester="fall",
            )
            db.session.add(course)
            db.session.flush()
            old_project = Project(
                id=899,
                course_id=course.id,
                title="Old Project",
                description="Old project",
                min_members_per_team=1,
                max_members_per_team=4,
                deadline=deadline,
                prd="",
            )
            current_project = Project(
                id=900,
                course_id=course.id,
                title="Current Project",
                description="Current project",
                min_members_per_team=1,
                max_members_per_team=4,
                deadline=deadline,
                prd="",
            )
            full_course = Course(
                id=901,
                instructor_id=instructor.id,
                name="Full Team Rules",
                academic_year="2026",
                semester="fall",
            )
            db.session.add(full_course)
            db.session.flush()
            full_project = Project(
                id=902,
                course_id=full_course.id,
                title="Full Project",
                description="Full project",
                min_members_per_team=1,
                max_members_per_team=1,
                deadline=deadline,
                prd="",
            )
            db.session.add_all([old_project, current_project, full_project])
            db.session.flush()
            db.session.add_all([
                CourseEnrollment(student_id=student.id, course_id=course.id)
                for student in (alice, bob, carol)
            ])
            db.session.add(
                CourseEnrollment(student_id=alice.id, course_id=full_course.id)
            )
            old_team = Team(
                id=899,
                project_id=old_project.id,
                name="Old Team",
                leader_id=carol.id,
                status="active",
            )
            current_team = Team(
                id=900,
                project_id=current_project.id,
                name="Current Team",
                leader_id=alice.id,
                status="active",
            )
            target_team = Team(
                id=901,
                project_id=current_project.id,
                name="Target Team",
                leader_id=bob.id,
                status="active",
            )
            full_team = Team(
                id=903,
                project_id=full_project.id,
                name="Full Team",
                leader_id=bob.id,
                status="active",
            )
            db.session.add_all([old_team, current_team, target_team, full_team])
            db.session.flush()
            db.session.add_all([
                TeamMember(team_id=old_team.id, student_id=carol.id),
                TeamMember(team_id=old_team.id, student_id=alice.id),
                TeamMember(team_id=current_team.id, student_id=alice.id),
                TeamMember(team_id=target_team.id, student_id=bob.id),
                TeamMember(team_id=full_team.id, student_id=bob.id),
            ])
            db.session.commit()

        cls.alice_id = 901

    def setUp(self):
        self.client = self.app.test_client()

    def authenticate(self, user_id):
        with self.client.session_transaction() as session:
            session["user_id"] = user_id
            session["_csrf_token"] = "test-csrf-token"
        return {"X-CSRF-Token": "test-csrf-token"}

    def test_academic_fields_are_read_only_for_students(self):
        headers = self.authenticate(self.alice_id)
        response = self.client.put(
            "/api/me",
            json={"major": "Changed", "domain": "Changed", "joined_year": 1999},
            headers=headers,
        )
        self.assertEqual(response.status_code, 403)
        with self.app.app_context():
            student = self.db.session.get(self.User, self.alice_id)
            self.assertEqual(student.major, "Computer Science")
            self.assertEqual(student.domain, "Engineering")
            self.assertEqual(student.joined_year, 2024)

    def test_course_teams_default_to_selected_project(self):
        self.authenticate(self.alice_id)
        response = self.client.get("/api/student/courses/900/teams")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["project"]["id"], 900)
        self.assertEqual([team["id"] for team in data["teams"]], [900, 901])

    def test_switch_team_moves_single_project_membership(self):
        headers = self.authenticate(self.alice_id)
        response = self.client.post(
            "/api/student/teams/901/switch",
            json={},
            headers=headers,
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()["switched"])
        with self.app.app_context():
            team_ids = [
                row.team_id
                for row in self.TeamMember.query.filter_by(student_id=self.alice_id).all()
            ]
            self.assertCountEqual(team_ids, [899, 901])

    def test_full_team_rejects_join(self):
        headers = self.authenticate(self.alice_id)
        response = self.client.post(
            "/api/student/teams/903/join",
            json={},
            headers=headers,
        )
        self.assertIn(response.status_code, (400, 409))
        self.assertIn("full", response.get_json()["message"].lower())


if __name__ == "__main__":
    unittest.main()
