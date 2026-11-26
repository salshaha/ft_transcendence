import { useEffect, useMemo, useState } from "react";
import { useRealtimeEvent, useTeamRealtime } from "../../hooks/useTeamRealtime";
import { upsertById } from "../../services/realtimeReducers";
import {
  getTeamChats,
  getTeamMessages,
  sendTeamMessage,
} from "../../services/studentService";
import Avatar from "./Avatar";

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TeamChatPanel({ currentUserId }) {
  const [chats, setChats] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [chatsError, setChatsError] = useState("");
  const [messagesError, setMessagesError] = useState("");
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");

  const teamIds = useMemo(
    () => chats.map((chat) => chat.team_id).filter(Boolean),
    [chats],
  );

  async function loadChats() {
    try {
      const data = await getTeamChats();
      const loaded = Array.isArray(data.chats) ? data.chats : [];
      setChats(loaded);
      setSelectedTeamId((current) => current ?? loaded[0]?.team_id ?? null);
      setChatsError("");
    } catch (error) {
      setChatsError(error.message || "Unable to load your team chats.");
    } finally {
      setLoadingChats(false);
    }
  }

  async function loadMessages(teamId) {
    setLoadingMessages(true);
    setMessagesError("");
    try {
      const data = await getTeamMessages(teamId);
      setMessages(Array.isArray(data.messages) ? data.messages : []);
    } catch (error) {
      setMessages(error.message || "Unable to load this conversation.");
    } finally {
      setLoadingMessages(false);
    }
  }

  useEffect(() => {
    loadChats();
  }, []);

  useEffect(() => {
    if (!selectedTeamId && chats.length) {
      setSelectedTeamId(chats[0].team_id);
    }
  }, [chats, selectedTeamId]);

  useEffect(() => {
    if (!selectedTeamId) {
      setMessages([]);
      return;
    }
    loadMessages(selectedTeamId);
    loadChats();
  }, [selectedTeamId]);

  useTeamRealtime(teamIds, (event, payload) => {
    if (event !== "message_created" || !payload?.message) return;
    const teamId = Number(payload.team_id);
    if (teamId === Number(selectedTeamId)) {
      setMessages((items) => upsertById(items, payload.message));
    } else {
      setChats((items) =>
        items.map((chat) =>
          Number(chat.team_id) === teamId
            ? {
                ...chat,
                last_message: payload.message,
                unread_count: Number(chat.unread_count || 0) + 1,
              }
            : chat,
        ),
      );
    }
    loadChats();
  });

  useRealtimeEvent("team_access_revoked", (payload) => {
    const teamId = Number(payload?.team_id);
    if (teamId === Number(selectedTeamId)) {
      setSelectedTeamId(null);
      setMessages([]);
      setNotice("You no longer have access to that team conversation.");
    }
    loadChats();
  });

  async function handleSend(event) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !selectedTeamId || sending) return;
    setSending(true);
    setMessagesError("");
    try {
      const data = await sendTeamMessage(selectedTeamId, content);
      setMessages((items) => upsertById(items, data.message));
      setDraft("");
      loadChats();
    } catch (error) {
      setMessagesError(error.message || "Unable to send this message.");
    } finally {
      setSending(false);
    }
  }

  const selectedChat = chats.find(
    (chat) => Number(chat.team_id) === Number(selectedTeamId),
  );

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-[#003C43]">Team Chats</h2>
          <p className="mt-1 text-sm text-[#718b8d]">
            Private group conversations for every team you belong to.
          </p>
        </div>
      </div>

      {notice ? (
        <div className="rounded-xl bg-[#E3FEF7] px-3 py-2 text-xs font-semibold text-[#135D66]" role="status">
          {notice}
        </div>
      ) : null}
      {chatsError ? (
        <div className="rounded-xl bg-[#fee2e2] px-3 py-2 text-xs font-semibold text-[#991b1b]" role="alert">
          {chatsError}
        </div>
      ) : null}

      {loadingChats ? (
        <div className="grid place-items-center rounded-2xl border border-[#003C43]/8 bg-white py-16 text-sm font-semibold text-[#718b8d]">
          Loading your team chats...
        </div>
      ) : chats.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#77B0AA]/50 bg-white p-10 text-center">
          <div className="text-sm font-bold text-[#003C43]">No team conversations yet</div>
          <p className="mt-2 text-xs text-[#718b8d]">
            Join or create a team to start a private group chat.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-2xl border border-[#003C43]/8 bg-white shadow-sm">
            <div className="border-b border-[#003C43]/8 px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-[#77B0AA]">
              Your teams
            </div>
            <div className="max-h-[560px] overflow-y-auto p-2">
              {chats.map((chat) => {
                const active = Number(chat.team_id) === Number(selectedTeamId);
                return (
                  <button
                    key={chat.team_id}
                    type="button"
                    onClick={() => setSelectedTeamId(chat.team_id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                      active
                        ? "bg-[#E3FEF7] text-[#003C43]"
                        : "text-[#135D66] hover:bg-[#f5faf9]"
                    }`}
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#135D66] text-xs font-black text-white">
                      {(chat.name || "T").slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{chat.name}</span>
                      <span className="block truncate text-[11px] text-[#718b8d]">
                        {chat.last_message?.content || "No messages yet"}
                      </span>
                    </span>
                    {Number(chat.unread_count || 0) > 0 ? (
                      <span className="rounded-full bg-[#135D66] px-2 py-0.5 text-[10px] font-black text-white">
                        {chat.unread_count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex min-h-[560px] flex-col overflow-hidden rounded-2xl border border-[#003C43]/8 bg-white shadow-sm">
            {selectedChat ? (
              <>
                <div className="flex flex-wrap items-center gap-3 border-b border-[#003C43]/8 px-5 py-4">
                  <Avatar
                    user={{ first_name: selectedChat.name, last_name: "", profile_picture: null }}
                    className="h-11 w-11"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-base font-black text-[#003C43]">
                      {selectedChat.name}
                    </div>
                    <div className="text-[11px] text-[#718b8d]">
                      {selectedChat.course?.name} · {selectedChat.member_count} member
                      {selectedChat.member_count === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto bg-[#f5faf9] px-5 py-4">
                  {loadingMessages ? (
                    <div className="grid place-items-center py-16 text-sm font-semibold text-[#718b8d]">
                      Loading messages...
                    </div>
                  ) : messagesError ? (
                    <div className="rounded-xl bg-[#fee2e2] px-3 py-2 text-xs font-semibold text-[#991b1b]" role="alert">
                      {messagesError}
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="py-16 text-center text-xs text-[#718b8d]">
                      No messages yet. Start the conversation.
                    </div>
                  ) : (
                    messages.map((message) => {
                      const own = Number(message.sender_id) === Number(currentUserId);
                      return (
                        <article
                          key={message.id}
                          className={`flex ${own ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[78%] rounded-2xl px-4 py-2.5 shadow-sm ${
                              own
                                ? "bg-[#135D66] text-white"
                                : "border border-[#003C43]/8 bg-white text-[#003C43]"
                            }`}
                          >
                            <div
                              className={`flex items-center gap-2 text-[10px] font-bold ${
                                own ? "text-white/75" : "text-[#718b8d]"
                              }`}
                            >
                              <span>{own ? "You" : message.sender?.name || "Former member"}</span>
                              <span>{formatTime(message.created_at)}</span>
                            </div>
                            <div className="mt-1 whitespace-pre-wrap break-words text-sm">
                              {message.content}
                            </div>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>

                <form onSubmit={handleSend} className="border-t border-[#003C43]/8 p-4">
                  <div className="flex items-end gap-3">
                    <textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) handleSend(event);
                      }}
                      rows={2}
                      placeholder="Write a message..."
                      aria-label="Message"
                      className="theme-control min-h-[52px] flex-1 resize-none rounded-xl border border-[#003C43]/15 bg-white px-3 py-2.5 text-sm text-[#003C43] outline-none placeholder:text-[#7d999b]"
                    />
                    <button
                      type="submit"
                      disabled={sending || !draft.trim()}
                      className="rounded-xl bg-[#135D66] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#003C43] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {sending ? "Sending..." : "Send"}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="grid place-items-center p-10 text-center text-sm text-[#718b8d]">
                Select a team to open its conversation.
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
