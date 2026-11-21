import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { api, errorMessage, type Me } from "../api";
import { useUser } from "../UserContext";
import { Logo } from "../components/Layout";
import { Button, ErrorBanner } from "../components/ui";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10">
      <div className="max-w-lg mx-auto">
        <Link to="/">
          <Logo />
        </Link>
        <div className="mt-10 bg-slate-900/80 border border-slate-800 rounded-3xl p-8 md:p-10 text-center">{children}</div>
      </div>
    </div>
  );
}

export function CheckEmail() {
  const state = (useLocation().state ?? {}) as { email?: string; devUrl?: string };
  const [devUrl, setDevUrl] = useState(state.devUrl);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resend = async () => {
    setError(null);
    try {
      const res = await api.post("/auth/resend-verification", { email: state.email });
      setNotice(res.data.message);
      if (res.data.dev_verification_url) setDevUrl(res.data.dev_verification_url);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Shell>
      <MailCheck className="w-14 h-14 text-amber-400 mx-auto mb-4" />
      <h1 className="text-3xl font-black text-white">Check your Fisk email</h1>
      <p className="text-slate-400 mt-3">
        We sent a verification link{state.email ? ` to ${state.email}` : ""}. Open it to finish setting up your account.
      </p>
      <ErrorBanner message={error} />
      {notice && <p className="text-emerald-300 mt-4">{notice}</p>}
      {state.email && (
        <Button variant="ghost" className="mt-6" onClick={resend}>
          Resend link
        </Button>
      )}
      {devUrl && (
        <div className="mt-8 p-4 rounded-xl bg-amber-400/10 border border-amber-400/30 text-left">
          <p className="text-amber-300 text-sm font-semibold">Development mode</p>
          <p className="text-slate-400 text-sm mt-1">
            Emails print to the Django console. You can also verify directly:
          </p>
          <a href={devUrl} className="text-blue-300 text-sm break-all underline">
            {devUrl}
          </a>
        </div>
      )}
    </Shell>
  );
}

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useUser();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    api
      .post<Me>("/auth/verify-email", { uid: params.get("uid"), token: params.get("token") })
      .then((res) => {
        setUser(res.data);
        navigate("/account?welcome=1", { replace: true });
      })
      .catch((err) => setError(errorMessage(err)));
  }, [params, navigate, setUser]);

  return (
    <Shell>
      {error ? (
        <>
          <h1 className="text-2xl font-black text-white mb-4">Couldn't verify your email</h1>
          <ErrorBanner message={error} />
          <Link to="/" className="text-amber-400 font-semibold">
            Back to log in
          </Link>
        </>
      ) : (
        <p className="text-slate-300 animate-pulse">Verifying your Fisk email...</p>
      )}
    </Shell>
  );
}
