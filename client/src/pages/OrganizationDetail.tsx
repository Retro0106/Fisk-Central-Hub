import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Mail, Plus } from "lucide-react";
import { api, errorMessage, type EventItem, type Organization, type PublicUser } from "../api";
import { Avatar, Badge, Button, Card, Empty, ErrorBanner, Loading } from "../components/ui";
import { initials, inputClass, labelClass } from "../format";
import { EventRow } from "./Organizations";

type Detail = Organization & {
  members: { user: PublicUser; role: string }[];
  my_role: string | null;
  can_manage: boolean;
  upcoming_events: EventItem[];
  past_events: EventItem[];
};

export default function OrganizationDetail() {
  const { slug } = useParams();
  const [org, setOrg] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEventForm, setShowEventForm] = useState(false);

  const load = useCallback(() => {
    api.get<Detail>(`/organizations/${slug}`).then((res) => setOrg(res.data)).catch((err) => setError(errorMessage(err)));
  }, [slug]);

  useEffect(load, [load]);

  const toggleMembership = async () => {
    if (!org) return;
    setError(null);
    try {
      await api.post(`/organizations/${slug}/${org.my_role ? "leave" : "join"}`);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (!org) return error ? <ErrorBanner message={error} /> : <Loading />;

  const officers = org.members.filter((m) => m.role !== "member");

  return (
    <div>
      <Link to="/organizations" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-6">
        <ArrowLeft className="w-4 h-4" /> All organizations
      </Link>
      <ErrorBanner message={error} />
      <div className="relative mb-8 rounded-3xl overflow-hidden border border-slate-800 bg-gradient-to-br from-blue-900 to-slate-900">
        {org.image && <img src={org.image} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
        <div className="relative flex flex-col md:flex-row md:items-end gap-6 p-6 md:p-8 pt-40 md:pt-56">
          <div className="w-20 h-20 shrink-0 rounded-2xl bg-blue-700 border-2 border-amber-400 flex items-center justify-center text-3xl font-black text-amber-300 shadow-xl">
            {initials(org.name)}
          </div>
          <div className="flex-1">
            <h1 className="text-3xl md:text-4xl font-black text-white drop-shadow">{org.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <Badge tone="blue">{org.category_label}</Badge>
              <span className="text-slate-200">{org.member_count} members</span>
              {org.my_role && (
                <Badge tone="gold">You're {org.my_role === "member" ? "a member" : `an ${org.my_role}`}</Badge>
              )}
            </div>
          </div>
          <Button variant={org.my_role ? "ghost" : "gold"} onClick={toggleMembership}>
            {org.my_role ? "Leave" : "Join organization"}
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-bold text-white mb-2">About</h2>
            <p className="text-slate-300 whitespace-pre-line">{org.description || "No description yet."}</p>
            {org.contact_email && (
              <a href={`mailto:${org.contact_email}`} className="inline-flex items-center gap-2 text-blue-300 mt-4">
                <Mail className="w-4 h-4" /> {org.contact_email}
              </a>
            )}
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Upcoming events</h2>
              {org.can_manage && (
                <Button variant="ghost" onClick={() => setShowEventForm((v) => !v)}>
                  <Plus className="w-4 h-4" /> Post event
                </Button>
              )}
            </div>
            {showEventForm && (
              <EventForm
                slug={org.slug}
                onCreated={() => {
                  setShowEventForm(false);
                  load();
                }}
              />
            )}
            {org.upcoming_events.length === 0 ? (
              <p className="text-slate-500 mt-4">Nothing scheduled right now.</p>
            ) : (
              <div className="divide-y divide-slate-800">
                {org.upcoming_events.map((e) => (
                  <EventRow key={e.id} event={e} showOrg={false} />
                ))}
              </div>
            )}
            {org.past_events.length > 0 && (
              <details className="mt-4">
                <summary className="text-slate-400 cursor-pointer">Past events</summary>
                <div className="divide-y divide-slate-800 opacity-70">
                  {org.past_events.map((e) => (
                    <EventRow key={e.id} event={e} showOrg={false} />
                  ))}
                </div>
              </details>
            )}
          </Card>
        </div>

        <Card className="p-6 h-fit">
          <h2 className="text-lg font-bold text-white mb-4">Members</h2>
          {org.members.length === 0 ? (
            <Empty title="No members yet" />
          ) : (
            <ul className="space-y-3">
              {[...officers, ...org.members.filter((m) => m.role === "member")].map((m) => (
                <li key={m.user.id} className="flex items-center gap-3">
                  <Avatar name={m.user.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-medium truncate">{m.user.name}</p>
                    <p className="text-xs text-slate-500 truncate">{m.user.major}</p>
                  </div>
                  {m.role !== "member" && <Badge tone="gold">{m.role}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function EventForm({ slug, onCreated }: { slug: string; onCreated: () => void }) {
  const [form, setForm] = useState({ title: "", start_time: "", end_time: "", location: "", description: "" });
  const [error, setError] = useState<string | null>(null);
  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [field]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post(`/organizations/${slug}/events`, form);
      onCreated();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <form onSubmit={submit} className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
      <ErrorBanner message={error} />
      <div>
        <label className={labelClass}>Title</label>
        <input required className={inputClass} value={form.title} onChange={set("title")} />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Starts</label>
          <input required type="datetime-local" className={inputClass} value={form.start_time} onChange={set("start_time")} />
        </div>
        <div>
          <label className={labelClass}>Ends</label>
          <input type="datetime-local" className={inputClass} value={form.end_time} onChange={set("end_time")} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Location</label>
        <input className={inputClass} value={form.location} onChange={set("location")} />
      </div>
      <div>
        <label className={labelClass}>Description</label>
        <textarea rows={3} className={inputClass} value={form.description} onChange={set("description")} />
      </div>
      <Button type="submit" variant="gold">Post event</Button>
    </form>
  );
}
