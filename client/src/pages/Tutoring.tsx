import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { GraduationCap, Plus } from "lucide-react";
import { api, type HelpRequest, type Tutor, type TutorMatch } from "../api";
import { useUser } from "../UserContext";
import { Avatar, Badge, Button, Card, Empty, Loading, PageHeader } from "../components/ui";
import { slotLabel } from "../format";

export function TutorCard({ tutor, children }: { tutor: Tutor; children?: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-4">
        <Avatar name={tutor.user.name} />
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-white">{tutor.user.name}</h3>
          <p className="text-sm text-slate-400">
            {[tutor.user.major, tutor.user.class_year && `Class of ${tutor.user.class_year}`].filter(Boolean).join(" · ")}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tutor.courses.map((c) => (
              <Badge key={c.id} tone="blue">
                {c.code}
              </Badge>
            ))}
          </div>
        </div>
      </div>
      {tutor.subjects && <p className="text-slate-300 text-sm mt-3">{tutor.subjects}</p>}
      {tutor.availability.length > 0 && (
        <p className="text-xs text-slate-500 mt-2">Available: {tutor.availability.map(slotLabel).join(", ")}</p>
      )}
      {children}
    </Card>
  );
}

const statusTone = { open: "gold", matched: "green", closed: "slate" } as const;

export function RequestStatus({ status }: { status: HelpRequest["status"] }) {
  return <Badge tone={statusTone[status]}>{status}</Badge>;
}

export default function Tutoring() {
  const { user } = useUser();
  const [requests, setRequests] = useState<HelpRequest[] | null>(null);
  const [assigned, setAssigned] = useState<TutorMatch[]>([]);
  const [tutors, setTutors] = useState<Tutor[]>([]);

  useEffect(() => {
    api.get<HelpRequest[]>("/tutoring/requests").then((res) => setRequests(res.data));
    api.get<TutorMatch[]>("/tutoring/my-matches").then((res) => setAssigned(res.data));
    api.get<Tutor[]>("/tutoring/tutors").then((res) => setTutors(res.data));
  }, []);

  return (
    <div>
      <PageHeader
        title="Peer Tutoring"
        subtitle="Describe what you need help with and we'll match you with Fisk students who can help."
        action={
          <div className="flex gap-3">
            <Link to="/tutoring/profile">
              <Button variant="ghost">
                <GraduationCap className="w-4 h-4" /> {user?.is_tutor ? "My tutor profile" : "Become a tutor"}
              </Button>
            </Link>
            <Link to="/tutoring/request">
              <Button variant="gold">
                <Plus className="w-4 h-4" /> Request help
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section>
            <h2 className="text-xl font-bold text-white mb-4">My help requests</h2>
            {!requests ? (
              <Loading />
            ) : requests.length === 0 ? (
              <Empty title="No requests yet">
                <Link to="/tutoring/request" className="text-amber-400">Ask for help</Link> with any course and get matched in seconds.
              </Empty>
            ) : (
              <div className="space-y-3">
                {requests.map((r) => (
                  <Link
                    key={r.id}
                    to={`/tutoring/requests/${r.id}`}
                    className="block p-5 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-amber-400/60"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="font-semibold text-white">{r.title}</h3>
                      <RequestStatus status={r.status} />
                    </div>
                    <p className="text-sm text-slate-400 mt-1">
                      {r.course ? `${r.course.code} ${r.course.title}` : r.subject_area || "General"}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {assigned.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-white mb-4">Students matched with you</h2>
              <div className="space-y-3">
                {assigned.map((m) => (
                  <Card key={m.id} className="p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-white">{m.request?.title}</h3>
                        <p className="text-sm text-slate-400">
                          {m.request?.student.name} · {m.request?.course?.code ?? m.request?.subject_area}
                        </p>
                      </div>
                      <Badge tone={m.status === "accepted" ? "green" : "gold"}>
                        {m.status === "accepted" ? "Accepted you" : "Suggested"}
                      </Badge>
                    </div>
                    <p className="text-slate-300 text-sm mt-3">{m.request?.description}</p>
                    {m.status === "accepted" && m.request && (
                      <Link to={`/messages?with=${m.request.student.id}`} className="inline-block mt-3 text-blue-300 text-sm font-semibold">
                        Message {m.request.student.name.split(" ")[0]}
                      </Link>
                    )}
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>

        <section>
          <h2 className="text-xl font-bold text-white mb-4">Tutors on the Hub</h2>
          <div className="space-y-4">
            {tutors.map((t) => (
              <TutorCard key={t.id} tutor={t} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
