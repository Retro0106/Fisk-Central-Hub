import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { api, errorMessage, type Listing } from "../api";
import { Button, Card, ErrorBanner, PageHeader } from "../components/ui";
import { CONDITION_LABELS, inputClass, labelClass } from "../format";

export default function NewListing() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<string[]>([]);
  const [form, setForm] = useState({
    title: "",
    price: "",
    category: "",
    condition: "good",
    color: "",
    image: "",
    description: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<{ name: string }[]>("/categories").then((res) => setCategories(res.data.map((c) => c.name)));
  }, []);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [field]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post<Listing>("/listings", form);
      navigate(`/marketplace/${res.data.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Link to="/marketplace" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to marketplace
      </Link>
      <PageHeader title="Sell something" subtitle="A clear title and description help the right buyer find it through search." />
      <Card className="p-6 md:p-8">
        <ErrorBanner message={error} />
        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className={labelClass} htmlFor="title">Title</label>
            <input id="title" required maxLength={120} className={inputClass} placeholder="e.g. Calculus textbook, 8th edition" value={form.title} onChange={set("title")} />
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass} htmlFor="price">Price ($)</label>
              <input id="price" required type="number" min="0" step="0.01" className={inputClass} value={form.price} onChange={set("price")} />
            </div>
            <div>
              <label className={labelClass} htmlFor="category">Category</label>
              <select id="category" className={inputClass} value={form.category} onChange={set("category")}>
                <option value="">Choose one</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="condition">Condition</label>
              <select id="condition" className={inputClass} value={form.condition} onChange={set("condition")}>
                {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass} htmlFor="color">Color (optional)</label>
              <input id="color" className={inputClass} value={form.color} onChange={set("color")} />
            </div>
            <div>
              <label className={labelClass} htmlFor="image">Image URL (optional)</label>
              <input id="image" type="url" className={inputClass} placeholder="https://..." value={form.image} onChange={set("image")} />
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="description">Description</label>
            <textarea
              id="description"
              rows={5}
              className={inputClass}
              placeholder="Condition details, which class it's for, where to pick it up..."
              value={form.description}
              onChange={set("description")}
            />
          </div>
          <Button type="submit" variant="gold" className="w-full py-3" disabled={submitting}>
            {submitting ? "Posting..." : "Post listing"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
