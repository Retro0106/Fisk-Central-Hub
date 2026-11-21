import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Course } from "../api";
import { DAYS, PERIODS, initials } from "../format";

type Variant = "primary" | "gold" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-blue-600 hover:bg-blue-500 text-white",
  gold: "bg-amber-400 hover:bg-amber-300 text-slate-950",
  ghost: "bg-slate-800/70 hover:bg-slate-700 text-slate-200 border border-slate-700",
  danger: "bg-red-600/80 hover:bg-red-500 text-white",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-colors disabled:opacity-50 ${variants[variant]} ${className}`}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-slate-900/70 border border-slate-800 rounded-2xl ${className}`}>{children}</div>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">{title}</h1>
        {subtitle && <p className="text-slate-400 mt-2 text-lg">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/40 text-red-300">{message}</div>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="text-center py-16 px-6 border border-dashed border-slate-800 rounded-2xl">
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      {children && <div className="text-slate-400">{children}</div>}
    </div>
  );
}

export function Loading({ label = "Loading..." }: { label?: string }) {
  return <div className="py-16 text-center text-slate-400 animate-pulse">{label}</div>;
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "w-9 h-9 text-sm", md: "w-12 h-12 text-base", lg: "w-20 h-20 text-2xl" };
  return (
    <div
      className={`${sizes[size]} shrink-0 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 border-2 border-amber-400/70 flex items-center justify-center font-bold text-white`}
    >
      {initials(name)}
    </div>
  );
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "blue" | "gold" | "green" | "red" }) {
  const tones = {
    slate: "bg-slate-800 text-slate-300",
    blue: "bg-blue-500/15 text-blue-300",
    gold: "bg-amber-400/15 text-amber-300",
    green: "bg-emerald-500/15 text-emerald-300",
    red: "bg-red-500/15 text-red-300",
  };
  return <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function AvailabilityPicker({ value, onChange }: { value: string[]; onChange: (slots: string[]) => void }) {
  const toggle = (slot: string) =>
    onChange(value.includes(slot) ? value.filter((s) => s !== slot) : [...value, slot]);
  return (
    <div className="overflow-x-auto">
      <table className="text-sm">
        <thead>
          <tr>
            <th />
            {DAYS.map((day) => (
              <th key={day} className="px-1 pb-2 text-slate-400 font-medium capitalize">
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERIODS.map((period) => (
            <tr key={period}>
              <td className="pr-3 py-1 text-slate-400 capitalize">{period}</td>
              {DAYS.map((day) => {
                const slot = `${day}:${period}`;
                const on = value.includes(slot);
                return (
                  <td key={slot} className="p-1">
                    <button
                      type="button"
                      aria-label={`${day} ${period}`}
                      aria-pressed={on}
                      onClick={() => toggle(slot)}
                      className={`w-11 h-9 rounded-lg border transition-colors ${
                        on ? "bg-amber-400 border-amber-300" : "bg-slate-900 border-slate-700 hover:border-slate-500"
                      }`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CoursePicker({
  courses,
  value,
  onChange,
}: {
  courses: Course[];
  value: number[];
  onChange: (ids: number[]) => void;
}) {
  const toggle = (id: number) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <div className="flex flex-wrap gap-2">
      {courses.map((course) => {
        const on = value.includes(course.id);
        return (
          <button
            type="button"
            key={course.id}
            onClick={() => toggle(course.id)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
              on
                ? "bg-blue-600 border-blue-500 text-white"
                : "bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500"
            }`}
            title={course.title}
          >
            {course.code}
          </button>
        );
      })}
    </div>
  );
}
