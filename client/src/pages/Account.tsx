import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, errorMessage, type Course, type Listing, type Me, type Organization } from "../api";
import { useUser } from "../UserContext";
import { Avatar, Badge, Button, Card, CoursePicker, ErrorBanner, PageHeader } from "../components/ui";
import { formatPrice, inputClass, labelClass } from "../format";

export default function Account() {
  const { user, setUser } = useUser();
  const [params] = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [form, setForm] = useState({
    name: user?.name ?? "",
    major: user?.major ?? "",
    class_year: user?.class_year?.toString() ?? "",
    bio: user?.bio ?? "",
  });
  const [courseIds, setCourseIds] = useState<number[]>(user?.courses_taken.map((c) => c.id) ?? []);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Course[]>("/courses").then((res) => setCourses(res.data));
    api.get<Listing[]>("/listings", { params: { mine: 1 } }).then((res) => setListings(res.data));
    api
      .get<{ organizations: Organization[] }>("/organizations")
      .then((res) => setOrgs(res.data.organizations.filter((o) => o.is_member)));
  }, []);

  if (!user) return null;

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSaved(false);
    setForm({ ...form, [field]: e.target.value });
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await api.patch<Me>("/me", { ...form, course_ids: courseIds });
      setUser(res.data);
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div>
      {params.get("welcome") && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200">
          Your Fisk email is verified. Add your major and courses so tutoring matches and recommendations fit you.
        </div>
      )}
      <PageHeader title="My account" />
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center gap-4 mb-6">
            <Avatar name={user.name} size="lg" />
            <div>
              <h2 className="text-2xl font-bold text-white">{user.name}</h2>
              <p className="text-slate-400">{user.email}</p>
              <div className="flex gap-2 mt-2">
                <Badge tone="green">Verified Fisk student</Badge>
                {user.is_tutor && <Badge tone="gold">Peer tutor</Badge>}
              </div>
            </div>
          </div>
          <ErrorBanner message={error} />
          <form onSubmit={save} className="space-y-5">
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1">
                <label className={labelClass} htmlFor="name">Name</label>
                <input id="name" required className={inputClass} value={form.name} onChange={set("name")} />
              </div>
              <div>
                <label className={labelClass} htmlFor="major">Major</label>
                <input id="major" className={inputClass} placeholder="e.g. Biology" value={form.major} onChange={set("major")} />
              </div>
              <div>
                <label className={labelClass} htmlFor="year">Class year</label>
                <input id="year" type="number" min="2000" max="2100" className={inputClass} placeholder="2028" value={form.class_year} onChange={set("class_year")} />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="bio">About you</label>
              <textarea id="bio" rows={3} maxLength={500} className={inputClass} value={form.bio} onChange={set("bio")} />
            </div>
            <div>
              <label className={labelClass}>Courses you've taken</label>
              <CoursePicker
                courses={courses}
                value={courseIds}
                onChange={(ids) => {
                  setSaved(false);
                  setCourseIds(ids);
                }}
              />
            </div>
            <div className="flex items-center gap-4">
              <Button type="submit">Save profile</Button>
              {saved && <span className="text-emerald-300">Saved</span>}
            </div>
          </form>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-white">My listings</h2>
              <Link to="/marketplace/new" className="text-sm text-blue-300">Sell something</Link>
            </div>
            {listings.length === 0 ? (
              <p className="text-slate-500 text-sm">You haven't listed anything yet.</p>
            ) : (
              <ul className="space-y-2">
                {listings.map((l) => (
                  <li key={l.id}>
                    <Link to={`/marketplace/${l.id}`} className="flex items-center justify-between gap-3 py-1 hover:text-amber-300">
                      <span className="text-slate-200 truncate">{l.title}</span>
                      {l.is_sold ? <Badge tone="red">Sold</Badge> : <span className="text-amber-300 text-sm">{formatPrice(l.price)}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-white">My organizations</h2>
              <Link to="/organizations" className="text-sm text-blue-300">Browse</Link>
            </div>
            {orgs.length === 0 ? (
              <p className="text-slate-500 text-sm">You haven't joined any organizations yet.</p>
            ) : (
              <ul className="space-y-2">
                {orgs.map((o) => (
                  <li key={o.id}>
                    <Link to={`/organizations/${o.slug}`} className="text-slate-200 hover:text-amber-300">{o.name}</Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
