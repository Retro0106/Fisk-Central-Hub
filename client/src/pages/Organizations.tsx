import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, MapPin, Search, Users } from "lucide-react";
import { api, errorMessage, type EventItem, type Organization } from "../api";
import { Badge, Card, Empty, ErrorBanner, Loading, PageHeader } from "../components/ui";
import { formatEventTime, initials, inputClass } from "../format";

export function OrganizationCard({ org }: { org: Organization }) {
  return (
    <Link
      to={`/organizations/${org.slug}`}
      className="group block rounded-2xl overflow-hidden bg-slate-900/70 border border-slate-800 hover:border-amber-400/60 transition-colors"
    >
      <div className="aspect-[16/9] overflow-hidden bg-gradient-to-br from-blue-800 to-slate-900 flex items-center justify-center">
        {org.image ? (
          <img
            src={org.image}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="text-4xl font-black text-amber-300/80">{initials(org.name)}</span>
        )}
      </div>
      <div className="p-5">
        <div className="min-w-0">
          <h3 className="font-bold text-white leading-snug">{org.name}</h3>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Badge tone="blue">{org.category_label}</Badge>
            {org.member_count !== undefined && (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Users className="w-3 h-3" /> {org.member_count} members
              </span>
            )}
            {org.is_member && <Badge tone="gold">Joined</Badge>}
          </div>
        </div>
        <p className="text-slate-400 text-sm mt-3 line-clamp-3">{org.description}</p>
      </div>
    </Link>
  );
}

export function EventRow({ event, showOrg = true }: { event: EventItem; showOrg?: boolean }) {
  const start = new Date(event.start_time);
  return (
    <div className="flex gap-4 py-4">
      <div className="w-14 shrink-0 text-center rounded-xl bg-slate-800 py-2">
        <div className="text-xs uppercase text-amber-300 font-bold">
          {start.toLocaleDateString("en-US", { month: "short" })}
        </div>
        <div className="text-xl font-black text-white">{start.getDate()}</div>
      </div>
      <div className="min-w-0">
        <h4 className="font-semibold text-white">{event.title}</h4>
        <p className="text-sm text-slate-400 flex flex-wrap gap-x-3">
          <span className="flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5" /> {formatEventTime(event.start_time, event.end_time)}
          </span>
          {event.location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> {event.location}
            </span>
          )}
        </p>
        {showOrg && (
          <Link to={`/organizations/${event.organization.slug}`} className="text-sm text-blue-300 hover:text-blue-200">
            {event.organization.name}
          </Link>
        )}
      </div>
    </div>
  );
}

export default function Organizations() {
  const [data, setData] = useState<{ categories: { value: string; label: string }[]; organizations: Organization[] } | null>(null);
  const [category, setCategory] = useState("all");
  const [filter, setFilter] = useState("");
  const [searchResults, setSearchResults] = useState<Organization[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get("/organizations").then((res) => setData(res.data)).catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    const q = filter.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(() => {
      api
        .get("/search", { params: { q, type: "organization", k: 20 } })
        .then((res) => setSearchResults(res.data.results.organization))
        .catch((err) => setError(errorMessage(err)));
    }, 300);
    return () => clearTimeout(timer);
  }, [filter]);

  if (!data) return error ? <ErrorBanner message={error} /> : <Loading />;

  const membership = new Map(data.organizations.map((o) => [o.id, o]));
  const base = searchResults ? searchResults.map((o) => ({ ...membership.get(o.id), ...o })) : data.organizations;
  const shown = base.filter((o) => category === "all" || o.category === category);

  return (
    <div>
      <PageHeader
        title="Fisk Organizations"
        subtitle="Find your people. Search by interest, like 'volunteering' or 'coding'."
        action={
          <Link to="/events" className="text-blue-300 hover:text-blue-200 font-semibold flex items-center gap-2">
            <CalendarDays className="w-4 h-4" /> Upcoming events
          </Link>
        }
      />
      <ErrorBanner message={error} />
      <div className="relative max-w-xl mb-5">
        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          className={`${inputClass} pl-10`}
          placeholder="What are you interested in?"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2 mb-8">
        {[{ value: "all", label: "All" }, ...data.categories].map((c) => (
          <button
            key={c.value}
            onClick={() => setCategory(c.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              category === c.value ? "bg-amber-400 text-slate-950" : "bg-slate-900 border border-slate-800 text-slate-300"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <Empty title="No organizations match">Try another search or category.</Empty>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shown.map((org) => (
            <OrganizationCard key={org.id} org={org} />
          ))}
        </div>
      )}
    </div>
  );
}

export function EventsPage() {
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [mine, setMine] = useState(false);

  useEffect(() => {
    setEvents(null);
    api.get<EventItem[]>("/events", { params: mine ? { mine: 1 } : {} }).then((res) => setEvents(res.data));
  }, [mine]);

  return (
    <div>
      <PageHeader
        title="Upcoming Events"
        subtitle="Everything happening across Fisk student organizations."
        action={
          <label className="flex items-center gap-2 text-slate-300">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="w-4 h-4" />
            Only my organizations
          </label>
        }
      />
      {!events ? (
        <Loading />
      ) : events.length === 0 ? (
        <Empty title="No upcoming events">{mine ? "Join an organization to see its events here." : null}</Empty>
      ) : (
        <Card className="px-6 divide-y divide-slate-800">
          {events.map((e) => (
            <EventRow key={e.id} event={e} />
          ))}
        </Card>
      )}
    </div>
  );
}
