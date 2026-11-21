import { useState, type FormEvent } from "react";
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { BookOpen, LogOut, MessageSquare, Search, ShoppingBag, Users } from "lucide-react";
import { useUser } from "../UserContext";
import { Avatar, Loading } from "./ui";

const links = [
  { to: "/organizations", label: "Organizations", icon: Users },
  { to: "/marketplace", label: "Marketplace", icon: ShoppingBag },
  { to: "/tutoring", label: "Tutoring", icon: BookOpen },
  { to: "/messages", label: "Messages", icon: MessageSquare },
];

export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <span className="w-9 h-9 rounded-xl bg-blue-700 border-2 border-amber-400 flex items-center justify-center font-black text-amber-300">
        F
      </span>
      <span className="font-black text-white tracking-tight text-lg">
        Fisk <span className="text-amber-400">Central Hub</span>
      </span>
    </span>
  );
}

export default function Layout() {
  const { user, loading, logout } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");

  if (loading) return <Loading />;
  if (!user) return <Navigate to="/" replace state={{ from: location.pathname }} />;

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center gap-6">
          <NavLink to="/home" aria-label="Fisk Central Hub home">
            <Logo />
          </NavLink>
          <nav className="hidden lg:flex items-center gap-1">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? "bg-slate-800 text-amber-300" : "text-slate-300 hover:text-white hover:bg-slate-900"
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
          </nav>
          <form onSubmit={onSearch} className="flex-1 max-w-md ml-auto relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tutors, items, orgs, events..."
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </form>
          <NavLink to="/account" className="flex items-center gap-2" title="My account">
            <Avatar name={user.name} size="sm" />
          </NavLink>
          <button
            onClick={async () => {
              await logout();
              navigate("/");
            }}
            className="p-2 rounded-lg text-slate-400 hover:text-red-300 hover:bg-slate-900"
            title="Log out"
            aria-label="Log out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
        <nav className="lg:hidden flex overflow-x-auto gap-1 px-4 pb-2">
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${isActive ? "bg-slate-800 text-amber-300" : "text-slate-300"}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
