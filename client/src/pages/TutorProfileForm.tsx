import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { api, errorMessage, type Course, type Tutor } from "../api";
import { useUser } from "../UserContext";
import { AvailabilityPicker, Button, Card, CoursePicker, ErrorBanner, Loading, PageHeader } from "../components/ui";
import { inputClass, labelClass } from "../format";

export default function TutorProfileForm() {
  const navigate = useNavigate();
  const { refresh } = useUser();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [courseIds, setCourseIds] = useState<number[]>([]);
  const [subjects, setSubjects] = useState("");
  const [availability, setAvailability] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [existing, setExisting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.get<Course[]>("/courses"), api.get<{ profile: Tutor | null }>("/tutoring/profile")]).then(
      ([courseRes, profileRes]) => {
        setCourses(courseRes.data);
        const profile = profileRes.data.profile;
        if (profile) {
          setExisting(true);
          setCourseIds(profile.courses.map((c) => c.id));
          setSubjects(profile.subjects);
          setAvailability(profile.availability);
          setIsActive(profile.is_active);
        }
      },
    );
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.put("/tutoring/profile", { course_ids: courseIds, subjects, availability, is_active: isActive });
      await refresh();
      navigate("/tutoring");
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (!courses) return <Loading />;

  return (
    <div className="max-w-3xl mx-auto">
      <Link to="/tutoring" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to tutoring
      </Link>
      <PageHeader
        title={existing ? "My tutor profile" : "Become a peer tutor"}
        subtitle="Students are matched to you based on your courses, what you describe here, and when you're free."
      />
      <Card className="p-6 md:p-8">
        <ErrorBanner message={error} />
        <form onSubmit={submit} className="space-y-6">
          <div>
            <label className={labelClass}>Courses you can tutor</label>
            <CoursePicker courses={courses} value={courseIds} onChange={setCourseIds} />
          </div>
          <div>
            <label className={labelClass} htmlFor="subjects">Topics you're strong in</label>
            <textarea
              id="subjects"
              rows={4}
              maxLength={500}
              className={inputClass}
              placeholder="e.g. Derivatives, limits, chain rule, related rates, exam prep"
              value={subjects}
              onChange={(e) => setSubjects(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>When are you available?</label>
            <AvailabilityPicker value={availability} onChange={setAvailability} />
          </div>
          <label className="flex items-center gap-3 text-slate-300">
            <input type="checkbox" className="w-4 h-4" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Accepting new students
          </label>
          <Button type="submit" variant="gold" className="w-full py-3">
            {existing ? "Save profile" : "Start tutoring"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
