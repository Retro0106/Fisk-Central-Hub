import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, RefreshCw, Sparkles } from "lucide-react";
import { api, errorMessage, type HelpRequest, type TutorMatch } from "../api";
import { Badge, Button, Card, Empty, ErrorBanner, Loading } from "../components/ui";
import { slotLabel } from "../format";
import { RequestStatus, TutorCard } from "./Tutoring";

type Detail = { request: HelpRequest; matches: TutorMatch[] };

export default function RequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (refresh = false) =>
      api
        .get<Detail>(`/tutoring/requests/${id}`, { params: refresh ? { refresh: 1 } : {} })
        .then((res) => setData(res.data))
        .catch((err) => setError(errorMessage(err))),
    [id],
  );

  useEffect(() => {
    load();
  }, [load]);

  const respond = async (match: TutorMatch, action: "accept" | "decline") => {
    setError(null);
    try {
      await api.post(`/tutoring/matches/${match.id}/${action}`);
      if (action === "accept") {
        navigate(`/messages?with=${match.tutor.user.id}`, {
          state: { draft: `Hi ${match.tutor.user.name.split(" ")[0]}! I'd love your help with "${data?.request.title}". When works for you?` },
        });
      } else {
        load();
      }
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const close = async () => {
    await api.post(`/tutoring/requests/${id}/close`);
    load();
  };

  if (!data) return error ? <ErrorBanner message={error} /> : <Loading />;
  const { request, matches } = data;
  const visible = matches.filter((m) => m.status !== "declined");

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/tutoring" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to tutoring
      </Link>
      <ErrorBanner message={error} />
      <Card className="p-6 mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white">{request.title}</h1>
            <p className="text-slate-400 mt-1">
              {request.course ? `${request.course.code} ${request.course.title}` : request.subject_area || "General"}
            </p>
          </div>
          <RequestStatus status={request.status} />
        </div>
        <p className="text-slate-300 mt-4 whitespace-pre-line">{request.description}</p>
        {request.preferred_availability.length > 0 && (
          <p className="text-sm text-slate-500 mt-3">Free: {request.preferred_availability.map(slotLabel).join(", ")}</p>
        )}
        {request.status !== "closed" && (
          <div className="flex gap-3 mt-5">
            {request.status === "open" && (
              <Button variant="ghost" onClick={() => load(true)}>
                <RefreshCw className="w-4 h-4" /> Refresh matches
              </Button>
            )}
            <Button variant="ghost" onClick={close}>
              <Check className="w-4 h-4" /> Mark as resolved
            </Button>
          </div>
        )}
      </Card>

      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-amber-400" /> Your tutor matches
      </h2>
      {visible.length === 0 ? (
        <Empty title="No matches yet">
          No active tutors fit this request right now. Try adding more detail or check back later.
        </Empty>
      ) : (
        <div className="space-y-4">
          {visible.map((m, index) => (
            <TutorCard key={m.id} tutor={m.tutor}>
              <div className="mt-4 pt-4 border-t border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  {index === 0 && m.status === "proposed" && <Badge tone="gold">Best match</Badge>}
                  <Badge tone="blue">{Math.round(m.score * 100)}% match</Badge>
                  {m.reasons.map((r) => (
                    <Badge key={r}>{r}</Badge>
                  ))}
                </div>
                <div className="flex gap-3 mt-4">
                  {m.status === "accepted" ? (
                    <Link to={`/messages?with=${m.tutor.user.id}`}>
                      <Button>Open chat</Button>
                    </Link>
                  ) : request.status === "open" ? (
                    <>
                      <Button variant="gold" onClick={() => respond(m, "accept")}>Accept and message</Button>
                      <Button variant="ghost" onClick={() => respond(m, "decline")}>Not a fit</Button>
                    </>
                  ) : null}
                </div>
              </div>
            </TutorCard>
          ))}
        </div>
      )}
    </div>
  );
}
