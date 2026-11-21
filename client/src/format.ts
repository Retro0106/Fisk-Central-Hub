export const FISK_EMAIL = /^[^@\s]+@my\.fisk\.edu$/i;
export const FISK_EMAIL_ERROR = "Email must be a @my.fisk.edu address.";

export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export const PERIODS = ["morning", "afternoon", "evening"] as const;

export function slotLabel(slot: string): string {
  const [day, period] = slot.split(":");
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} ${period}`;
}

export function formatEventTime(start: string, end: string | null): string {
  const s = new Date(start);
  const date = s.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const time = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return end ? `${date}, ${time(s)} to ${time(new Date(end))}` : `${date}, ${time(s)}`;
}

export function formatPrice(price: number): string {
  return price.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

export const CONDITION_LABELS: Record<string, string> = {
  new: "Brand new",
  "like-new": "Like new",
  good: "Good",
  fair: "Fair",
};

export function listingImage(listing: { image: string; title: string }): string {
  return listing.image || `https://placehold.co/600x600/1e3a8a/c4a25a?text=${encodeURIComponent(listing.title.slice(0, 28))}`;
}

export const inputClass =
  "w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

export const labelClass = "block text-slate-300 text-sm font-semibold mb-2";
