import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone

TEST_DIR = tempfile.mkdtemp(prefix="ft-transcendence-grades-tests-")
os.environ.setdefault(
    "DATABASE_URL", f"sqlite:///{os.path.join(TEST_DIR, 'test.db')}"
)
os.environ.setdefault("STORAGE_ROOT", os.path.join(TEST_DIR, "uploads"))


class GradesAndPeerFeedbackTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from app import create_app
        from app.extensions import db, socketio
        from app.models.grade import Grade
        from app.models.student_dashboard import (
            Course,
            CourseEnrollment,
            Project,
            Team,
            TeamMember,
        )
        from app.models.user import User

        cls.db = db
        cls.socketio = socketio
        cls.Grade = Grade
        cls.app = create_app()
        cls.app.config.update(TESTING=True)
        with cls.app.app_context():
            db.create_all()
            now = datetime.now(timezone.utc)
            instructor = User(
                id=201, first_name="Grade", last_name="Instructor",
                email="grade-instructor@example.com", password_hash="hash",
                role="instructor",
            )
            other_instructor = User(
                id=202, first_name="Other", last_name="Instructor",
                email="other-instructor@example.com", password_hash="hash",
                role="instructor",
            )
            admin = User(
                id=203, first_name="Grade", last_name="Admin",
                email="grade-admin@example.com", password_hash="hash", role="admin",
            )
            alice = User(
                id=204, first_name="Alice", last_name="Reviewer",
                email="alice-review@example.com", password_hash="hash",
                role="student", student_id="4001",
            )
            bob = User(
                id=205, first_name="Bob", last_name="Teammate",
                email="bob-review@example.com", password_hash="hash",
                role="student", student_id="4002",
            )
            carol = User(
                id=206, first_name="Carol", last_name="OtherTeam",
                email="carol-review@example.com", password_hash="hash",
                role="student", student_id="4003",
            )
            dave = User(
                id=207, first_name="Dave", last_name="OtherCourse",
                email="dave-review@example.com", password_hash="hash",
                role="student", student_id="4004",
            )
            db.session.add_all([
                instructor, other_instructor, admin, alice, bob, carol, dave,
            ])
            db.session.flush()

            course = Course(
                id=201, instructor_id=instructor.id, name="Grading Course",
                academic_year="2026", semester="fall",
            )
            other_course = Course(
                id=202, instructor_id=other_instructor.id, name="Other Course",
                academic_year="2026", semester="fall",
            )
            db.session.add_all([course, other_course])
            db.session.flush()

            active_project = Project(
                id=201, course_id=course.id, title="Active Project",
                min_members_per_team=1, max_members_per_team=3,
                deadline=now + timedelta(days=2), prd="",
            )
            ended_project = Project(
                id=202, course_id=course.id, title="Ended Project",
                min_members_per_team=1, max_members_per_team=3,
                deadline=now - timedelta(days=1), prd="",
            )
            other_project = Project(
                id=203, course_id=other_course.id, title="Other Project",
                min_members_per_team=1, max_members_per_team=3,
                deadline=now - timedelta(days=1), prd="",
            )
            db.session.add_all([active_project, ended_project, other_project])
            db.session.flush()

            for student_id in (alice.id, bob.id, carol.id):
                db.session.add(
                    CourseEnrollment(student_id=student_id, course_id=course.id)
                )
            db.session.add(
                CourseEnrollment(student_id=dave.id, course_id=other_course.id)
            )

            team_active = Team(
                id=201, project_id=active_project.id, name="Active Team",
                leader_id=alice.id, status="active",
            )
            team_ended = Team(
                id=202, project_id=ended_project.id, name="Ended Team",
                leader_id=alice.id, status="active",
            )
            team_ended_other = Team(
                id=203, project_id=ended_project.id, name="Other Ended Team",
                leader_id=carol.id, status="active",
            )
            team_other_course = Team(
                id=204, project_id=other_project.id, name="Other Course Team",
                leader_id=dave.id, status="active",
            )
            db.session.add_all([
                team_active, team_ended, team_ended_other, team_other_course,
            ])
            db.session.flush()
            for team_id, student_ids in (
                (201, [alice.id, bob.id]),
                (202, [alice.id, bob.id]),
                (203, [carol.id]),
                (204, [dave.id]),
            ):
                for student_id in student_ids:
                    db.session.add(
                        TeamMember(team_id=team_id, student_id=student_id)
                    )

            db.session.add_all([
                Grade(
                    student_id=alice.id, project_id=ended_project.id,
                    grade=18.5, feedback="Excellent work", published=True,
                    published_at=now - timedelta(hours=1),
                ),
                Grade(
                    student_id=bob.id, project_id=ended_project.id,
                    grade=12, feedback="Keep working", published=False,
                ),
                Grade(
                    student_id=carol.id, project_id=ended_project.id,
                    grade=None, feedback=None, published=False,
                ),
            ])
            db.session.commit()

            cls.instructor_id = instructor.id
            cls.other_instructor_id = other_instructor.id
            cls.admin_id = admin.id
            cls.alice_id = alice.id
            cls.bob_id = bob.id
            cls.carol_id = carol.id
            cls.dave_id = dave.id
            cls.active_project_id = active_project.id
            cls.ended_project_id = ended_project.id
            cls.other_project_id = other_project.id

    def setUp(self):
        self.instructor = self.app.test_client()
        self.other_instructor = self.app.test_client()
        self.admin = self.app.test_client()
        self.alice = self.app.test_client()
        self.bob = self.app.test_client()
        self.carol = self.app.test_client()
        self.dave = self.app.test_client()
        self.instructor_headers = self.authenticate(self.instructor, self.instructor_id)
        self.other_instructor_headers = self.authenticate(
            self.other_instructor, self.other_instructor_id
        )
        self.admin_headers = self.authenticate(self.admin, self.admin_id)
        self.alice_headers = self.authenticate(self.alice, self.alice_id)
        self.bob_headers = self.authenticate(self.bob, self.bob_id)
        self.carol_headers = self.authenticate(self.carol, self.carol_id)
        self.dave_headers = self.authenticate(self.dave, self.dave_id)

    @staticmethod
    def authenticate(client, user_id):
        with client.session_transaction() as session:
            session["user_id"] = user_id
            session["_csrf_token"] = "grades-csrf"
        return {"X-CSRF-Token": "grades-csrf"}

    def names(self, received):
        return [item["name"] for item in received]

    def feedback_id_for(self, from_id, to_id, project_id=None):
        from app.models.peer_feedback import PeerFeedback

        with self.app.app_context():
            query = PeerFeedback.query.filter_by(
                from_student_id=from_id, to_student_id=to_id
            )
            if project_id is not None:
                query = query.filter_by(project_id=project_id)
            item = query.first()
            return item.id if item else None

    def submit(
        self,
        client,
        headers,
        project_id,
        to_student_id,
        rating=5,
        feedback="Strong contributor",
        criteria=None,
    ):
        payload = {
            "project_id": project_id,
            "to_student_id": to_student_id,
            "rating": rating,
            "feedback": feedback,
        }
        if criteria is not None:
            payload["criteria"] = criteria
        return client.post(
            "/api/student/peer-feedback",
            json=payload,
            headers=headers,
        )

    def test_student_published_grades_and_instructor_scope(self):
        own = self.alice.get("/api/student/grades")
        self.assertEqual(own.status_code, 200)
        grades = own.get_json()["grades"]
        self.assertEqual(len(grades), 1)
        grade = grades[0]
        self.assertEqual(grade["project_id"], self.ended_project_id)
        self.assertEqual(grade["grade"], 18.5)
        self.assertEqual(grade["feedback"], "Excellent work")
        self.assertTrue(grade["published"])
        self.assertTrue(grade["published_at"])
        self.assertEqual(grade["course_title"], "Grading Course")
        self.assertEqual(grade["status"], "Published")

        courses = own.get_json()["courses"]
        self.assertEqual(len(courses), 1)
        self.assertEqual(courses[0]["name"], "Grading Course")
        self.assertEqual(courses[0]["course_grade"], 18.5)
        self.assertFalse(courses[0]["final_grade_available"])
        self.assertEqual(len(courses[0]["grades"]), 1)

        hidden = self.bob.get("/api/student/grades")
        self.assertEqual(hidden.status_code, 200)
        hidden_grades = hidden.get_json()["grades"]
        self.assertEqual(len(hidden_grades), 1)
        self.assertFalse(hidden_grades[0]["published"])
        self.assertEqual(hidden_grades[0]["status"], "Not Published Yet")
        self.assertIsNone(hidden_grades[0]["grade"])
        self.assertIsNone(hidden_grades[0]["feedback"])
        self.assertIsNone(hidden_grades[0]["published_at"])

        instructor_view = self.instructor.get(
            f"/api/instructor/students/{self.bob_id}"
        )
        self.assertEqual(instructor_view.status_code, 200)
        bob_grade = next(
            item for item in instructor_view.get_json()["student"]["grades"]
            if item["project_id"] == self.ended_project_id
        )
        self.assertFalse(bob_grade["published"])

        unauthorized_view = self.other_instructor.get(
            f"/api/instructor/students/{self.alice_id}"
        )
        self.assertEqual(unauthorized_view.status_code, 404)

        publish = self.instructor.post(
            "/api/instructor/grades",
            json={
                "student_id": self.bob_id,
                "project_id": self.ended_project_id,
                "grade": 14,
                "feedback": "Published now",
                "published": True,
            },
            headers=self.instructor_headers,
        )
        self.assertEqual(publish.status_code, 200)
        self.assertTrue(publish.get_json()["grade"]["published_at"])

        now_visible = self.bob.get("/api/student/grades")
        self.assertEqual(len(now_visible.get_json()["grades"]), 1)
        self.assertEqual(now_visible.get_json()["grades"][0]["grade"], 14)

        bad_project = self.other_instructor.post(
            "/api/instructor/grades",
            json={
                "student_id": self.alice_id,
                "project_id": self.ended_project_id,
                "grade": 20,
                "published": True,
            },
            headers=self.other_instructor_headers,
        )
        self.assertEqual(bad_project.status_code, 404)

        bad_student = self.instructor.post(
            "/api/instructor/grades",
            json={
                "student_id": self.dave_id,
                "project_id": self.ended_project_id,
                "grade": 20,
                "published": True,
            },
            headers=self.instructor_headers,
        )
        self.assertEqual(bad_student.status_code, 404)

    def test_grade_publication_event_reaches_only_that_student(self):
        carol_socket = self.socketio.test_client(self.app, flask_test_client=self.carol)
        alice_socket = self.socketio.test_client(self.app, flask_test_client=self.alice)
        self.assertTrue(carol_socket.is_connected())
        self.assertTrue(alice_socket.is_connected())
        try:
            response = self.instructor.post(
                "/api/instructor/grades",
                json={
                    "student_id": self.carol_id,
                    "project_id": self.ended_project_id,
                    "grade": 16,
                    "feedback": "Published live",
                    "published": True,
                },
                headers=self.instructor_headers,
            )
            self.assertEqual(response.status_code, 200)
            events = self.names(carol_socket.get_received())
            self.assertIn("grade_published", events)
            self.assertNotIn("grade_published", self.names(alice_socket.get_received()))
        finally:
            carol_socket.disconnect()
            alice_socket.disconnect()

    def test_peer_feedback_submission_rules_and_database_state(self):
        from app.models.peer_feedback import PeerFeedback

        too_early = self.submit(
            self.alice, self.alice_headers, self.active_project_id, self.bob_id
        )
        self.assertEqual(too_early.status_code, 403)

        self_feedback = self.submit(
            self.alice, self.alice_headers, self.ended_project_id, self.alice_id
        )
        self.assertEqual(self_feedback.status_code, 400)

        other_team = self.submit(
            self.alice, self.alice_headers, self.ended_project_id, self.carol_id
        )
        self.assertEqual(other_team.status_code, 403)

        unrelated = self.submit(
            self.alice, self.alice_headers, self.ended_project_id, self.dave_id
        )
        self.assertEqual(unrelated.status_code, 404)

        no_project_team = self.submit(
            self.dave, self.dave_headers, self.ended_project_id, self.alice_id
        )
        self.assertEqual(no_project_team.status_code, 403)

        bad_rating = self.submit(
            self.alice, self.alice_headers, self.ended_project_id, self.bob_id,
            rating=6,
        )
        self.assertEqual(bad_rating.status_code, 400)

        missing_feedback = self.submit(
            self.alice, self.alice_headers, self.ended_project_id, self.bob_id,
            feedback="   ",
        )
        self.assertEqual(missing_feedback.status_code, 400)

        created = self.submit(
            self.alice, self.alice_headers, self.ended_project_id, self.bob_id
        )
        self.assertEqual(created.status_code, 201)
        feedback_id = created.get_json()["peer_feedback"]["id"]
        self.assertTrue(created.get_json()["peer_feedback"]["already_submitted"])

        updated = self.submit(
            self.alice, self.alice_headers, self.ended_project_id, self.bob_id,
            rating=3, feedback="Updated review",
        )
        self.assertEqual(updated.status_code, 201)
        self.assertEqual(updated.get_json()["peer_feedback"]["id"], feedback_id)

        with self.app.app_context():
            rows = PeerFeedback.query.filter_by(
                project_id=self.ended_project_id,
                from_student_id=self.alice_id,
                to_student_id=self.bob_id,
            ).all()
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0].rating, 3)
            self.assertEqual(rows[0].feedback, "Updated review")
            self.assertIsNotNone(rows[0].updated_at)

    def test_peer_feedback_criteria_validation_storage_and_team_rules(self):
        from app.models.peer_feedback import PeerFeedback

        def criteria_payload(ratings=(5, 5, 4, 5)):
            keys = ("contribution", "communication", "responsibility", "problem_solving")
            return [
                {"key": key, "rating": rating, "comment": f"comment for {key}"}
                for key, rating in zip(keys, ratings)
            ]

        missing = self.submit(
            self.alice, self.alice_headers, self.ended_project_id, self.bob_id,
            criteria=criteria_payload()[:3],
        )
        self.assertEqual(missing.status_code, 400)

        invalid_rating = self.submit(
            self.alice, self.alice_headers, self.ended_project_id, self.bob_id,
            criteria=criteria_payload((6, 5, 5, 5)),
        )
        self.assertEqual(invalid_rating.status_code, 400)

        created = self.submit(
            self.alice, self.alice_headers, self.ended_project_id, self.bob_id,
            criteria=criteria_payload(), feedback="Strong across all criteria",
        )
        self.assertEqual(created.status_code, 201)
        item = created.get_json()["peer_feedback"]
        self.assertEqual(len(item["criteria"]), 4)
        self.assertEqual(item["rating"], 5)
        self.assertEqual(item["criteria"][0]["label"], "Contribution to project work")
        self.assertTrue(all(entry["comment"] for entry in item["criteria"]))

        with self.app.app_context():
            row = PeerFeedback.query.filter_by(
                project_id=self.ended_project_id,
                from_student_id=self.alice_id,
                to_student_id=self.bob_id,
            ).first()
            self.assertIsNotNone(row)
            self.assertEqual(len(row.criteria), 4)
            self.assertEqual(row.rating, 5)
            self.assertEqual(row.feedback, "Strong across all criteria")

        own_list = self.alice.get(
            f"/api/student/peer-feedback?project_id={self.ended_project_id}"
        )
        rules = own_list.get_json()["rules"]
        self.assertTrue(rules["allow_updates"])
        self.assertEqual(len(rules["criteria"]), 4)
        self.assertEqual(rules["min_rating"], 1)
        self.assertEqual(rules["max_rating"], 5)

        teams = self.alice.get("/api/student/teams")
        self.assertEqual(teams.status_code, 200)
        team_projects = [team["project"] for team in teams.get_json()["teams"]]
        self.assertTrue(team_projects)
        self.assertTrue(any("deadline" in item for item in team_projects))
        self.assertTrue(any(item["peer_feedback_available"] for item in team_projects))
        self.assertEqual(
            len(team_projects[0]["peer_feedback_rules"]["criteria"]), 4
        )

    def test_peer_feedback_visibility_authorization(self):
        submitted = self.submit(
            self.alice, self.alice_headers, self.ended_project_id, self.bob_id,
            rating=4, feedback="Great teammate",
        )
        self.assertEqual(submitted.status_code, 201)
        feedback_id = submitted.get_json()["peer_feedback"]["id"]

        own_list = self.alice.get(
            f"/api/student/peer-feedback?project_id={self.ended_project_id}"
        )
        self.assertEqual(own_list.status_code, 200)
        payload = own_list.get_json()
        self.assertTrue(payload["rules"]["allow_updates"])
        self.assertTrue(any(item["id"] == feedback_id for item in payload["peer_feedback"]))

        own_detail = self.alice.get(f"/api/student/peer-feedback/{feedback_id}")
        self.assertEqual(own_detail.status_code, 200)

        bob_detail = self.bob.get(f"/api/student/peer-feedback/{feedback_id}")
        self.assertEqual(bob_detail.status_code, 404)

        bob_own_list = self.bob.get("/api/student/peer-feedback")
        self.assertEqual(bob_own_list.status_code, 200)
        self.assertFalse(
            any(item["id"] == feedback_id for item in bob_own_list.get_json()["peer_feedback"])
        )

        carol_detail = self.carol.get(f"/api/student/peer-feedback/{feedback_id}")
        self.assertEqual(carol_detail.status_code, 404)

        instructor_list = self.instructor.get(
            f"/api/instructor/projects/{self.ended_project_id}/peer-feedback"
        )
        self.assertEqual(instructor_list.status_code, 200)
        instructor_item = next(
            item for item in instructor_list.get_json()["peer_feedback"]
            if item["id"] == feedback_id
        )
        self.assertEqual(instructor_item["author"]["id"], self.alice_id)

        instructor_detail = self.instructor.get(
            f"/api/instructor/peer-feedback/{feedback_id}"
        )
        self.assertEqual(instructor_detail.status_code, 200)

        unauthorized_list = self.other_instructor.get(
            f"/api/instructor/projects/{self.ended_project_id}/peer-feedback"
        )
        self.assertEqual(unauthorized_list.status_code, 404)

        unauthorized_detail = self.other_instructor.get(
            f"/api/instructor/peer-feedback/{feedback_id}"
        )
        self.assertEqual(unauthorized_detail.status_code, 404)

        admin_list = self.admin.get(
            f"/api/admin/peer-feedback?project_id={self.ended_project_id}"
        )
        self.assertEqual(admin_list.status_code, 200)
        self.assertTrue(
            any(item["id"] == feedback_id for item in admin_list.get_json()["peer_feedback"])
        )

        admin_detail = self.admin.get(f"/api/admin/peer-feedback/{feedback_id}")
        self.assertEqual(admin_detail.status_code, 200)

        student_admin_attempt = self.alice.get("/api/admin/peer-feedback")
        self.assertEqual(student_admin_attempt.status_code, 403)

        instructor_student_attempt = self.instructor.get("/api/student/peer-feedback")
        self.assertEqual(instructor_student_attempt.status_code, 403)

    def test_unpublished_grade_is_not_returned_even_with_known_id(self):
        response = self.alice.get("/api/student/grades")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(all(item["id"] for item in response.get_json()["grades"]))
        self.assertFalse(
            any(item["project_id"] == self.active_project_id for item in response.get_json()["grades"])
        )
