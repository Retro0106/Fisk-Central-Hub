import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, CalendarDays, Check, MapPin, Search, Sparkles } from "lucide-react";
import { api, errorMessage, type Me } from "../api";
import { useUser } from "../UserContext";
import { Button, ErrorBanner, Loading } from "../components/ui";
import { FISK_EMAIL, FISK_EMAIL_ERROR, inputClass, labelClass } from "../format";

const QUERIES = [
  { query: "something to keep drinks cold in my dorm", answer: "Mini fridge (3.1 cu ft)", detail: "Marketplace · $70" },
  { query: "someone who can explain recursion", answer: "Kwame Osei", detail: "Peer tutor · CSCI 210" },
  { query: "where do poets hang out on campus", answer: "Spoken Word & Poetry Collective", detail: "Organization · Arts" },
  { query: "help before my calc exam", answer: "Calculus final exam review", detail: "Event · Math Building 120" },
];

const prefersReducedMotion =
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function useTypedQueries() {
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState(prefersReducedMotion ? QUERIES[0].query.length : 0);
  const { query } = QUERIES[index];
  const done = typed >= query.length;

  useEffect(() => {
    if (!done) {
      const timer = setTimeout(() => setTyped((n) => n + 1), 38);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => {
      const next = (index + 1) % QUERIES.length;
      setIndex(next);
      setTyped(prefersReducedMotion ? QUERIES[next].query.length : 0);
    }, 2600);
    return () => clearTimeout(timer);
  }, [done, index, typed]);

  return { ...QUERIES[index], text: query.slice(0, typed), done };
}

function SearchDemo() {
  const { text, answer, detail, done } = useTypedQueries();
  return (
    <div className="relative z-20 max-w-md">
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white text-slate-900 shadow-2xl shadow-black/40">
        <Search className="w-5 h-5 text-slate-400 shrink-0" />
        <span className="text-[15px] truncate">
          {text}
          <span className="inline-block w-0.5 h-4 bg-blue-600 align-middle ml-0.5 animate-pulse" />
        </span>
      </div>
      <div
        className={`mt-2 ml-6 inline-flex items-center gap-3 px-4 py-2.5 rounded-xl bg-blue-600 text-white shadow-lg transition-all duration-300 ${
          done ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"
        }`}
      >
        <Sparkles className="w-4 h-4 text-amber-200 shrink-0" />
        <span className="text-sm">
          <span className="font-semibold">{answer}</span>
          <span className="text-blue-100"> · {detail}</span>
        </span>
      </div>
    </div>
  );
}

const pinned = "absolute transition-transform duration-300 hover:rotate-0 hover:scale-105 hover:z-30";

function Pin({ className = "bg-red-500" }: { className?: string }) {
  return (
    <span
      className={`absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full shadow-md ring-2 ring-black/20 ${className}`}
    />
  );
}

function BulletinBoard() {
  return (
    <div className="relative h-[620px] hidden md:block">
      <SearchDemo />

      <figure className={`${pinned} top-28 left-0 w-[38%] max-w-56 rotate-[-6deg] bg-white p-3 pb-4 shadow-2xl shadow-black/50`}>
        <Pin />
        <img src="/listings/mini-fridge.jpg" alt="Mini fridge listing" className="aspect-square w-full object-cover" />
        <figcaption className="mt-3 flex items-baseline justify-between text-slate-800">
          <span className="font-serif italic">barely used!</span>
          <span className="font-bold">$70</span>
        </figcaption>
      </figure>

      <div className={`${pinned} top-24 right-[2%] w-[42%] max-w-60 rotate-[4deg] bg-amber-200 p-5 shadow-2xl shadow-black/50`}>
        <Pin className="bg-blue-600" />
        <p className="font-serif italic text-slate-800 text-lg leading-snug">
          Anyone good at orgo?? Arrow pushing is ruining my life. Thursdays work for me.
        </p>
        <p className="mt-3 text-sm text-slate-600">Tiana, CHEM 231</p>
      </div>

      <div className={`${pinned} bottom-0 left-[8%] w-[46%] max-w-64 rotate-[3deg] bg-blue-700 text-white shadow-2xl shadow-black/50 overflow-hidden`}>
        <Pin className="bg-amber-300" />
        <div className="px-5 pt-5 pb-4">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-200">Spoken Word & Poetry Collective</p>
          <p className="text-2xl font-black mt-1 leading-tight">Open mic night</p>
          <div className="mt-3 space-y-1 text-sm text-blue-100">
            <p className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4" /> Thursday, 8 PM
            </p>
            <p className="flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Student Union Coffee House
            </p>
          </div>
        </div>
        <div className="border-t border-dashed border-blue-400/60 px-5 py-2 text-xs text-blue-100">
          Sign up at the door, or just come listen
        </div>
      </div>

      <div className={`${pinned} bottom-16 right-0 w-[44%] max-w-64 rotate-[-3deg] bg-slate-900 border border-slate-700 p-5 shadow-2xl shadow-black/50`}>
        <Pin className="bg-emerald-500" />
        <p className="flex items-center gap-2 text-emerald-300 text-sm font-semibold">
          <Check className="w-4 h-4" /> Tutor matched
        </p>
        <p className="mt-2 text-white font-bold text-lg">Darius Lewis</p>
        <p className="text-slate-400 text-sm">Took CHEM 231 · free Thursday afternoons</p>
        <div className="mt-4 h-2 rounded-full bg-slate-800 overflow-hidden">
          <div className="h-full w-[88%] bg-gradient-to-r from-blue-500 to-amber-300" />
        </div>
        <p className="mt-1.5 text-xs text-slate-500">88% match</p>
      </div>
    </div>
  );
}

export default function Landing() {
  const { user, loading, demoLogin, setUser } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <Loading />;
  if (user) return <Navigate to="/home" replace />;

  const from = (location.state as { from?: string } | null)?.from ?? "/home";

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!FISK_EMAIL.test(email.trim())) {
      setError(FISK_EMAIL_ERROR);
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post<Me>("/auth/login", { email, password });
      setUser(res.data);
      navigate(from, { replace: true });
    } catch (err) {
      const code = (err as { response?: { data?: { code?: string } } }).response?.data?.code;
      if (code === "unverified") {
        navigate("/check-email", { state: { email } });
        return;
      }
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 bg-[radial-gradient(rgba(148,163,184,0.12)_1px,transparent_1px)] [background-size:22px_22px]">
      <div className="max-w-7xl mx-auto px-6 py-8 lg:py-10">
        <header className="text-center pt-6 lg:pt-10">
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.35em] text-slate-500">
            For Bulldogs, by Bulldogs
          </p>
          <h1 className="mt-5 flex items-center justify-center gap-4 sm:gap-5">
            <span className="w-14 h-14 sm:w-20 sm:h-20 shrink-0 rounded-2xl sm:rounded-3xl bg-blue-700 border-[3px] border-amber-400 flex items-center justify-center font-black text-3xl sm:text-5xl text-amber-300 shadow-xl shadow-blue-900/40">
              F
            </span>
            <span className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight">
              Fisk <span className="text-amber-300">Central Hub</span>
            </span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto text-balance">
            Student orgs and events, a campus marketplace, and peer tutoring for Fisk students.
          </p>
        </header>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_400px] gap-x-12 gap-y-10 items-start mt-12 lg:mt-16">
          <div className="order-2 lg:order-none">
            <BulletinBoard />
          </div>

          <div className="max-w-md w-full mx-auto bg-slate-900/90 backdrop-blur border border-slate-800 rounded-3xl p-8 shadow-2xl order-1 lg:order-none lg:sticky lg:top-10">
            <h2 className="text-2xl font-bold text-white">Welcome back, Bulldog</h2>
            <p className="text-slate-400 mt-1 mb-6">Log in with your Fisk email.</p>
            <ErrorBanner message={error} />
            <form className="space-y-5" onSubmit={handleSubmit} noValidate>
              <div>
                <label className={labelClass} htmlFor="email">
                  Fisk email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@my.fisk.edu"
                  className={inputClass}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  className={inputClass}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full py-3 group" disabled={submitting}>
                {submitting ? "Logging in..." : "Log in"}
                {!submitting && <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />}
              </Button>
            </form>
            {demoLogin && (
              <p className="mt-5 flex items-start gap-2 text-sm text-slate-400">
                <span className="mt-1.5 w-2 h-2 rounded-full bg-amber-300 shrink-0" />
                Demo mode: any @my.fisk.edu email with any password gets you in.
              </p>
            )}
            <p className="text-slate-400 mt-6 pt-6 border-t border-slate-800 text-center">
              New here?{" "}
              <Link to="/register" className="text-amber-300 font-semibold hover:text-amber-200">
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
