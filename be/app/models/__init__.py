"""Import every model so Alembic autogenerate sees the complete schema."""

from app.models.communication import FriendRequest, Friendship, TeamMessage
from app.models.grade import Grade, GradeAudit
from app.models.activity_event import ActivityEvent
from app.models.password_reset import PasswordResetToken
from app.models.peer_feedback import PeerFeedback
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
from app.models.submission import Submission
from app.models.task_collaboration import TaskAttachment, TaskComment
from app.models.user import User

__all__ = [
    "ActivityEvent",
    "Course",
    "CourseEnrollment",
    "FriendRequest",
    "Friendship",
    "Grade",
    "GradeAudit",
    "PasswordResetToken",
    "PeerFeedback",
    "Project",
    "Skill",
    "StudentGPA",
    "StudentSkill",
    "Submission",
    "Task",
    "TaskAttachment",
    "TaskComment",
    "Team",
    "TeamMember",
    "TeamMessage",
    "User",
]
