import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, errorMessage, type EventItem, type Listing, type Organization, type Tutor } from "../api";
import { Empty, ErrorBanner, Loading, PageHeader } from "../components/ui";
import { ListingCard } from "./Marketplace";
import { EventRow, OrganizationCard } from "./Organizations";
import { TutorCard } from "./Tutoring";

type Results = { listing: Listing[]; tutor: Tutor[]; organization: Organization[]; event: EventItem[] };

const tabs = [
  { key: "all", label: "All" },
  { key: "tutor", label: "Tutors" },
  { key: "listing", label: "Marketplace" },
  { key: "organization", label: "Organizations" },
  { key: "event", label: "Events" },
] as const;

export default function Search() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const tab = (params.get("tab") ?? "all") as (typeof tabs)[number]["key"];
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query) return;
    setResults(null);
    setError(null);
    api
      .get<{ results: Results }>("/search", { params: { q: query, type: "all", k: 8 } })
      .then((res) => setResults(res.data.results))
      .catch((err) => setError(errorMessage(err)));
  }, [query]);

  const count = (key: keyof Results) => results?.[key].length ?? 0;
  const total = results ? count("listing") + count("tutor") + count("organization") + count("event") : 0;
  const show = (key: keyof Results) => (tab === "all" || tab === key) && count(key) > 0;

  return (
    <div>
      <PageHeader
        title={query ? `Results for "${query}"` : "Search"}
        subtitle="Search understands meaning, so 'help with calc derivatives' finds Calculus I tutors."
      />
      <ErrorBanner message={error} />
      {!query ? (
        <Empty title="Type something in the search bar above" />
      ) : !results && !error ? (
        <Loading label="Searching across Fisk Central Hub..." />
      ) : results ? (
        <>
          <div className="flex gap-2 mb-8 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setParams({ q: query, tab: t.key })}
                className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap ${
                  tab === t.key ? "bg-amber-400 text-slate-950" : "bg-slate-900 text-slate-300 border border-slate-800"
                }`}
              >
                {t.label}
                {t.key !== "all" && <span className="ml-2 opacity-70">{count(t.key)}</span>}
              </button>
            ))}
          </div>
          {total === 0 && (
            <Empty title="No close matches">Try describing what you need in different words.</Empty>
          )}
          {show("tutor") && (
            <Section title="Tutors" more="/tutoring/request" moreLabel="Request a tutor">
              <div className="grid md:grid-cols-2 gap-4">
                {results.tutor.map((t) => (
                  <TutorCard key={t.id} tutor={t} />
                ))}
              </div>
            </Section>
          )}
          {show("listing") && (
            <Section title="Marketplace" more="/marketplace" moreLabel="Browse all">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {results.listing.map((l) => (
                  <ListingCard key={l.id} listing={l} />
                ))}
              </div>
            </Section>
          )}
          {show("organization") && (
            <Section title="Organizations" more="/organizations" moreLabel="All organizations">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {results.organization.map((o) => (
                  <OrganizationCard key={o.id} org={o} />
                ))}
              </div>
            </Section>
          )}
          {show("event") && (
            <Section title="Events" more="/events" moreLabel="All events">
              <div className="divide-y divide-slate-800 bg-slate-900/70 border border-slate-800 rounded-2xl px-5">
                {results.event.map((e) => (
                  <EventRow key={e.id} event={e} />
                ))}
              </div>
            </Section>
          )}
        </>
      ) : null}
    </div>
  );
}

function Section({ title, more, moreLabel, children }: { title: string; more: string; moreLabel: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <Link to={more} className="text-sm text-blue-300 hover:text-blue-200">{moreLabel}</Link>
      </div>
      {children}
    </section>
  );
}
