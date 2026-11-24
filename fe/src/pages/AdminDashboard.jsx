import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  downloadAdminAnalytics,
  downloadAdminAnalyticsPdf,
  downloadAdminData,
  getAdminAnalytics,
  importAdminData,
  subscribeToAdminAnalytics,
} from "../services/adminService";

const SERIES = {
  users: { label: "New accounts", color: "#0f766e" },
  teams: { label: "Teams created", color: "#2563eb" },
  tasks: { label: "Tasks created", color: "#9333ea" },
  submissions: { label: "Submissions", color: "#ea580c" },
  activity_events: { label: "User actions", color: "#0e7490" },
};

function LineChart({ rows, metric }) {
  const width = 760;
  const height = 260;
  const pad = { top: 18, right: 18, bottom: 36, left: 38 };
  const values = rows.map((row) => row[metric]);
  const maxValue = Math.max(1, ...values);
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const points = rows.map((row, index) => ({
    x: pad.left + (rows.length < 2 ? innerWidth / 2 : (index / (rows.length - 1)) * innerWidth),
    y: pad.top + innerHeight - (row[metric] / maxValue) * innerHeight,
    ...row,
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = points.length
    ? `${points[0].x},${pad.top + innerHeight} ${line} ${points.at(-1).x},${pad.top + innerHeight}`
    : "";
  const labelIndexes = [...new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1])];

  return (
    <svg className="h-auto w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${SERIES[metric].label} by day`}>
      {[0, 0.5, 1].map((fraction) => {
        const y = pad.top + innerHeight * fraction;
        return <g key={fraction}><line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#e5eeeb" /><text x={pad.left - 9} y={y + 4} textAnchor="end" fill="#718b85" fontSize="11">{Math.round(maxValue * (1 - fraction))}</text></g>;
      })}
      {area && <polygon points={area} fill={SERIES[metric].color} opacity=".09" />}
      {points.length > 1 && <polyline points={line} fill="none" stroke={SERIES[metric].color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
      {points.map((point) => <circle key={point.date} cx={point.x} cy={point.y} r="3.5" fill="white" stroke={SERIES[metric].color} strokeWidth="2"><title>{`${point.date}: ${point[metric]}`}</title></circle>)}
      {labelIndexes.map((index) => points[index] && <text key={points[index].date} x={points[index].x} y={height - 8} textAnchor={index === 0 ? "start" : index === rows.length - 1 ? "end" : "middle"} fill="#718b85" fontSize="11">{points[index].date.slice(5)}</text>)}
    </svg>
  );
}

function BarBreakdown({ items, colors }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return <div className="space-y-4">{items.length ? items.map((item, index) => <div key={item.role || item.status}>
    <div className="mb-1.5 flex justify-between gap-3 text-sm"><span className="capitalize text-[#3f5c57]">{(item.role || item.status).replaceAll("_", " ")}</span><strong className="text-[#173d38]">{item.count}</strong></div>
    <div className="h-2.5 overflow-hidden rounded-full bg-[#edf3f1]"><div className="h-full rounded-full" style={{ width: `${(item.count / max) * 100}%`, backgroundColor: colors[index % colors.length] }} /></div>
  </div>) : <p className="text-sm text-[#718b85]">No data for this breakdown yet.</p>}</div>;
}

function shiftDate(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

export default function AdminDashboard({ onLogout }) {
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(() => shiftDate(new Date(`${today}T00:00:00Z`), -29));
  const [endDate, setEndDate] = useState(today);
  const [metric, setMetric] = useState("users");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [dataEntity, setDataEntity] = useState("users");
  const [dataFile, setDataFile] = useState(null);
  const [dataBusy, setDataBusy] = useState(false);
  const [dataMessage, setDataMessage] = useState("");
  const [liveStatus, setLiveStatus] = useState("connecting");
  const refreshRef = useRef(null);

  const range = useMemo(() => ({ start_date: startDate, end_date: endDate }), [startDate, endDate]);
  const refresh = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const next = await getAdminAnalytics(range);
      setData(next);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    refresh(true);
  }, [refresh]);

  useEffect(() => {
    const connection = subscribeToAdminAnalytics(
      () => refreshRef.current?.(),
      setLiveStatus,
    );
    const fallbackTimer = window.setInterval(() => {
      if (!connection.isConnected()) refreshRef.current?.();
    }, 30000);
    return () => {
      window.clearInterval(fallbackTimer);
      connection.close();
    };
  }, []);

  async function exportCsv() {
    setExporting(true);
    try {
      const blob = await downloadAdminAnalytics(range);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `platform-analytics-${startDate}-${endDate}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setExporting(false);
    }
  }

  async function exportPdf() {
    setExporting(true);
    try {
      const blob = await downloadAdminAnalyticsPdf(range);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `platform-analytics-${startDate}-${endDate}.pdf`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setExporting(false);
    }
  }

  async function exportData(format) {
    setDataBusy(true);
    setDataMessage("");
    try {
      const blob = await downloadAdminData(dataEntity, format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${dataEntity}-export.${format}`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDataMessage(`${dataEntity} export downloaded.`);
    } catch (requestError) {
      setDataMessage(requestError.message);
    } finally {
      setDataBusy(false);
    }
  }

  async function importData() {
    if (!dataFile) {
      setDataMessage("Choose a CSV or JSON file first.");
      return;
    }
    if (!window.confirm(`Import records from ${dataFile.name}? The batch will be rejected if any row is invalid.`)) return;
    setDataBusy(true);
    setDataMessage("");
    try {
      const result = await importAdminData(dataEntity, dataFile);
      setDataMessage(result.message);
      setDataFile(null);
      const input = document.getElementById("admin-data-import-file");
      if (input) input.value = "";
      refreshRef.current?.();
    } catch (requestError) {
      setDataMessage(requestError.message);
    } finally {
      setDataBusy(false);
    }
  }

  const cards = data ? [
    ["Total users", data.totals.users, `${data.period.users} joined in range`],
    ["Courses", data.totals.courses, `${data.totals.students} students`],
    ["Teams", data.totals.teams, `${data.period.teams} created in range`],
    ["Submissions", data.totals.submissions, `${data.period.submissions} in range`],
  ] : [];

  return <main className="min-h-screen bg-[#f3f8f6] px-5 py-8 text-[#173d38] sm:px-8 lg:px-12">
    <div className="mx-auto max-w-7xl">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div><p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-[#4f8980]">Platform overview</p><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Analytics dashboard</h1><p className="mt-2 text-sm text-[#718b85]">Platform activity and engagement at a glance.</p></div>
        <button onClick={onLogout} className="rounded-xl border border-[#d8e5e1] bg-white px-4 py-2.5 text-sm font-semibold text-[#41615b] hover:bg-[#f8fbfa]">Sign out</button>
      </header>

      <section className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-[#dfeae6] bg-white p-4 shadow-sm" aria-label="Analytics filters">
        <label className="grid gap-1 text-xs font-semibold text-[#56736d]">From<input type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} className="rounded-lg border border-[#dce7e3] px-3 py-2 text-sm text-[#173d38]" /></label>
        <label className="grid gap-1 text-xs font-semibold text-[#56736d]">To<input type="date" value={endDate} min={startDate} max={today} onChange={(event) => setEndDate(event.target.value)} className="rounded-lg border border-[#dce7e3] px-3 py-2 text-sm text-[#173d38]" /></label>
        <div className="flex flex-wrap gap-2">
          {[7, 30, 90].map((days) => <button key={days} onClick={() => { setStartDate(shiftDate(new Date(`${today}T00:00:00Z`), -(days - 1))); setEndDate(today); }} className="rounded-lg bg-[#edf6f3] px-3 py-2 text-xs font-semibold text-[#28675d] hover:bg-[#dff0ea]">{days} days</button>)}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button onClick={exportCsv} disabled={!data || exporting} className="rounded-lg bg-[#075e54] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#064e46] disabled:opacity-50">{exporting ? "Preparing…" : "Export CSV"}</button>
          <button onClick={exportPdf} disabled={!data || exporting} className="rounded-lg border border-[#cdded9] bg-white px-4 py-2.5 text-sm font-semibold text-[#28675d] hover:bg-[#f8fbfa] disabled:opacity-50">Export PDF</button>
        </div>
      </section>

      {error && <p className="mb-5 rounded-xl border border-[#f0d2d2] bg-white p-4 text-sm text-[#a94646]" role="alert">{error}</p>}
      {loading && !data ? <p className="py-20 text-center text-sm text-[#718b85]" role="status">Loading platform analytics…</p> : data && <>
        <section className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Platform totals">
          {cards.map(([label, value, note]) => <article key={label} className="rounded-2xl border border-[#dfeae6] bg-white p-5 shadow-sm"><p className="text-sm font-medium text-[#718b85]">{label}</p><p className="mt-2 text-3xl font-bold tracking-tight">{value.toLocaleString()}</p><p className="mt-2 text-xs text-[#4f8980]">{note}</p></article>)}
        </section>

        <section className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(290px,1fr)]">
          <article className="rounded-2xl border border-[#dfeae6] bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold">Activity over time</h2><p className="mt-1 text-xs text-[#718b85]">Daily records created during the selected period</p></div><select aria-label="Activity type" value={metric} onChange={(event) => setMetric(event.target.value)} className="rounded-lg border border-[#dce7e3] bg-white px-3 py-2 text-sm">{Object.entries(SERIES).map(([key, series]) => <option key={key} value={key}>{series.label}</option>)}</select></div>
            <LineChart rows={data.timeline} metric={metric} />
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#718b85]"><span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES[metric].color }} />{SERIES[metric].label}<span className="ml-auto flex items-center gap-2" aria-live="polite"><span className={`h-2 w-2 rounded-full ${liveStatus === "connected" ? "bg-emerald-500" : "bg-amber-500"}`} />{liveStatus === "connected" ? "Live updates connected" : "Reconnecting · refresh fallback every 30 seconds"}</span></div>
          </article>
          <article className="rounded-2xl border border-[#dfeae6] bg-white p-5 shadow-sm sm:p-6"><h2 className="font-bold">User activity</h2><p className="mb-5 mt-1 text-xs text-[#718b85]">New records and tracked account actions in this period</p><div className="grid grid-cols-2 gap-3">{[["New users", data.period.users], ["New teams", data.period.teams], ["New tasks", data.period.tasks], ["Submissions", data.period.submissions], ["Actions logged", data.activity_count]].map(([label, value]) => <div key={label} className="rounded-xl bg-[#f3f8f6] p-4"><div className="text-2xl font-bold">{value.toLocaleString()}</div><div className="mt-1 text-xs text-[#718b85]">{label}</div></div>)}</div></article>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          <article className="rounded-2xl border border-[#dfeae6] bg-white p-5 shadow-sm sm:p-6"><h2 className="mb-1 font-bold">Users by role</h2><p className="mb-5 text-xs text-[#718b85]">Current account mix</p><BarBreakdown items={data.user_roles} colors={["#0f766e", "#2563eb", "#9333ea"]} /></article>
          <article className="rounded-2xl border border-[#dfeae6] bg-white p-5 shadow-sm sm:p-6"><h2 className="mb-1 font-bold">Tasks by status</h2><p className="mb-5 text-xs text-[#718b85]">Current work distribution</p><BarBreakdown items={data.task_statuses} colors={["#94a3b8", "#2563eb", "#0f766e", "#f59e0b"]} /></article>
        </section>
        <section className="mt-5 rounded-2xl border border-[#dfeae6] bg-white p-5 shadow-sm sm:p-6" aria-label="Platform data import and export">
          <div className="mb-4"><h2 className="font-bold">Platform data</h2><p className="mt-1 text-xs text-[#718b85]">Export or import up to 500 user or course records. Passwords are never included in exports; user imports require a password for every account.</p></div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-xs font-semibold text-[#56736d]">Data type<select value={dataEntity} onChange={(event) => { setDataEntity(event.target.value); setDataMessage(""); }} className="rounded-lg border border-[#dce7e3] bg-white px-3 py-2 text-sm text-[#173d38]"><option value="users">Users</option><option value="courses">Courses</option></select></label>
            <button onClick={() => exportData("csv")} disabled={dataBusy} className="rounded-lg border border-[#cdded9] bg-white px-4 py-2.5 text-sm font-semibold text-[#28675d] hover:bg-[#f8fbfa] disabled:opacity-50">Export CSV</button>
            <button onClick={() => exportData("json")} disabled={dataBusy} className="rounded-lg border border-[#cdded9] bg-white px-4 py-2.5 text-sm font-semibold text-[#28675d] hover:bg-[#f8fbfa] disabled:opacity-50">Export JSON</button>
            <label className="grid gap-1 text-xs font-semibold text-[#56736d]">Import CSV or JSON<input id="admin-data-import-file" type="file" accept=".csv,.json,application/json,text/csv" onChange={(event) => { setDataFile(event.target.files?.[0] || null); setDataMessage(""); }} className="max-w-xs rounded-lg border border-[#dce7e3] px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#edf6f3] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#28675d]" /></label>
            <button onClick={importData} disabled={dataBusy || !dataFile} className="rounded-lg bg-[#075e54] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#064e46] disabled:opacity-50">{dataBusy ? "Working…" : "Import batch"}</button>
          </div>
          {dataMessage && <p className="mt-3 text-sm text-[#41615b]" role="status">{dataMessage}</p>}
        </section>
        <section className="mt-5 rounded-2xl border border-[#dfeae6] bg-white p-5 shadow-sm sm:p-6" aria-label="Recent user activity">
          <div className="mb-4"><h2 className="font-bold">Recent activity</h2><p className="mt-1 text-xs text-[#718b85]">Successful sign-ins and key changes by users and administrators in the selected date range.</p></div>
          {data.recent_activity.length ? <ul className="divide-y divide-[#edf3f1]">{data.recent_activity.map((event) => <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"><p className="text-sm text-[#3f5c57]"><strong className="font-semibold text-[#173d38]">{event.actor_name}</strong>{" "}{event.action.replaceAll("_", " ")}{event.entity_type !== "session" && <span className="text-[#718b85]"> · {event.entity_type.replaceAll("_", " ")}{event.entity_id ? ` #${event.entity_id}` : ""}</span>}</p><time dateTime={event.occurred_at} className="text-xs text-[#718b85]">{new Date(event.occurred_at).toLocaleString()}</time></li>)}</ul> : <p className="text-sm text-[#718b85]">No recorded activity in this date range yet.</p>}
        </section>
        <p className="mt-5 text-right text-xs text-[#8aa09b]">Range: {data.start_date} to {data.end_date}</p>
      </>}
    </div>
  </main>;
}
