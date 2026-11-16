import { useEffect, useState } from "react";
import { getInstructorDashboard } from "../services/instructorService";
import "./instructorDashboard.css";

function Section({ title, children }) {
  return <section className="dashboard-section"><h2>{title}</h2>{children}</section>;
}

function Empty({ children = "No data available yet." }) {
  return <p className="dashboard-empty">{children}</p>;
}

export default function InstructorDashboard({ onLogout }) {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getInstructorDashboard()
      .then((data) => {
        if (active) setDashboard(data);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      });
    return () => {
      active = false;
    };
  }, []);

  async function logout() {
    await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    onLogout();
  }

  if (error) {
    return <main className="dashboard-page"><p className="dashboard-error" role="alert">{error}</p></main>;
  }
  if (!dashboard) {
    return <main className="dashboard-page"><p className="dashboard-loading" role="status">Loading your dashboard...</p></main>;
  }

  const { instructor, courses, deadlines, students, projects, submissions, resources } = dashboard;
  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">INSTRUCTOR DASHBOARD</p>
          <h1>Welcome, {instructor.first_name}.</h1>
          <p>{instructor.email}</p>
        </div>
        <button className="dashboard-logout" onClick={logout}>Sign out</button>
      </header>

      <div className="dashboard-grid">
        <Section title="My Courses">
          {courses.length === 0 ? <Empty /> : <div className="dashboard-list">{courses.map((course) => (
            <article className="dashboard-card" key={course.id}>
              <strong>{course.name}</strong>
              <span>{course.code || "No course code"} · {course.student_count} students</span>
            </article>
          ))}</div>}
        </Section>

        <Section title="Project Deadlines">
          {deadlines.length === 0 ? <Empty /> : <div className="dashboard-list">{deadlines.map((deadline) => (
            <article className="dashboard-card" key={deadline.id}>
              <strong>{deadline.title}</strong>
              <span>{deadline.course.name} · {deadline.team.name}</span>
              <time dateTime={deadline.due_date}>{new Date(deadline.due_date).toLocaleString()}</time>
            </article>
          ))}</div>}
        </Section>

        <Section title="Students">
          {students.length === 0 ? <Empty /> : <div className="dashboard-list">{students.map((student) => (
            <article className="dashboard-card" key={student.id}>
              <strong>{student.full_name}</strong><span>{student.email}</span>
            </article>
          ))}</div>}
        </Section>

        <Section title="Projects">
          {projects.length === 0 ? <Empty /> : <div className="dashboard-list">{projects.map((project) => (
            <article className="dashboard-card" key={project.id}>
              <strong>{project.course.name}</strong>
              <span>{project.team_count} teams · up to {project.max_members_per_team} members per team</span>
            </article>
          ))}</div>}
        </Section>

        <Section title="Submissions to Review">
          {!submissions.available ? <Empty>{submissions.reason}</Empty> : <Empty />}
        </Section>
        <Section title="Resources">
          {!resources.available ? <Empty>{resources.reason}</Empty> : <Empty />}
        </Section>
      </div>
    </main>
  );
}
