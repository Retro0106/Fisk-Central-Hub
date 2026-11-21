import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, CalendarDays, ShoppingBag, Users } from "lucide-react";
import { api, type EventItem, type Listing } from "../api";
import { useUser } from "../UserContext";
import { Card } from "../components/ui";
import { EventRow } from "./Organizations";
import { ListingCard } from "./Marketplace";

const sections = [
  {
    to: "/organizations",
    icon: Users,
    title: "Organizations",
    text: "Discover student orgs, upcoming events, and who's involved.",
  },
  {
    to: "/marketplace",
    icon: ShoppingBag,
    title: "Marketplace",
    text: "Textbooks, dorm items, and tickets from other Fisk students.",
  },
  {
    to: "/tutoring",
    icon: BookOpen,
    title: "Peer Tutoring",
    text: "Tell us what you're stuck on and get matched with a peer tutor.",
  },
];

export default function Home() {
  const { user } = useUser();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);

  useEffect(() => {
    api.get<EventItem[]>("/events").then((res) => setEvents(res.data.slice(0, 4)));
    api.get<Listing[]>("/listings").then((res) => setListings(res.data.slice(0, 4)));
  }, []);

  return (
    <div>
      <h1 className="text-4xl font-black text-white tracking-tight">
        Welcome back, <span className="text-amber-400">{user?.name.split(" ")[0]}</span>
      </h1>
      <p className="text-slate-400 mt-2 text-lg">What do you need today?</p>

      <div className="grid md:grid-cols-3 gap-5 mt-8">
        {sections.map(({ to, icon: Icon, title, text }) => (
          <Link
            key={to}
            to={to}
            className="group p-6 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-amber-400/60 transition-colors"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-700/40 border border-blue-500/40 flex items-center justify-center mb-4">
              <Icon className="w-6 h-6 text-amber-300" />
            </div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              {title}
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </h2>
            <p className="text-slate-400 mt-1">{text}</p>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mt-10">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-amber-400" /> Upcoming events
            </h2>
            <Link to="/events" className="text-sm text-blue-300 hover:text-blue-200">See all</Link>
          </div>
          {events.length === 0 ? (
            <p className="text-slate-500">No upcoming events yet.</p>
          ) : (
            <div className="divide-y divide-slate-800">
              {events.map((e) => (
                <EventRow key={e.id} event={e} />
              ))}
            </div>
          )}
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-amber-400" /> New in the marketplace
            </h2>
            <Link to="/marketplace" className="text-sm text-blue-300 hover:text-blue-200">Browse</Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} compact />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
