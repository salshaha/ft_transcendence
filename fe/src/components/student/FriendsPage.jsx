import { useEffect, useState } from "react";
import { useRealtimeEvent } from "../../hooks/useTeamRealtime";
import {
  acceptFriendRequest,
  getFriendOverview,
  rejectFriendRequest,
  removeFriend,
  searchFriends,
  sendFriendRequest,
} from "../../services/studentService";
import Avatar from "./Avatar";
import ConfirmDialog from "./ConfirmDialog";
import { formatLastSeen, resolvePresence } from "./studentFormatters";

export default function FriendsPage({ presence }) {
  const [overview, setOverview] = useState({
    friends: [],
    incoming: [],
    outgoing: [],
  });
  const [results, setResults] = useState([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null);

  async function loadOverview() {
    try {
      const data = await getFriendOverview();
      setOverview({
        friends: Array.isArray(data.friends) ? data.friends : [],
        incoming: Array.isArray(data.incoming) ? data.incoming : [],
        outgoing: Array.isArray(data.outgoing) ? data.outgoing : [],
      });
      setError("");
    } catch (requestError) {
      setError(requestError.message || "Unable to load your friends.");
    } finally {
      setLoading(false);
    }
  }

  async function loadResults(search) {
    setSearching(true);
    try {
      const data = await searchFriends(search);
      setResults(Array.isArray(data.students) ? data.students : []);
    } catch (requestError) {
      setError(requestError.message || "Unable to search students.");
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    loadOverview();
    loadResults("");
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    loadResults(debouncedQuery);
  }, [debouncedQuery]);

  useRealtimeEvent("friend_request_received", () => {
    loadOverview();
    loadResults(debouncedQuery);
  });

  useRealtimeEvent("friend_request_accepted", () => {
    loadOverview();
    loadResults(debouncedQuery);
  });

  useRealtimeEvent("friend_request_rejected", () => {
    loadOverview();
    loadResults(debouncedQuery);
  });

  useRealtimeEvent("friend_removed", () => {
    loadOverview();
    loadResults(debouncedQuery);
  });

  async function runAction(key, action, message) {
    setBusyId(key);
    setNotice("");
    setError("");
    try {
      await action();
      setNotice(message);
      await Promise.all([loadOverview(), loadResults(debouncedQuery)]);
    } catch (requestError) {
      setError(requestError.message || "That action could not be completed.");
    } finally {
      setBusyId(null);
    }
  }

  function actionButton(student) {
    if (student.relationship === "friend") {
      return <span className="text-[11px] font-bold text-[#135D66]">Friends</span>;
    }
    if (student.relationship === "outgoing_request") {
      return <span className="text-[11px] font-bold text-[#718b8d]">Pending</span>;
    }
    if (student.relationship === "incoming_request") {
      return (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busyId === student.id}
            onClick={() =>
              runAction(
                student.id,
                () => acceptFriendRequest(student.request_id),
                `You are now friends with ${student.full_name}.`,
              )
            }
            className="rounded-lg bg-[#135D66] px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
          >
            Accept
          </button>
          <button
            type="button"
            disabled={busyId === student.id}
            onClick={() =>
              runAction(
                student.id,
                () => rejectFriendRequest(student.request_id),
                `You rejected ${student.full_name}'s request.`,
              )
            }
            className="rounded-lg border border-[#003C43]/15 px-3 py-1.5 text-[11px] font-bold text-[#003C43] disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      );
    }
    return (
      <button
        type="button"
        disabled={busyId === student.id}
        onClick={() =>
          runAction(
            student.id,
            () => sendFriendRequest(student.id),
            `Friend request sent to ${student.full_name}.`,
          )
        }
        className="rounded-lg bg-[#135D66] px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
      >
        Add Friend
      </button>
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-[#003C43]">Friends</h2>
          <p className="mt-1 text-sm text-[#718b8d]">
            Find classmates, manage requests, and keep your friends list up to date.
          </p>
        </div>
      </div>

      {notice ? (
        <div className="rounded-xl bg-[#E3FEF7] px-3 py-2 text-xs font-semibold text-[#135D66]" role="status">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl bg-[#fee2e2] px-3 py-2 text-xs font-semibold text-[#991b1b]" role="alert">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-[#003C43]/8 bg-white p-4 shadow-sm">
        <label className="mb-2 block text-xs font-bold text-[#003C43]" htmlFor="friend-search">
          Search students
        </label>
        <input
          id="friend-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, student ID, or email"
          className="theme-control w-full rounded-xl border border-[#003C43]/15 bg-white px-3 py-2.5 text-sm text-[#003C43] outline-none placeholder:text-[#7d999b]"
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {searching ? (
            <div className="col-span-full py-8 text-center text-xs text-[#718b8d]">
              Searching students...
            </div>
          ) : results.length === 0 ? (
            <div className="col-span-full py-8 text-center text-xs text-[#718b8d]">
              No students found.
            </div>
          ) : (
            results.map((student) => {
              const status = resolvePresence(presence, student);
              return (
                <div
                  key={student.id}
                  className="flex items-center gap-3 rounded-xl border border-[#003C43]/8 bg-[#f5faf9] p-3"
                >
                  <Avatar user={student} showPresence presence={status} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-[#003C43]">
                      {student.full_name}
                    </div>
                    <div className="truncate text-[11px] text-[#718b8d]">
                      {student.major || student.domain || "Student"}
                    </div>
                  </div>
                  {actionButton(student)}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-[#003C43]/8 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-black text-[#003C43]">Friends</h3>
          {loading ? (
            <p className="text-xs text-[#718b8d]">Loading friends...</p>
          ) : overview.friends.length === 0 ? (
            <p className="text-xs text-[#718b8d]">You have not added any friends yet.</p>
          ) : (
            <div className="space-y-2">
              {overview.friends.map((friend) => {
                const status = resolvePresence(presence, friend);
                return (
                  <div
                    key={friend.id}
                    className="flex items-center gap-2 rounded-xl border border-[#003C43]/8 p-2.5"
                  >
                    <Avatar user={friend} showPresence presence={status} className="h-9 w-9" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-bold text-[#003C43]">
                        {friend.full_name}
                      </div>
                      <div className="truncate text-[10px] text-[#718b8d]">
                        {status.online ? "Online" : formatLastSeen(friend.last_seen)}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={busyId === friend.id}
                      onClick={() => setConfirmRemove(friend)}
                      className="rounded-lg border border-[#dc2626]/30 px-2 py-1 text-[10px] font-bold text-[#dc2626] disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[#003C43]/8 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-black text-[#003C43]">Incoming requests</h3>
          {overview.incoming.length === 0 ? (
            <p className="text-xs text-[#718b8d]">No incoming requests.</p>
          ) : (
            <div className="space-y-2">
              {overview.incoming.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 rounded-xl border border-[#003C43]/8 p-2.5"
                >
                  <Avatar user={item.user} className="h-9 w-9" />
                  <div className="min-w-0 flex-1 truncate text-xs font-bold text-[#003C43]">
                    {item.user?.full_name}
                  </div>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() =>
                      runAction(
                        item.id,
                        () => acceptFriendRequest(item.id),
                        `You are now friends with ${item.user?.full_name}.`,
                      )
                    }
                    className="rounded-lg bg-[#135D66] px-2 py-1 text-[10px] font-bold text-white disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() =>
                      runAction(
                        item.id,
                        () => rejectFriendRequest(item.id),
                        "Friend request rejected.",
                      )
                    }
                    className="rounded-lg border border-[#003C43]/15 px-2 py-1 text-[10px] font-bold text-[#003C43] disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[#003C43]/8 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-black text-[#003C43]">Outgoing requests</h3>
          {overview.outgoing.length === 0 ? (
            <p className="text-xs text-[#718b8d]">No pending outgoing requests.</p>
          ) : (
            <div className="space-y-2">
              {overview.outgoing.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 rounded-xl border border-[#003C43]/8 p-2.5"
                >
                  <Avatar user={item.user} className="h-9 w-9" />
                  <div className="min-w-0 flex-1 truncate text-xs font-bold text-[#003C43]">
                    {item.user?.full_name}
                  </div>
                  <span className="rounded-lg bg-[#E3FEF7] px-2 py-1 text-[10px] font-bold text-[#135D66]">
                    Pending
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {confirmRemove ? (
        <ConfirmDialog
          title="Remove friend?"
          message={`Remove ${confirmRemove.full_name} from your friends list?`}
          confirmLabel="Remove friend"
          destructive
          onClose={() => setConfirmRemove(null)}
          onConfirm={() =>
            runAction(
              confirmRemove.id,
              () => removeFriend(confirmRemove.id),
              `${confirmRemove.full_name} was removed from your friends.`,
            ).then(() => setConfirmRemove(null))
          }
        />
      ) : null}
    </section>
  );
}
