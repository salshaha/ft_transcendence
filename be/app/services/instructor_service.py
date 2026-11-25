from datetime import datetime, timezone

from sqlalchemy import func, or_
from sqlalchemy.orm import joinedload, selectinload

from app.extensions import db
from app.models.grade import Grade, GradeAudit
from app.models.peer_feedback import PeerFeedback
from app.models.skill import StudentSkill
from app.models.student_dashboard import (
    Course,
    CourseEnrollment,
    Project,
    Task,
    Team,
    TeamMember,
)
from app.models.student_gpa import StudentGPA
from app.models.submission import Submission
from app.models.user import User
from app.realtime import emit_grade_event
from app.services.auth_service import get_authenticated_user
from app.services.task_service import serialize_task


def get_authenticated_instructor():
    return get_authenticated_user(allowed_roles={"instructor"})


def serialize_user(user):
    return {
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "full_name": f"{user.first_name} {user.last_name}",
        "email": user.email,
        "student_id": user.student_id,
        "major": user.major,
        "joined_year": user.joined_year,
        "domain": user.domain,
        "profile_picture": user.profile_picture,
        "gpa": float(user.gpa.gpa) if user.gpa else None,
    }


def serialize_skills(student):
    return [
        {
            "skill_id": ss.skill_id,
            "name": ss.skill.name if ss.skill else None,
            "category": ss.skill.category if ss.skill else None,
            "proficiency_level": ss.proficiency_level,
        }
        for ss in getattr(student, "skills", [])
    ]


def serialize_student_summary(student):
    data = serialize_user(student)
    data["skills"] = serialize_skills(student)
    return data


def _course_query(instructor_id):
    return (
        Course.query.filter_by(instructor_id=instructor_id)
        .options(joinedload(Course.projects))
        .order_by(Course.name.asc(), Course.id.asc())
    )


def _serialize_course_projects(course):
    return [
        {"id": project.id, "title": project.title}
        for project in sorted(course.projects, key=lambda item: item.id, reverse=True)
    ]


def get_courses(instructor_id):
    courses = _course_query(instructor_id).all()
    student_counts = dict(
        db.session.query(
            CourseEnrollment.course_id,
            func.count(CourseEnrollment.student_id),
        )
        .join(Course, Course.id == CourseEnrollment.course_id)
        .filter(Course.instructor_id == instructor_id)
        .group_by(CourseEnrollment.course_id)
        .all()
    )

    result = []
    for course in courses:
        course_projects = _serialize_course_projects(course)
        result.append(
            {
                "id": course.id,
                "name": course.name,
                "code": course.microsoft_class_id,
                "academic_year": course.academic_year,
                "semester": course.semester,
                "student_count": student_counts.get(course.id, 0),
                "projects": course_projects,
                "project_ids": [project["id"] for project in course_projects],
            }
        )
    return result


def get_deadlines(instructor_id):
    now = datetime.now(timezone.utc)
    tasks = (
        Task.query.join(Team, Team.id == Task.team_id)
        .join(Project, Project.id == Team.project_id)
        .join(Course, Course.id == Project.course_id)
        .options(
            joinedload(Task.team)
            .joinedload(Team.project)
            .joinedload(Project.course)
        )
        .filter(
            Course.instructor_id == instructor_id,
            Task.due_date.is_not(None),
            Task.due_date >= now,
        )
        .order_by(Task.due_date.asc(), Task.id.asc())
        .all()
    )

    return [
        {
            "id": task.id,
            "title": task.title,
            "description": task.description,
            "due_date": task.due_date.isoformat(),
            "status": task.status,
            "team": {"id": task.team.id, "name": task.team.name},
            "project": {"id": task.team.project.id},
            "course": {
                "id": task.team.project.course.id,
                "name": task.team.project.course.name,
            },
        }
        for task in tasks
    ]


def get_students(instructor_id):
    students = (
        User.query.join(CourseEnrollment, CourseEnrollment.student_id == User.id)
        .join(Course, Course.id == CourseEnrollment.course_id)
        .filter(Course.instructor_id == instructor_id, User.role == "student")
        .options(
            selectinload(User.gpa),
            selectinload(User.skills).joinedload(StudentSkill.skill),
        )
        .distinct()
        .order_by(User.last_name.asc(), User.first_name.asc(), User.id.asc())
        .all()
    )
    return [serialize_student_summary(student) for student in students]


def get_projects(instructor_id):
    projects = (
        Project.query.join(Course, Course.id == Project.course_id)
        .options(
            joinedload(Project.course),
            selectinload(Project.teams).selectinload(Team.members),
        )
        .filter(Course.instructor_id == instructor_id)
        .order_by(Project.created_at.desc(), Project.id.desc())
        .all()
    )
    return [
        {
            "id": project.id,
            "course": {"id": project.course.id, "name": project.course.name},
            "title": project.title,
            "description": project.description,
            "deadline": project.deadline.isoformat() if project.deadline else None,
            "requirements": {
                "original_name": project.requirements_original_name,
                "content_type": project.requirements_content_type,
                "size": project.requirements_size,
            } if project.requirements_file_key else None,
            "prd": project.prd,
            "min_members_per_team": project.min_members_per_team,
            "max_members_per_team": project.max_members_per_team,
            "team_count": len(project.teams),
            "teams": [
                {
                    "id": team.id,
                    "name": team.name,
                    "member_count": len(team.members),
                }
                for team in project.teams
            ],
        }
        for project in projects
    ]


def get_dashboard(instructor):
    return {
        "instructor": serialize_user(instructor),
        "courses": get_courses(instructor.id),
        "deadlines": get_deadlines(instructor.id),
        "students": get_students(instructor.id),
        "projects": get_projects(instructor.id),
        "submissions": {
            "available": True,
            "items": get_recent_submissions(instructor.id),
            "reason": None,
        },
        "progress": get_progress(instructor.id),
        "resources": {
            "available": False,
            "items": [],
            "reason": "Course slides and labs are excluded from this phase.",
        },
    }


def _percent(part, total):
    if not total:
        return 0
    return round((part / total) * 100)


def _empty_status_counts():
    return {"todo": 0, "in_progress": 0, "review": 0, "done": 0}


def _submission_activity_months(now):
    months = []
    for offset in range(5, -1, -1):
        month_index = now.month - offset
        year = now.year
        while month_index <= 0:
            month_index += 12
            year -= 1
        month_start = datetime(year, month_index, 1, tzinfo=timezone.utc)
        months.append(
            {
                "month": month_start.strftime("%Y-%m"),
                "label": month_start.strftime("%b %Y"),
                "count": 0,
            }
        )
    return months


def _submission_status(submitted_at, deadline):
    if submitted_at and deadline and submitted_at > deadline:
        return "late"
    return "on_time"


def _submission_query(instructor_id):
    return (
        Submission.query.join(Team, Team.id == Submission.team_id)
        .join(Project, Project.id == Team.project_id)
        .join(Course, Course.id == Project.course_id)
        .options(
            joinedload(Submission.team)
            .joinedload(Team.project)
            .joinedload(Project.course),
            joinedload(Submission.submitter),
        )
        .filter(Course.instructor_id == instructor_id)
    )


def serialize_instructor_submission(submission):
    team = submission.team
    project = team.project if team else None
    course = project.course if project else None
    submitter = submission.submitter
    return {
        "id": submission.id,
        "team_id": submission.team_id,
        "team_name": team.name if team else None,
        "project_id": project.id if project else None,
        "project_title": project.title if project else None,
        "course_id": course.id if course else None,
        "course_name": course.name if course else None,
        "submitted_by": submission.submitted_by,
        "submitter_name": (
            f"{submitter.first_name} {submitter.last_name}"
            if submitter else None
        ),
        "submitted_at": (
            submission.submitted_at.isoformat() if submission.submitted_at else None
        ),
        "deadline": project.deadline.isoformat() if project and project.deadline else None,
        "status": _submission_status(submission.submitted_at, project.deadline if project else None),
        "file": {
            "key": submission.file_key,
            "original_name": submission.original_name,
            "content_type": submission.content_type,
            "size": submission.size,
            "sha256": submission.sha256,
            "url": f"/api/instructor/submissions/{submission.id}/file",
        },
    }


def get_recent_submissions(instructor_id, limit=5):
    submissions = (
        _submission_query(instructor_id)
        .order_by(Submission.submitted_at.desc(), Submission.id.desc())
        .limit(limit)
        .all()
    )
    return [serialize_instructor_submission(submission) for submission in submissions]


def get_all_submissions(instructor_id):
    submissions = (
        _submission_query(instructor_id)
        .order_by(Submission.submitted_at.desc(), Submission.id.desc())
        .all()
    )
    return [serialize_instructor_submission(submission) for submission in submissions]


def get_instructor_submission(instructor_id, submission_id):
    submission = (
        _submission_query(instructor_id)
        .filter(Submission.id == submission_id)
        .one_or_none()
    )
    if submission is None:
        raise LookupError("Submission not found")
    return submission


def get_progress(instructor_id):
    now = datetime.now(timezone.utc)
    courses = get_courses(instructor_id)
    projects = get_projects(instructor_id)
    course_names = {course["id"]: course["name"] for course in courses}
    project_info = {
        project["id"]: {
            "title": project["title"],
            "course_id": project["course"]["id"],
            "course_name": project["course"]["name"],
            "deadline": project["deadline"],
        }
        for project in projects
    }

    team_rows = (
        db.session.query(
            Course.id.label("course_id"),
            Project.id.label("project_id"),
            Team.id.label("team_id"),
            Team.name.label("team_name"),
            Team.status.label("team_status"),
            func.count(TeamMember.student_id).label("member_count"),
        )
        .join(Project, Project.course_id == Course.id)
        .join(Team, Team.project_id == Project.id)
        .outerjoin(TeamMember, TeamMember.team_id == Team.id)
        .filter(Course.instructor_id == instructor_id)
        .group_by(Course.id, Project.id, Team.id, Team.name, Team.status)
        .all()
    )

    task_rows = (
        db.session.query(
            Course.id.label("course_id"),
            Project.id.label("project_id"),
            Team.id.label("team_id"),
            Task.status.label("status"),
            Task.due_date.label("due_date"),
        )
        .join(Project, Project.course_id == Course.id)
        .join(Team, Team.project_id == Project.id)
        .join(Task, Task.team_id == Team.id)
        .filter(Course.instructor_id == instructor_id)
        .all()
    )

    submission_rows = (
        db.session.query(
            Course.id.label("course_id"),
            Project.id.label("project_id"),
            Team.id.label("team_id"),
            Submission.id.label("submission_id"),
            Submission.submitted_at.label("submitted_at"),
        )
        .join(Project, Project.course_id == Course.id)
        .join(Team, Team.project_id == Project.id)
        .join(Submission, Submission.team_id == Team.id)
        .filter(Course.instructor_id == instructor_id)
        .all()
    )

    gpa_by_course = dict(
        db.session.query(
            CourseEnrollment.course_id,
            func.avg(StudentGPA.gpa),
        )
        .join(StudentGPA, StudentGPA.student_id == CourseEnrollment.student_id)
        .join(Course, Course.id == CourseEnrollment.course_id)
        .filter(Course.instructor_id == instructor_id)
        .group_by(CourseEnrollment.course_id)
        .all()
    )

    submission_activity = _submission_activity_months(now)
    submission_activity_by_course = {
        course["id"]: _submission_activity_months(now) for course in courses
    }
    submission_activity_by_project = {
        project["id"]: _submission_activity_months(now) for project in projects
    }
    activity_by_month = {item["month"]: item for item in submission_activity}
    for row in submission_rows:
        if row.submitted_at is None:
            continue
        month_key = row.submitted_at.strftime("%Y-%m")
        for activity in (
            activity_by_month.get(month_key),
            next(
                (
                    item
                    for item in submission_activity_by_course.get(row.course_id, [])
                    if item["month"] == month_key
                ),
                None,
            ),
            next(
                (
                    item
                    for item in submission_activity_by_project.get(row.project_id, [])
                    if item["month"] == month_key
                ),
                None,
            ),
        ):
            if activity is not None:
                activity["count"] += 1

    status_counts = _empty_status_counts()
    status_counts_by_course = {
        course["id"]: _empty_status_counts() for course in courses
    }
    status_counts_by_project = {
        project["id"]: _empty_status_counts() for project in projects
    }
    overdue_by_team = {}
    overdue_by_course = {}
    overdue_by_project = {}
    overdue_task_count = 0
    for row in task_rows:
        status_counts[row.status] = status_counts.get(row.status, 0) + 1
        if row.course_id in status_counts_by_course:
            course_counts = status_counts_by_course[row.course_id]
            course_counts[row.status] = course_counts.get(row.status, 0) + 1
        if row.project_id in status_counts_by_project:
            project_counts = status_counts_by_project[row.project_id]
            project_counts[row.status] = project_counts.get(row.status, 0) + 1
        if row.due_date and row.due_date < now and row.status != "done":
            overdue_task_count += 1
            overdue_by_team[row.team_id] = overdue_by_team.get(row.team_id, 0) + 1
            overdue_by_course[row.course_id] = (
                overdue_by_course.get(row.course_id, 0) + 1
            )
            overdue_by_project[row.project_id] = (
                overdue_by_project.get(row.project_id, 0) + 1
            )

    team_stats = {}
    for row in team_rows:
        team_stats[row.team_id] = {
            "id": row.team_id,
            "name": row.team_name,
            "status": row.team_status,
            "course_id": row.course_id,
            "course_name": course_names.get(row.course_id),
            "project_id": row.project_id,
            "project_title": project_info.get(row.project_id, {}).get("title"),
            "member_count": row.member_count,
            "task_count": 0,
            "done_task_count": 0,
            "overdue_task_count": overdue_by_team.get(row.team_id, 0),
            "submission_count": 0,
            "has_submission": False,
        }

    for row in task_rows:
        stats = team_stats.get(row.team_id)
        if stats is None:
            continue
        stats["task_count"] += 1
        if row.status == "done":
            stats["done_task_count"] += 1

    for row in submission_rows:
        stats = team_stats.get(row.team_id)
        if stats is None:
            continue
        stats["submission_count"] += 1
        stats["has_submission"] = True

    for stats in team_stats.values():
        stats["completion_percent"] = _percent(
            stats["done_task_count"], stats["task_count"]
        )

    per_project = []
    for project in projects:
        project_id = project["id"]
        project_tasks = [row for row in task_rows if row.project_id == project_id]
        project_teams = [row for row in team_rows if row.project_id == project_id]
        project_submissions = [
            row for row in submission_rows if row.project_id == project_id
        ]
        done_tasks = sum(1 for row in project_tasks if row.status == "done")
        overdue_tasks = sum(
            1
            for row in project_tasks
            if row.due_date and row.due_date < now and row.status != "done"
        )
        teams_with_submission = len({row.team_id for row in project_submissions})
        per_project.append(
            {
                "id": project_id,
                "title": project["title"],
                "course_id": project["course"]["id"],
                "course_name": project["course"]["name"],
                "deadline": project["deadline"],
                "team_count": len(project_teams),
                "task_count": len(project_tasks),
                "done_task_count": done_tasks,
                "overdue_task_count": overdue_tasks,
                "status_counts": status_counts_by_project.get(project_id, _empty_status_counts()),
                "submission_count": len(project_submissions),
                "submission_activity": submission_activity_by_project.get(project_id, []),
                "completion_percent": _percent(done_tasks, len(project_tasks)),
                "submission_rate_percent": _percent(
                    teams_with_submission, len(project_teams)
                ),
            }
        )

    per_course = []
    for course in courses:
        course_id = course["id"]
        course_tasks = [row for row in task_rows if row.course_id == course_id]
        course_teams = [row for row in team_rows if row.course_id == course_id]
        course_submissions = [
            row for row in submission_rows if row.course_id == course_id
        ]
        done_tasks = sum(1 for row in course_tasks if row.status == "done")
        teams_with_submission = len({row.team_id for row in course_submissions})
        average_gpa = gpa_by_course.get(course_id)
        per_course.append(
            {
                "id": course_id,
                "name": course["name"],
                "student_count": course["student_count"],
                "team_count": len(course_teams),
                "task_count": len(course_tasks),
                "done_task_count": done_tasks,
                "overdue_task_count": overdue_by_course.get(course_id, 0),
                "status_counts": status_counts_by_course.get(course_id, _empty_status_counts()),
                "submission_count": len(course_submissions),
                "submission_activity": submission_activity_by_course.get(course_id, []),
                "completion_percent": _percent(done_tasks, len(course_tasks)),
                "submission_rate_percent": _percent(
                    teams_with_submission, len(course_teams)
                ),
                "average_gpa": round(float(average_gpa), 2) if average_gpa is not None else None,
            }
        )

    students = get_students(instructor_id)
    gpa_values = [student["gpa"] for student in students if student["gpa"] is not None]
    total_teams = len(team_stats)
    teams_with_submission = sum(
        1 for stats in team_stats.values() if stats["has_submission"]
    )
    at_risk_teams = sum(
        1
        for stats in team_stats.values()
        if stats["overdue_task_count"] > 0 and not stats["has_submission"]
    )

    return {
        "overall": {
            "student_count": len(students),
            "course_count": len(courses),
            "project_count": len(projects),
            "team_count": total_teams,
            "task_count": len(task_rows),
            "submission_count": len(submission_rows),
            "status_counts": status_counts,
            "overdue_task_count": overdue_task_count,
            "completion_percent": _percent(status_counts["done"], len(task_rows)),
            "submission_rate_percent": _percent(teams_with_submission, total_teams),
            "at_risk_team_count": at_risk_teams,
            "average_gpa": (
                round(sum(gpa_values) / len(gpa_values), 2) if gpa_values else None
            ),
        },
        "per_course": per_course,
        "per_project": per_project,
        "submission_activity": submission_activity,
        "per_team": sorted(
            team_stats.values(),
            key=lambda item: (item["completion_percent"], item["name"]),
            reverse=True,
        ),
        "definitions": {
            "completion_percent": "done tasks divided by all tasks",
            "submission_rate_percent": "teams with at least one submission divided by all teams",
            "overdue_task_count": "unfinished tasks with a due date before now",
            "submission_activity": "submissions grouped by submission month for the last six months",
            "at_risk_team_count": "teams with overdue unfinished tasks and no submission",
        },
    }


def _parse_datetime(value):
    if value is None or value == "":
        return None
    if not isinstance(value, str):
        raise ValueError("deadline must be an ISO-8601 datetime")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _parse_int(value, field_name, default=None):
    if value is None or value == "":
        return default
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field_name} must be an integer") from exc


def get_course(instructor_id, course_id):
    return Course.query.filter_by(
        id=course_id, instructor_id=instructor_id
    ).first()


def get_course_students(instructor_id, course_id):
    course = get_course(instructor_id, course_id)
    if course is None:
        return None
    students = (
        User.query.join(CourseEnrollment, CourseEnrollment.student_id == User.id)
        .filter(CourseEnrollment.course_id == course_id, User.role == "student")
        .options(
            selectinload(User.gpa),
            selectinload(User.skills).joinedload(StudentSkill.skill),
        )
        .order_by(User.last_name.asc(), User.first_name.asc())
        .all()
    )
    return [serialize_student_summary(student) for student in students]


def get_student_profile(instructor_id, student_id):
    enrolled = (
        CourseEnrollment.query.join(Course, Course.id == CourseEnrollment.course_id)
        .filter(
            CourseEnrollment.student_id == student_id,
            Course.instructor_id == instructor_id,
        )
        .first()
    )
    if enrolled is None:
        raise LookupError("Student not found")

    student = (
        User.query.filter_by(id=student_id, role="student")
        .options(
            selectinload(User.gpa),
            selectinload(User.skills).joinedload(StudentSkill.skill),
        )
        .one_or_none()
    )
    if student is None:
        raise LookupError("Student not found")

    courses = (
        Course.query.join(
            CourseEnrollment, CourseEnrollment.course_id == Course.id
        )
        .options(joinedload(Course.projects))
        .filter(
            Course.instructor_id == instructor_id,
            CourseEnrollment.student_id == student_id,
        )
        .order_by(Course.name.asc(), Course.id.asc())
        .all()
    )

    memberships = (
        TeamMember.query.join(Team, Team.id == TeamMember.team_id)
        .join(Project, Project.id == Team.project_id)
        .join(Course, Course.id == Project.course_id)
        .options(
            joinedload(TeamMember.team)
            .joinedload(Team.project)
            .joinedload(Project.course)
        )
        .filter(
            TeamMember.student_id == student_id,
            Course.instructor_id == instructor_id,
        )
        .order_by(Team.name.asc())
        .all()
    )

    tasks = (
        Task.query.join(Team, Team.id == Task.team_id)
        .join(Project, Project.id == Team.project_id)
        .join(Course, Course.id == Project.course_id)
        .options(
            joinedload(Task.team).joinedload(Team.project).joinedload(Project.course),
            joinedload(Task.assignee),
            joinedload(Task.creator),
        )
        .filter(
            Course.instructor_id == instructor_id,
            or_(Task.assignee_id == student_id, Task.created_by == student_id),
        )
        .order_by(Task.due_date.asc(), Task.id.asc())
        .all()
    )

    submissions = (
        _submission_query(instructor_id)
        .join(TeamMember, TeamMember.team_id == Team.id)
        .filter(TeamMember.student_id == student_id)
        .order_by(Submission.submitted_at.desc())
        .all()
    )

    grades = (
        Grade.query.join(Project, Project.id == Grade.project_id)
        .join(Course, Course.id == Project.course_id)
        .options(joinedload(Grade.project))
        .filter(
            Grade.student_id == student_id,
            Course.instructor_id == instructor_id,
        )
        .order_by(Grade.updated_at.desc())
        .all()
    )

    feedback = (
        PeerFeedback.query.join(Project, Project.id == PeerFeedback.project_id)
        .join(Course, Course.id == Project.course_id)
        .options(joinedload(PeerFeedback.author), joinedload(PeerFeedback.project))
        .filter(
            PeerFeedback.to_student_id == student_id,
            Course.instructor_id == instructor_id,
        )
        .order_by(PeerFeedback.created_at.desc())
        .all()
    )

    profile = serialize_student_summary(student)
    profile["courses"] = [
        {
            "id": course.id,
            "name": course.name,
            "code": course.microsoft_class_id,
            "semester": course.semester,
            "academic_year": course.academic_year,
            "projects": _serialize_course_projects(course),
        }
        for course in courses
    ]
    profile["teams"] = [
        {
            "id": membership.team.id,
            "name": membership.team.name,
            "status": membership.team.status,
            "joined_at": (
                membership.joined_at.isoformat() if membership.joined_at else None
            ),
            "project": {
                "id": membership.team.project.id,
                "title": membership.team.project.title,
            },
            "course": {
                "id": membership.team.project.course.id,
                "name": membership.team.project.course.name,
            },
        }
        for membership in memberships
    ]
    profile["tasks"] = [serialize_task(task) for task in tasks]
    profile["submissions"] = [
        serialize_instructor_submission(submission) for submission in submissions
    ]
    profile["grades"] = [
        {
            "id": grade.id,
            "project_id": grade.project_id,
            "project_title": grade.project.title if grade.project else None,
            "grade": float(grade.grade) if grade.grade is not None else None,
            "feedback": grade.feedback,
            "published": grade.published,
            "published_at": (
                grade.published_at.isoformat() if grade.published_at else None
            ),
            "updated_at": (
                grade.updated_at.isoformat() if grade.updated_at else None
            ),
        }
        for grade in grades
    ]
    profile["feedback_received"] = [
        {
            "id": item.id,
            "project_id": item.project_id,
            "project_title": item.project.title if item.project else None,
            "rating": item.rating,
            "feedback": item.feedback,
            "from": (
                f"{item.author.first_name} {item.author.last_name}"
                if item.author else None
            ),
            "created_at": (
                item.created_at.isoformat() if item.created_at else None
            ),
        }
        for item in feedback
    ]
    return profile


def get_student_avatar_owner(instructor_id, student_id):
    student = (
        User.query.join(CourseEnrollment, CourseEnrollment.student_id == User.id)
        .join(Course, Course.id == CourseEnrollment.course_id)
        .filter(
            Course.instructor_id == instructor_id,
            User.id == student_id,
            User.role == "student",
        )
        .first()
    )
    if student is None:
        raise LookupError("Student not found")
    if not student.profile_picture:
        raise LookupError("Avatar not found")
    return student


def serialize_project(project):
    return {
        "id": project.id,
        "course_id": project.course_id,
        "title": project.title,
        "description": project.description,
        "deadline": project.deadline.isoformat() if project.deadline else None,
        "min_members_per_team": project.min_members_per_team,
        "max_members_per_team": project.max_members_per_team,
        "prd": project.prd,
        "requirements": {
            "file_key": project.requirements_file_key,
            "original_name": project.requirements_original_name,
            "content_type": project.requirements_content_type,
            "size": project.requirements_size,
            "sha256": project.requirements_sha256,
        } if project.requirements_file_key else None,
        "created_at": project.created_at.isoformat() if project.created_at else None,
    }


def create_project(instructor_id, course_id, data):
    course = get_course(instructor_id, course_id)
    if course is None:
        raise LookupError("Course not found")

    min_members = _parse_int(
        data.get("min_members_per_team"), "min_members_per_team", 1
    )
    max_members = _parse_int(
        data.get("max_members_per_team"), "max_members_per_team", min_members
    )
    if min_members is None or min_members < 1:
        raise ValueError("min_members_per_team must be at least 1")
    if max_members is None or max_members < min_members:
        raise ValueError(
            "max_members_per_team must be >= min_members_per_team"
        )

    deadline = _parse_datetime(data.get("deadline"))
    project = Project(
        course_id=course.id,
        title=(data.get("title") or "").strip() or None,
        description=data.get("description"),
        deadline=deadline,
        min_members_per_team=min_members,
        max_members_per_team=max_members,
        prd=data.get("prd") or data.get("description") or "",
    )
    db.session.add(project)
    db.session.commit()
    return serialize_project(project)


def update_project(instructor_id, project_id, data):
    project = (
        Project.query.join(Course, Course.id == Project.course_id)
        .filter(Project.id == project_id, Course.instructor_id == instructor_id)
        .first()
    )
    if project is None:
        raise LookupError("Project not found")

    if "min_members_per_team" in data or "max_members_per_team" in data:
        min_members = _parse_int(
            data.get("min_members_per_team", project.min_members_per_team),
            "min_members_per_team",
        )
        max_members = _parse_int(
            data.get("max_members_per_team", project.max_members_per_team),
            "max_members_per_team",
        )
        if min_members < 1:
            raise ValueError("min_members_per_team must be at least 1")
        if max_members < min_members:
            raise ValueError(
                "max_members_per_team must be >= min_members_per_team"
            )
        project.min_members_per_team = min_members
        project.max_members_per_team = max_members

    if "title" in data:
        project.title = (data.get("title") or "").strip() or None
    if "description" in data:
        project.description = data.get("description")
    if "prd" in data:
        project.prd = data.get("prd") or project.prd
    if "deadline" in data:
        project.deadline = _parse_datetime(data.get("deadline"))

    db.session.commit()
    return serialize_project(project)


def delete_project(instructor_id, project_id):
    project = (
        Project.query.join(Course, Course.id == Project.course_id)
        .filter(Project.id == project_id, Course.instructor_id == instructor_id)
        .first()
    )
    if project is None:
        raise LookupError("Project not found")
    db.session.delete(project)
    db.session.commit()
    return {"message": "Project deleted"}


def upload_project_requirements(instructor_id, project_id, file_storage):
    project = (
        Project.query.join(Course, Course.id == Project.course_id)
        .filter(Project.id == project_id, Course.instructor_id == instructor_id)
        .first()
    )
    if project is None:
        raise LookupError("Project not found")

    storage = current_app.extensions["storage"] if False else None
    from flask import current_app

    storage = current_app.extensions["storage"]
    stored = storage.save_upload(
        file_storage, "project_requirements", project.id
    )

    old_key = project.requirements_file_key
    project.requirements_file_key = stored.key
    project.requirements_original_name = stored.original_name
    project.requirements_content_type = stored.content_type
    project.requirements_size = stored.size
    project.requirements_sha256 = stored.sha256
    db.session.commit()

    if old_key and old_key != stored.key:
        storage.delete(old_key)
    return serialize_project(project)


def get_project_teams(instructor_id, project_id):
    project = (
        Project.query.join(Course, Course.id == Project.course_id)
        .filter(Project.id == project_id, Course.instructor_id == instructor_id)
        .first()
    )
    if project is None:
        raise LookupError("Project not found")

    teams = (
        Team.query.filter_by(project_id=project.id)
        .options(selectinload(Team.members).joinedload(TeamMember.student))
        .order_by(Team.name.asc())
        .all()
    )
    return [
        {
            "id": team.id,
            "name": team.name,
            "status": team.status,
            "leader_id": team.leader_id,
            "member_count": len(team.members),
            "members": [
                {
                    "student_id": m.student.id,
                    "name": f"{m.student.first_name} {m.student.last_name}",
                    "joined_at": m.joined_at.isoformat() if m.joined_at else None,
                }
                for m in team.members
            ],
        }
        for team in teams
    ]


def get_project_submissions(instructor_id, project_id):
    project = (
        Project.query.join(Course, Course.id == Project.course_id)
        .filter(Project.id == project_id, Course.instructor_id == instructor_id)
        .first()
    )
    if project is None:
        raise LookupError("Project not found")

    submissions = (
        Submission.query.join(Team, Team.id == Submission.team_id)
        .filter(Team.project_id == project.id)
        .options(joinedload(Submission.team), joinedload(Submission.submitter))
        .order_by(Submission.submitted_at.desc())
        .all()
    )
    return [
        {
            "id": s.id,
            "team_id": s.team_id,
            "team_name": s.team.name if s.team else None,
            "submitted_by": s.submitted_by,
            "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
            "file": {
                "key": s.file_key,
                "original_name": s.original_name,
                "content_type": s.content_type,
                "size": s.size,
                "sha256": s.sha256,
            },
        }
        for s in submissions
    ]


def save_grade(instructor_id, data):
    student_id = data.get("student_id")
    project_id = data.get("project_id")
    if student_id is None or project_id is None:
        raise ValueError("student_id and project_id are required")

    project = (
        Project.query.join(Course, Course.id == Project.course_id)
        .filter(Project.id == project_id, Course.instructor_id == instructor_id)
        .first()
    )
    if project is None:
        raise LookupError("Project not found")

    student = User.query.filter_by(id=student_id, role="student").first()
    if student is None:
        raise LookupError("Student not found")

    enrolled = CourseEnrollment.query.filter_by(
        student_id=student.id, course_id=project.course_id
    ).first()
    if enrolled is None:
        raise LookupError("Student is not enrolled in this course")

    grade_value = data.get("grade")
    if grade_value is not None and grade_value != "":
        try:
            grade_value = float(grade_value)
        except (TypeError, ValueError) as exc:
            raise ValueError("grade must be a number") from exc
    else:
        grade_value = None

    feedback = data.get("feedback")
    published = data.get("published", False)
    if isinstance(published, str):
        published = published.strip().lower() in {"1", "true", "yes", "on"}
    else:
        published = bool(published)
    now = datetime.now(timezone.utc)

    grade = Grade.query.filter_by(
        student_id=student_id, project_id=project_id
    ).first()
    if grade is None:
        grade = Grade(
            student_id=student_id,
            project_id=project_id,
            grade=grade_value,
            feedback=feedback,
            published=published,
            published_at=now if published else None,
        )
        db.session.add(grade)
        db.session.flush()
    else:
        audit = GradeAudit(
            grade_id=grade.id,
            changed_by=instructor_id,
            old_grade=grade.grade,
            new_grade=grade_value,
            old_feedback=grade.feedback,
            new_feedback=feedback,
        )
        db.session.add(audit)
        grade.grade = grade_value
        grade.feedback = feedback
        if published and not grade.published:
            grade.published_at = now
        elif not published:
            grade.published_at = None
        grade.published = published

    db.session.commit()
    result = {
        "id": grade.id,
        "student_id": grade.student_id,
        "project_id": grade.project_id,
        "grade": float(grade.grade) if grade.grade is not None else None,
        "feedback": grade.feedback,
        "published": grade.published,
        "published_at": grade.published_at.isoformat() if grade.published_at else None,
    }
    if published:
        emit_grade_event(result)
    return result
