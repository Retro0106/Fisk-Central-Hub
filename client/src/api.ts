import axios from "axios";

// Vite proxies /api to Django in development, so the browser sees one origin
// and the session + CSRF cookies just work. VITE_API_URL overrides it.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
  withCredentials: true,
  xsrfCookieName: "csrftoken",
  xsrfHeaderName: "X-CSRFToken",
});

let csrfReady: Promise<unknown> | null = null;

export function ensureCsrf() {
  if (!csrfReady) csrfReady = api.get("/auth/csrf");
  return csrfReady;
}

api.interceptors.request.use(async (config) => {
  if (config.method && config.method !== "get") await ensureCsrf();
  return config;
});

export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string; detail?: string } | undefined;
    return data?.error ?? data?.detail ?? fallback;
  }
  return fallback;
}

export type Course = { id: number; code: string; title: string };

export type PublicUser = {
  id: number;
  username: string;
  name: string;
  major: string;
  class_year: number | null;
};

export type Me = PublicUser & {
  email: string;
  bio: string;
  email_verified: boolean;
  courses_taken: Course[];
  is_tutor: boolean;
};

export type Listing = {
  id: number;
  title: string;
  description: string;
  price: number;
  color: string;
  condition: string;
  image: string;
  is_sold: boolean;
  category: string | null;
  seller: PublicUser;
  created_at: string;
  score?: number;
};

export type Tutor = {
  id: number;
  user: PublicUser;
  bio: string;
  courses: Course[];
  subjects: string;
  availability: string[];
  is_active: boolean;
  score?: number;
};

export type HelpRequest = {
  id: number;
  title: string;
  description: string;
  course: Course | null;
  subject_area: string;
  preferred_availability: string[];
  status: "open" | "matched" | "closed";
  student: PublicUser;
  created_at: string;
};

export type TutorMatch = {
  id: number;
  score: number;
  reasons: string[];
  status: "proposed" | "accepted" | "declined";
  tutor: Tutor;
  request?: HelpRequest;
};

export type Organization = {
  id: number;
  name: string;
  slug: string;
  description: string;
  category: string;
  category_label: string;
  contact_email: string;
  image: string;
  member_count?: number;
  is_member?: boolean;
  score?: number;
};

export type EventItem = {
  id: number;
  title: string;
  description: string;
  location: string;
  start_time: string;
  end_time: string | null;
  organization: { id: number; name: string; slug: string };
  score?: number;
};

export type ChatMessage = { id: number; sender_id: number; content: string; sent_at: string };

export type ConversationSummary = {
  id: number;
  other_user: PublicUser;
  last_message: ChatMessage | null;
};
