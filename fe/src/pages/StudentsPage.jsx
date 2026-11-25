import { useEffect, useState } from "react";
import Modal from "../components/instructor/Modal";
import Avatar from "../components/student/Avatar";
import { formatLastSeen, proficiencyLabel, resolvePresence } from "../components/student/studentFormatters";
import {
  getAvailableSkills,
  getStudentCourses,
  getStudentPublicProfile,
  getStudents,
} from "../services/studentService";

export default function StudentsPage({ presence }) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [skillId, setSkillId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ students: [], total: 0, pages: 0, page: 1 });
  const [skills, setSkills] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    let active = true;
    getAvailableSkills()
      .then((result) => {
        if (active) setSkills(result.skills || []);
      })
      .catch(() => {});
    getStudentCourses()
      .then((result) => {
        if (active) setCourses(result.courses || []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, skillId, courseId]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError("");
    getStudents({
      search: debouncedQuery,
      skillId,
      courseId,
      page,
      signal: controller.signal,
    })
      .then((result) => {
        if (active) setData(result);
      })
      .catch((requestError) => {
        if (active && requestError.name !== "AbortError") {
          setError(requestError.message || "Unable to load students.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [debouncedQuery, skillId, courseId, page]);

  async function openProfile(student) {
    setSelected(student);
    setProfile(null);
    setProfileError("");
    setProfileLoading(true);
    try {
      const result = await getStudentPublicProfile(student.id);
      setProfile(result.student);
    } catch (requestError) {
      setProfileError(requestError.message || "Unable to load this profile.");
    } finally {
      setProfileLoading(false);
    }
  }

  const students = data.students || [];

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-[#003C43]">Students</h2>
          <p className="mt-1 text-sm text-[#718b8d]">
            Discover classmates, see their skills, and connect by course or project.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-[#77B0AA]/35 bg-white px-3 py-2 text-xs font-bold text-[#135D66]">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              presence?.connected ? "bg-[#22c55e]" : "bg-[#9ca3af]"
            }`}
          />
          {presence?.connected ? "Live presence" : "Presence unavailable"}
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-[#003C43]/8 bg-white p-4 shadow-sm sm:grid-cols-3">
        <label className="block text-xs font-bold text-[#003C43]">
          Search
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name"
            className="mt-1.5 w-full rounded-xl border border-[#003C43]/15 px-3 py-2 text-sm outline-none focus:border-[#135D66]"
          />
        </label>
        <label className="block text-xs font-bold text-[#003C43]">
          Skill
          <select
            value={skillId}
            onChange={(event) => setSkillId(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-[#003C43]/15 bg-white px-3 py-2 text-sm outline-none focus:border-[#135D66]"
          >
            <option value="">All skills</option>
            {skills.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-bold text-[#003C43]">
          Course
          <select
            value={courseId}
            onChange={(event) => setCourseId(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-[#003C43]/15 bg-white px-3 py-2 text-sm outline-none focus:border-[#135D66]"
          >
            <option value="">All shared courses</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <div className="rounded-2xl bg-[#fee2e2] px-4 py-3 text-sm font-semibold text-[#991b1b]">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid place-items-center rounded-2xl border border-[#003C43]/8 bg-white py-16 text-sm font-semibold text-[#718b8d]">
          Loading students...
        </div>
      ) : students.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#77B0AA]/50 bg-[#f5faf9] px-4 py-12 text-center text-sm text-[#718b8d]">
          No students match these filters.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {students.map((student) => {
            const status = resolvePresence(presence, student);
            const online = status.online;
            return (
              <button
                key={student.id}
                type="button"
                onClick={() => openProfile(student)}
                className="group rounded-2xl border border-[#003C43]/8 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#77B0AA] hover:shadow-lg"
              >
                <div className="flex items-start gap-3">
                  <Avatar
                    user={student}
                    showPresence
                    presence={{ online }}
                    className="h-12 w-12"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-extrabold text-[#003C43]">
                      {student.full_name}
                    </div>
                    <div className="truncate text-xs text-[#718b8d]">
                      {student.major || student.domain || "Student"}
                    </div>
                  </div>
                  <span className="text-[#77B0AA] transition group-hover:translate-x-0.5">
                    →
                  </span>
                </div>
                <div className="mt-1 text-[11px] font-semibold text-[#135D66]">
                  {online ? "Online now" : formatLastSeen(status.last_seen)}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(student.skills || []).slice(0, 4).map((skill, index) => (
                    <span
                      key={`${skill.id || skill.name}-${index}`}
                      className="rounded-lg bg-[#E3FEF7] px-2 py-1 text-[10px] font-bold text-[#135D66]"
                      title={skill.proficiency_label || proficiencyLabel(skill.proficiency_level)}
                    >
                      {skill.name}
                    </span>
                  ))}
                  {(student.skills || []).length === 0 ? (
                    <span className="text-[10px] text-[#9ca3af]">No skills listed</span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {data.pages > 1 ? (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="rounded-xl border border-[#003C43]/15 bg-white px-3 py-2 text-xs font-bold text-[#003C43] disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs font-bold text-[#718b8d]">
            Page {data.page} of {data.pages} · {data.total} students
          </span>
          <button
            type="button"
            disabled={page >= data.pages}
            onClick={() => setPage((current) => Math.min(data.pages, current + 1))}
            className="rounded-xl border border-[#003C43]/15 bg-white px-3 py-2 text-xs font-bold text-[#003C43] disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}

      {selected ? (
        <Modal
          title={`${selected.full_name || "Student"} profile`}
          onClose={() => {
            setSelected(null);
            setProfile(null);
            setProfileError("");
          }}
        >
          {profileLoading ? (
            <div className="grid place-items-center py-12 text-sm font-semibold text-[#718b8d]">
              Loading profile...
            </div>
          ) : profile ? (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <Avatar
                  user={profile}
                  showPresence
                  presence={{
                    online: resolvePresence(presence, profile).online,
                  }}
                  className="h-16 w-16"
                />
                <div>
                  <div className="text-lg font-black text-[#003C43]">
                    {profile.full_name}
                  </div>
                  <div className="text-xs text-[#718b8d]">
                    {profile.major || profile.domain || "Student"}
                    {profile.joined_year ? ` · Class of ${profile.joined_year}` : ""}
                  </div>
                  <div className="mt-1 text-[11px] font-bold text-[#135D66]">
                    {resolvePresence(presence, profile).online
                      ? "Online now"
                      : formatLastSeen(resolvePresence(presence, profile).last_seen)}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[#77B0AA]">
                  Skills
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(profile.skills || []).map((skill, index) => (
                    <span
                      key={`${skill.id}-${index}`}
                      className="rounded-xl border border-[#77B0AA]/35 bg-[#f5faf9] px-2.5 py-1.5 text-xs font-semibold text-[#003C43]"
                    >
                      {skill.name} · {skill.proficiency_label || proficiencyLabel(skill.proficiency_level)}
                    </span>
                  ))}
                  {(profile.skills || []).length === 0 ? (
                    <span className="text-xs text-[#9ca3af]">No skills listed.</span>
                  ) : null}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[#77B0AA]">
                  Shared courses
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(profile.courses || []).map((course) => (
                    <span
                      key={course.id}
                      className="rounded-xl bg-[#E3FEF7] px-2.5 py-1.5 text-xs font-bold text-[#135D66]"
                    >
                      {course.name}
                    </span>
                  ))}
                  {(profile.courses || []).length === 0 ? (
                    <span className="text-xs text-[#9ca3af]">No shared courses.</span>
                  ) : null}
                </div>
              </div>

              {profile.current_project ? (
                <div className="rounded-2xl border border-[#003C43]/8 bg-[#f5faf9] p-4">
                  <h3 className="text-xs font-extrabold uppercase tracking-wide text-[#77B0AA]">
                    Current project
                  </h3>
                  <div className="mt-1 text-sm font-bold text-[#003C43]">
                    {profile.current_project.title}
                  </div>
                  {profile.current_project.team ? (
                    <div className="mt-1 text-xs text-[#718b8d]">
                      Team: {profile.current_project.team.name}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl bg-[#fee2e2] px-4 py-3 text-sm font-semibold text-[#991b1b]">
              {profileError || "Profile unavailable."}
            </div>
          )}
        </Modal>
      ) : null}
    </section>
  );
}
