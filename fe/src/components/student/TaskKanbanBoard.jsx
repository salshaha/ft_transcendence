import { formatDate, statusTone } from "../instructor/formatters";

const COLUMNS = [
  { status: "todo", label: "To Do" },
  { status: "in_progress", label: "In Progress" },
  { status: "review", label: "Review" },
  { status: "done", label: "Done" },
];

export default function TaskKanbanBoard({ tasks, loading, onOpen, onMove }) {
  function handleDrop(event, status) {
    event.preventDefault();
    const taskId = Number(event.dataTransfer.getData("text/plain"));
    const task = tasks.find((item) => item.id === taskId);
    if (task && task.status !== status) onMove(task, status);
  }

  return (
    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((column) => {
        const columnTasks = tasks.filter((task) => task.status === column.status);
        return (
          <section
            key={column.status}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleDrop(event, column.status)}
            className="theme-soft flex min-h-[240px] flex-col rounded-2xl border border-[#003C43]/8 p-3"
            aria-label={`${column.label} column`}
          >
            <header className="mb-3 flex items-center justify-between gap-2 px-1">
              <h3 className="text-xs font-extrabold uppercase tracking-wide text-[#003C43]">
                {column.label}
              </h3>
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[#135D66] dark:bg-[#003C43]">
                {columnTasks.length}
              </span>
            </header>

            {loading ? (
              <p className="px-1 text-xs text-[#718b8d]">Loading tasks...</p>
            ) : columnTasks.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#003C43]/15 px-3 py-6 text-center text-xs text-[#718b8d]">
                No tasks in {column.label.toLowerCase()}.
              </p>
            ) : (
              <div className="space-y-3">
                {columnTasks.map((task) => (
                  <article
                    key={task.id}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", String(task.id));
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => onOpen(task)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onOpen(task);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className="theme-surface cursor-grab rounded-xl border border-[#003C43]/10 bg-white p-3 shadow-sm transition hover:border-[#77B0AA] hover:shadow-md active:cursor-grabbing"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-bold leading-5 text-[#003C43]">
                        {task.title}
                      </h4>
                      <span
                        className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase ${statusTone(task.status)}`}
                      >
                        {task.status.replaceAll("_", " ")}
                      </span>
                    </div>
                    {task.description && (
                      <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-[#587376]">
                        {task.description}
                      </p>
                    )}
                    <dl className="mt-3 space-y-1 text-[10px] text-[#718b8d]">
                      <div className="flex justify-between gap-2">
                        <dt className="font-semibold text-[#77B0AA]">Assignee</dt>
                        <dd className="truncate text-right text-[#365c60]">
                          {task.assignee?.name || "Unassigned"}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="font-semibold text-[#77B0AA]">Due</dt>
                        <dd className="text-right text-[#365c60]">
                          {formatDate(task.due_date)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="font-semibold text-[#77B0AA]">Activity</dt>
                        <dd className="text-right text-[#365c60]">
                          {task.comment_count || 0} comments ·{" "}
                          {task.attachment_count || 0} files
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#003C43]/8 pt-2">
                      <span className="truncate text-[10px] text-[#718b8d]">
                        {task.team?.name || "Team"}
                      </span>
                      <select
                        aria-label={`Move ${task.title} to another column`}
                        value={task.status}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => onMove(task, event.target.value)}
                        className="theme-control rounded-md border px-1.5 py-1 text-[10px] font-semibold text-[#135D66]"
                      >
                        {COLUMNS.map((option) => (
                          <option key={option.status} value={option.status}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
