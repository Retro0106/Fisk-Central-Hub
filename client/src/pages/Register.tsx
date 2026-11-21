import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, errorMessage } from "../api";
import { Logo } from "../components/Layout";
import { Button, ErrorBanner } from "../components/ui";
import { FISK_EMAIL, FISK_EMAIL_ERROR, inputClass, labelClass } from "../format";

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ firstName: "", lastName: "", username: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [field]: e.target.value });

  const emailOk = form.email === "" || FISK_EMAIL.test(form.email.trim());
  const passwordsMatch = form.password.length > 0 && form.password === form.confirm;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!FISK_EMAIL.test(form.email.trim())) {
      setError(FISK_EMAIL_ERROR);
      return;
    }
    if (!passwordsMatch) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post("/auth/register", {
        name: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      navigate("/check-email", { state: { email: res.data.email, devUrl: res.data.dev_verification_url } });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10">
      <div className="max-w-xl mx-auto">
        <Link to="/">
          <Logo />
        </Link>
        <div className="mt-10 bg-slate-900/80 border border-slate-800 rounded-3xl p-8 md:p-10">
          <h1 className="text-3xl font-black text-white">Create your account</h1>
          <p className="text-slate-400 mt-2 mb-8">Fisk Central Hub is only for Fisk students. We'll email you a link to confirm.</p>
          <ErrorBanner message={error} />
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor="first">First name</label>
                <input id="first" required className={inputClass} value={form.firstName} onChange={set("firstName")} />
              </div>
              <div>
                <label className={labelClass} htmlFor="last">Last name</label>
                <input id="last" required className={inputClass} value={form.lastName} onChange={set("lastName")} />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="username">Username</label>
              <input id="username" required maxLength={30} className={inputClass} value={form.username} onChange={set("username")} />
            </div>
            <div>
              <label className={labelClass} htmlFor="email">Fisk email</label>
              <input
                id="email"
                type="email"
                required
                placeholder="you@my.fisk.edu"
                className={`${inputClass} ${emailOk ? "" : "border-red-500"}`}
                value={form.email}
                onChange={set("email")}
              />
              {!emailOk && <p className="text-red-300 text-sm mt-2">Must end in @my.fisk.edu</p>}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className={inputClass}
                  value={form.password}
                  onChange={set("password")}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="confirm">Confirm password</label>
                <input
                  id="confirm"
                  type="password"
                  required
                  autoComplete="new-password"
                  className={inputClass}
                  value={form.confirm}
                  onChange={set("confirm")}
                />
              </div>
            </div>
            <p className="text-slate-500 text-sm">At least 8 characters, not too common, and not all numbers.</p>
            <Button type="submit" className="w-full py-3" disabled={submitting}>
              {submitting ? "Creating account..." : "Create account"}
            </Button>
          </form>
          <p className="text-slate-400 mt-6 text-center">
            Already have an account?{" "}
            <Link to="/" className="text-amber-400 font-semibold">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
