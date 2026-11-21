import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { api, errorMessage, type Course, type HelpRequest } from "../api";
import { AvailabilityPicker, Button, Card, ErrorBanner, PageHeader } from "../components/ui";
import { inputClass, labelClass } from "../format";

export default function RequestHelp() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState("");
  const [subjectArea, setSubjectArea] = useState("");
  const [description, setDescription] = useState("");
  const [availability, setAvailability] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<Course[]>("/courses").then((res) => setCourses(res.data));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post<{ request: HelpRequest }>("/tutoring/requests", {
        title,
        description,
        course_id: courseId || null,
        subject_area: subjectArea,
        preferred_availability: availability,
      });
      navigate(`/tutoring/requests/${res.data.request.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Link to="/tutoring" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to tutoring
      </Link>
      <PageHeader title="Request help" subtitle="Write it the way you'd say it. Our matching understands what you mean." />
      <Card className="p-6 md:p-8">
        <ErrorBanner message={error} />
        <form onSubmit={submit} className="space-y-6">
          <div>
            <label className={labelClass} htmlFor="title">What do you need help with?</label>
            <input
              id="title"
              required
              maxLength={120}
              className={inputClass}
              placeholder="e.g. Help with calc derivatives before my exam"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass} htmlFor="course">Course (if any)</label>
              <select id="course" className={inputClass} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                <option value="">Not for a specific course</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="subject">Subject area</label>
              <input
                id="subject"
                className={inputClass}
                placeholder="e.g. Math, Writing, Chemistry"
                value={subjectArea}
                onChange={(e) => setSubjectArea(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="description">Details</label>
            <textarea
              id="description"
              required
              rows={5}
              className={inputClass}
              placeholder="What topics are confusing? Any deadline coming up?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>When are you free? (optional)</label>
            <p className="text-sm text-slate-500 mb-3">Tutors who share these times rank higher.</p>
            <AvailabilityPicker value={availability} onChange={setAvailability} />
          </div>
          <Button type="submit" variant="gold" className="w-full py-3" disabled={submitting}>
            {submitting ? "Finding tutors..." : "Find me a tutor"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
