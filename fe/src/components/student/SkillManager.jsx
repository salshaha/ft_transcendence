import { useEffect, useState } from "react";
import Modal from "../instructor/Modal";
import {
  addStudentSkill,
  getAvailableSkills,
  removeStudentSkill,
  updateStudentSkill,
} from "../../services/studentService";
import { PROFICIENCY_LEVELS, proficiencyLabel } from "./studentFormatters";

const CATEGORIES = ["technical", "interpersonal", "artistic", "linguistic", "other"];

function initialForm() {
  return { skillId: "", name: "", category: "other", proficiency_level: 3 };
}

export default function SkillManager({ skills = [], onChanged }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [catalog, setCatalog] = useState([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!modal || modal.mode !== "add") return undefined;
    let active = true;
    setCatalogLoading(true);
    const timer = setTimeout(() => {
      getAvailableSkills({ search: catalogSearch })
        .then((data) => {
          if (active) setCatalog(data.skills || []);
        })
        .catch((requestError) => {
          if (active) setError(requestError.message || "Unable to load skills.");
        })
        .finally(() => {
          if (active) setCatalogLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [modal, catalogSearch]);

  function openAdd() {
    setForm(initialForm());
    setCatalogSearch("");
    setCatalog([]);
    setError("");
    setMessage("");
    setModal({ mode: "add" });
  }

  function openEdit(skill) {
    setForm({
      skillId: skill.skill_id || skill.id,
      name: skill.name,
      category: skill.category,
      proficiency_level: skill.proficiency_level,
    });
    setError("");
    setMessage("");
    setModal({ mode: "edit" });
  }

  async function save() {
    setError("");
    setMessage("");
    if (!Number(form.proficiency_level)) {
      setError("Select a proficiency level.");
      return;
    }
    if (modal.mode === "add" && !form.skillId && !form.name.trim()) {
      setError("Enter a skill name or choose one from the catalog.");
      return;
    }
    setBusy(true);
    try {
      if (modal.mode === "edit") {
        await updateStudentSkill(form.skillId, Number(form.proficiency_level));
        setMessage("Skill updated.");
      } else {
        if (form.skillId) {
          await addStudentSkill({
            skillId: form.skillId,
            proficiencyLevel: Number(form.proficiency_level),
          });
        } else {
          await addStudentSkill({
            name: form.name.trim(),
            category: form.category,
            proficiencyLevel: Number(form.proficiency_level),
          });
        }
        setMessage("Skill saved.");
      }
      if (onChanged) await onChanged();
      setModal(null);
    } catch (requestError) {
      setError(requestError.message || "Unable to save skill.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(skill) {
    const skillId = skill.skill_id || skill.id;
    setRemovingId(skillId);
    setError("");
    setMessage("");
    try {
      await removeStudentSkill(skillId);
      setMessage(`${skill.name} removed.`);
      if (onChanged) await onChanged();
    } catch (requestError) {
      setError(requestError.message || "Unable to remove skill.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-[#003C43]">My skills</h3>
          <p className="text-xs text-[#718b8d]">
            Showcase your technical and interpersonal strengths.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="rounded-xl bg-[#135D66] px-3 py-2 text-xs font-bold text-white shadow-md shadow-[#135D66]/20 transition hover:bg-[#003C43] disabled:opacity-60"
        >
          + Add skill
        </button>
      </div>

      {message ? (
        <div className="mb-3 rounded-xl bg-[#E3FEF7] px-3 py-2 text-xs font-semibold text-[#135D66]">
          {message}
        </div>
      ) : null}
      {error && !modal ? (
        <div className="mb-3 rounded-xl bg-[#fee2e2] px-3 py-2 text-xs font-semibold text-[#991b1b]">
          {error}
        </div>
      ) : null}

      {skills.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#77B0AA]/50 bg-[#f5faf9] px-4 py-6 text-center text-xs text-[#718b8d]">
          No skills yet. Add your first skill to build your profile.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {skills.map((skill) => (
            <div
              key={skill.skill_id || skill.id}
              className="min-w-[150px] rounded-xl border border-[#77B0AA]/35 bg-white px-3 py-2 shadow-sm"
            >
              <div className="text-sm font-bold text-[#003C43]">{skill.name}</div>
              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#77B0AA]">
                {skill.category || "other"}
              </div>
              <div className="mt-1 text-xs font-semibold text-[#135D66]">
                {skill.proficiency_label || proficiencyLabel(skill.proficiency_level)}
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(skill)}
                  className="text-[10px] font-bold text-[#135D66] underline underline-offset-2"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => remove(skill)}
                  disabled={removingId === (skill.skill_id || skill.id)}
                  className="text-[10px] font-bold text-[#dc2626] underline underline-offset-2 disabled:opacity-50"
                >
                  {removingId === (skill.skill_id || skill.id) ? "Removing..." : "Remove"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal ? (
        <Modal
          title={modal.mode === "edit" ? "Edit skill" : "Add a skill"}
          onClose={() => setModal(null)}
        >
          <div className="space-y-4">
            {modal.mode === "add" ? (
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#003C43]">
                  Search existing skills
                </label>
                <input
                  value={catalogSearch}
                  onChange={(event) => setCatalogSearch(event.target.value)}
                  placeholder="e.g. Python"
                  className="w-full rounded-xl border border-[#003C43]/15 bg-white px-3 py-2 text-sm outline-none focus:border-[#135D66]"
                />
                <div className="mt-2 max-h-40 overflow-auto rounded-xl border border-[#003C43]/10 bg-[#f5faf9] p-2">
                  {catalogLoading ? (
                    <p className="px-2 py-1 text-xs text-[#718b8d]">Loading skills...</p>
                  ) : catalog.length ? (
                    catalog.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            skillId: item.id,
                            name: item.name,
                            category: item.category,
                          }))
                        }
                        className={`mb-1 flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition ${
                          form.skillId === item.id
                            ? "bg-[#135D66] text-white"
                            : "text-[#003C43] hover:bg-[#E3FEF7]"
                        }`}
                      >
                        <span className="font-bold">{item.name}</span>
                        <span className="opacity-70">{item.category}</span>
                      </button>
                    ))
                  ) : (
                    <p className="px-2 py-1 text-xs text-[#718b8d]">
                      No catalog match. You can create a new skill below.
                    </p>
                  )}
                </div>
              </div>
            ) : null}

            {modal.mode === "edit" || form.skillId ? (
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#003C43]">Skill</label>
                <input
                  value={form.name}
                  readOnly
                  className="w-full rounded-xl border border-[#003C43]/10 bg-[#f5faf9] px-3 py-2 text-sm font-semibold text-[#003C43]"
                />
                {modal.mode === "add" ? (
                  <button
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, skillId: "" }))}
                    className="mt-1 text-[11px] font-bold text-[#135D66] underline"
                  >
                    Choose a different skill
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[#003C43]">
                    New skill name
                  </label>
                  <input
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, name: event.target.value }))
                    }
                    className="w-full rounded-xl border border-[#003C43]/15 bg-white px-3 py-2 text-sm outline-none focus:border-[#135D66]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[#003C43]">
                    Category
                  </label>
                  <select
                    value={form.category}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, category: event.target.value }))
                    }
                    className="w-full rounded-xl border border-[#003C43]/15 bg-white px-3 py-2 text-sm outline-none focus:border-[#135D66]"
                  >
                    {CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#003C43]">
                Proficiency
              </label>
              <select
                value={form.proficiency_level}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    proficiency_level: Number(event.target.value),
                  }))
                }
                className="w-full rounded-xl border border-[#003C43]/15 bg-white px-3 py-2 text-sm outline-none focus:border-[#135D66]"
              >
                {PROFICIENCY_LEVELS.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.value} · {level.label}
                  </option>
                ))}
              </select>
            </div>

            {error ? (
              <div className="rounded-xl bg-[#fee2e2] px-3 py-2 text-xs font-semibold text-[#991b1b]">
                {error}
              </div>
            ) : null}

            <div className="flex justify-end gap-2 border-t border-[#003C43]/8 pt-4">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-xl border border-[#003C43]/15 px-4 py-2 text-sm font-bold text-[#003C43] transition hover:bg-[#E3FEF7]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={busy}
                className="rounded-xl bg-[#135D66] px-4 py-2 text-sm font-bold text-white shadow-md shadow-[#135D66]/20 transition hover:bg-[#003C43] disabled:opacity-60"
              >
                {busy ? "Saving..." : modal.mode === "edit" ? "Update" : "Save"}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
