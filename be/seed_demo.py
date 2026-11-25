"""Idempotent demo-data seeder for ft_transcendence.

Run from ``be/`` with the virtual environment active:

    python seed_demo.py

or through Flask:

    flask --app run.py seed-demo

The seeder is safe to run repeatedly. Existing demo users, courses, projects,
teams, and tasks are updated or skipped instead of duplicated, and every demo
account is reset to the documented password.
"""

import os
import random

from werkzeug.security import generate_password_hash

from app import create_app
from app.extensions import db
from app.models.skill import Skill, StudentSkill
from app.models.student_dashboard import (
    Course,
    CourseEnrollment,
    Project,
    Task,
    Team,
    TeamMember,
)
from app.models.student_gpa import StudentGPA
from app.models.user import User

DEMO_PASSWORD = "Password123!"
RANDOM_SEED = 42


def seed_demo_data():
    app = create_app()
    random.seed(RANDOM_SEED)

    with app.app_context():
        # Skills
        skill_names = [
            ("Python", "technical"),
            ("JavaScript", "technical"),
            ("React", "technical"),
            ("SQL", "technical"),
            ("Communication", "interpersonal"),
            ("Leadership", "interpersonal"),
            ("Design", "artistic"),
            ("English", "linguistic"),
            ("French", "linguistic"),
            ("Problem Solving", "other"),
        ]
        skills = []
        for name, category in skill_names:
            skill = Skill.query.filter_by(name=name).first()
            if skill is None:
                skill = Skill(
                    name=name,
                    category=category,
                    description=f"Demo skill {name}",
                    created_by=None,
                )
                db.session.add(skill)
            skills.append(skill)
        db.session.commit()

        # Instructors
        instructors = []
        for index in range(1, 6):
            email = f"instructor{index}@example.com"
            user = User.query.filter_by(email=email).first()
            if user is None:
                user = User(
                    first_name=f"Instructor{index}",
                    last_name="Demo",
                    email=email,
                    password_hash=generate_password_hash(DEMO_PASSWORD),
                    role="instructor",
                    major="Computer Science",
                    joined_year=2020,
                )
                db.session.add(user)
            else:
                user.first_name = f"Instructor{index}"
                user.last_name = "Demo"
                user.role = "instructor"
                user.major = "Computer Science"
                user.joined_year = 2020
                user.password_hash = generate_password_hash(DEMO_PASSWORD)
            instructors.append(user)
        db.session.commit()

        # Students
        students = []
        majors = ["Computer Science", "Software Engineering", "Data Science", "IT"]
        domains = ["CS", "SE", "DS"]
        for index in range(1, 101):
            email = f"student{index}@example.com"
            user = User.query.filter_by(email=email).first()
            if user is None:
                user = User(
                    first_name=f"Student{index}",
                    last_name="Demo",
                    email=email,
                    password_hash=generate_password_hash(DEMO_PASSWORD),
                    role="student",
                    student_id=f"S{index:04d}",
                    major=random.choice(majors),
                    joined_year=random.choice([2022, 2023, 2024]),
                    domain=random.choice(domains),
                )
                db.session.add(user)
            else:
                user.first_name = f"Student{index}"
                user.last_name = "Demo"
                user.role = "student"
                user.student_id = f"S{index:04d}"
                user.password_hash = generate_password_hash(DEMO_PASSWORD)
            students.append(user)
        db.session.commit()

        # GPA
        for user in random.sample(students, 70):
            gpa_value = round(random.uniform(2.0, 4.0), 2)
            gpa = StudentGPA.query.filter_by(student_id=user.id).first()
            if gpa is None:
                gpa = StudentGPA(
                    student_id=user.id,
                    gpa=gpa_value,
                )
                db.session.add(gpa)
        db.session.commit()

        # Student skills
        for user in students:
            chosen_skills = random.sample(skills, random.randint(1, 4))
            for skill in chosen_skills:
                proficiency = random.randint(1, 5)
                student_skill = StudentSkill.query.filter_by(
                    student_id=user.id, skill_id=skill.id
                ).first()
                if student_skill is None:
                    student_skill = StudentSkill(
                        student_id=user.id,
                        skill_id=skill.id,
                        proficiency_level=proficiency,
                    )
                    db.session.add(student_skill)
        db.session.commit()

        # Courses
        semesters = ["fall", "spring", "summer"]
        courses = []
        for index in range(1, 11):
            instructor = instructors[(index - 1) % len(instructors)]
            name = f"Course {index}"
            course = Course.query.filter_by(
                name=name,
                academic_year="2025/2026",
                instructor_id=instructor.id,
            ).first()
            semester = random.choice(semesters)
            if course is None:
                course = Course(
                    instructor_id=instructor.id,
                    name=name,
                    academic_year="2025/2026",
                    semester=semester,
                    microsoft_class_id=f"CLASS{index:03d}",
                )
                db.session.add(course)
            courses.append(course)
        db.session.commit()

        # Enrollments
        for index, user in enumerate(students):
            course = courses[index % len(courses)]
            enrollment = CourseEnrollment.query.filter_by(
                student_id=user.id, course_id=course.id
            ).first()
            if enrollment is None:
                db.session.add(
                    CourseEnrollment(student_id=user.id, course_id=course.id)
                )

        for user in students:
            if random.random() < 0.3:
                course = random.choice(courses)
                enrollment = CourseEnrollment.query.filter_by(
                    student_id=user.id, course_id=course.id
                ).first()
                if enrollment is None:
                    db.session.add(
                        CourseEnrollment(student_id=user.id, course_id=course.id)
                    )
        db.session.commit()

        # Projects
        projects = []
        for course in courses:
            project = Project.query.filter_by(course_id=course.id).first()
            if project is None:
                project = Project(
                    course_id=course.id,
                    title=f"Project for {course.name}",
                    description=f"Demo project description for {course.name}",
                    deadline=None,
                    min_members_per_team=2,
                    max_members_per_team=4,
                    prd=f"Requirements for {course.name}",
                )
                db.session.add(project)
            projects.append(project)
        db.session.commit()

        # Teams
        for project in projects:
            team_count = random.randint(3, 5)
            for team_number in range(1, team_count):
                name = f"Team {team_number}"
                team = Team.query.filter_by(
                    project_id=project.id, name=name
                ).first()
                enrolled_students = [
                    enrollment.student_id
                    for enrollment in CourseEnrollment.query.filter_by(
                        course_id=project.course_id
                    ).all()
                ]
                existing_members = {
                    member.student_id
                    for member in TeamMember.query.join(Team).filter(
                        Team.project_id == project.id
                    ).all()
                }
                candidates = [
                    student_id
                    for student_id in enrolled_students
                    if student_id not in existing_members
                ]
                random.shuffle(candidates)
                to_add_count = random.randint(1, project.max_members_per_team)
                to_add = candidates[:to_add_count]

                if team is None and to_add:
                    team = Team(
                        project_id=project.id,
                        name=name,
                        status="forming",
                    )
                    db.session.add(team)
                    db.session.flush()
                    for student_id in to_add:
                        db.session.add(
                            TeamMember(team_id=team.id, student_id=student_id)
                        )
                        existing_members.add(student_id)
                    team.leader_id = to_add[0]
                    team.status = "forming"
        db.session.commit()

        # Tasks
        statuses = ["todo", "in_progress", "review", "done"]
        for team in Team.query.all():
            members = [
                membership.student_id
                for membership in TeamMember.query.filter_by(team_id=team.id).all()
            ]
            task_count = random.randint(3, 6)
            for task_number in range(1, task_count + 1):
                title = f"Task {task_number} for {team.name}"
                status = random.choice(statuses)
                creator = (
                    random.choice(members)
                    if members
                    else students[0].id
                )
                assignee = (
                    random.choice(members)
                    if members and random.random() < 0.7
                    else None
                )
                existing_task = Task.query.filter_by(
                    team_id=team.id, title=title
                ).first()
                if existing_task is not None:
                    continue
                db.session.add(
                    Task(
                        team_id=team.id,
                        title=title,
                        description="Demo task",
                        status=status,
                        created_by=creator,
                        assignee_id=assignee,
                    )
                )
        db.session.commit()

        print("Seed complete")
        print("users", User.query.count())
        print("courses", Course.query.count())
        print("projects", Project.query.count())
        print("teams", Team.query.count())
        print("team_members", TeamMember.query.count())
        print("tasks", Task.query.count())


if __name__ == "__main__":
    seed_demo_data()
