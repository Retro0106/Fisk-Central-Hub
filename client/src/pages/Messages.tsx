import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Search, Send } from "lucide-react";
import { api, errorMessage, type ChatMessage, type ConversationSummary, type PublicUser } from "../api";
import { useUser } from "../UserContext";
import { Avatar, Button, ErrorBanner, PageHeader } from "../components/ui";

const POLL_MS = 5000;

export default function Messages() {
  const { user } = useUser();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const withUserId = Number(params.get("with")) || null;

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [people, setPeople] = useState<PublicUser[]>([]);
  const [filter, setFilter] = useState("");
  const [active, setActive] = useState<{ id: number; other: PublicUser } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState((location.state as { draft?: string } | null)?.draft ?? "");
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(
    () => api.get<ConversationSummary[]>("/conversations").then((res) => setConversations(res.data)),
    [],
  );

  useEffect(() => {
    loadConversations();
    api.get<PublicUser[]>("/users").then((res) => setPeople(res.data));
  }, [loadConversations]);

  useEffect(() => {
    if (!withUserId) return;
    api
      .post<{ conversation_id: number; other_user: PublicUser }>("/conversations", { other_user_id: withUserId })
      .then((res) => setActive({ id: res.data.conversation_id, other: res.data.other_user }))
      .catch((err) => setError(errorMessage(err)));
  }, [withUserId]);

  useEffect(() => {
    if (!active) return;
    const load = () =>
      api.get<ChatMessage[]>(`/conversations/${active.id}/messages`).then((res) => setMessages(res.data));
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [active]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!active || !draft.trim()) return;
    try {
      const res = await api.post<ChatMessage>(`/conversations/${active.id}/messages`, { content: draft });
      setMessages((prev) => [...prev, res.data]);
      setDraft("");
      loadConversations();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const open = (other: PublicUser) => setParams({ with: String(other.id) });

  const q = filter.toLowerCase();
  const startedIds = new Set(conversations.map((c) => c.other_user.id));
  const shownConversations = conversations.filter((c) => c.other_user.name.toLowerCase().includes(q));
  const shownPeople = q ? people.filter((p) => !startedIds.has(p.id) && p.name.toLowerCase().includes(q)) : [];

  return (
    <div>
      <PageHeader title="Messages" subtitle="Chat with buyers, sellers, and tutors." />
      <ErrorBanner message={error} />
      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-260px)] min-h-[480px]">
        <aside className="col-span-12 md:col-span-4 bg-slate-900/70 border border-slate-800 rounded-2xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-800 relative">
            <Search className="w-4 h-4 absolute left-7 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search people"
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {shownConversations.map((c) => (
              <button
                key={c.id}
                onClick={() => open(c.other_user)}
                className={`w-full p-4 flex items-center gap-3 text-left border-b border-slate-800/60 hover:bg-slate-800/50 ${
                  active?.id === c.id ? "bg-slate-800" : ""
                }`}
              >
                <Avatar name={c.other_user.name} size="sm" />
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate">{c.other_user.name}</p>
                  <p className="text-sm text-slate-400 truncate">
                    {c.last_message ? `${c.last_message.sender_id === user?.id ? "You: " : ""}${c.last_message.content}` : "No messages yet"}
                  </p>
                </div>
              </button>
            ))}
            {shownPeople.length > 0 && <p className="px-4 pt-4 pb-2 text-xs uppercase text-slate-500 font-semibold">Start a conversation</p>}
            {shownPeople.map((p) => (
              <button key={p.id} onClick={() => open(p)} className="w-full p-4 flex items-center gap-3 text-left hover:bg-slate-800/50">
                <Avatar name={p.name} size="sm" />
                <div>
                  <p className="font-semibold text-white">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.major}</p>
                </div>
              </button>
            ))}
            {conversations.length === 0 && !q && (
              <p className="p-6 text-slate-500 text-sm">
                No conversations yet. Message a seller from a listing, accept a tutor match, or search for someone above.
              </p>
            )}
          </div>
        </aside>

        <section className="col-span-12 md:col-span-8 bg-slate-900/70 border border-slate-800 rounded-2xl flex flex-col overflow-hidden">
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-slate-500">Select a conversation</div>
          ) : (
            <>
              <div className="p-4 border-b border-slate-800 flex items-center gap-3">
                <Avatar name={active.other.name} size="sm" />
                <div>
                  <p className="font-bold text-white">{active.other.name}</p>
                  <p className="text-xs text-slate-500">{active.other.major}</p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {messages.map((m) => {
                  const mine = m.sender_id === user?.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className="max-w-md">
                        <div className={`px-4 py-2.5 rounded-2xl ${mine ? "bg-blue-600 text-white rounded-br-sm" : "bg-slate-800 text-slate-100 rounded-bl-sm"}`}>
                          {m.content}
                        </div>
                        <p className={`text-xs text-slate-500 mt-1 ${mine ? "text-right" : ""}`}>
                          {new Date(m.sent_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              <form onSubmit={send} className="p-4 border-t border-slate-800 flex gap-3">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type a message"
                  maxLength={1000}
                  className="flex-1 px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Button type="submit" disabled={!draft.trim()}>
                  <Send className="w-4 h-4" /> Send
                </Button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
