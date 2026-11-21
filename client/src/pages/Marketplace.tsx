import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, ShoppingCart } from "lucide-react";
import { api, errorMessage, type Listing } from "../api";
import { useCart } from "../CartContext";
import { Badge, Button, Empty, ErrorBanner, Loading, PageHeader } from "../components/ui";
import { formatPrice, inputClass, listingImage } from "../format";

export function ListingCard({ listing, compact = false }: { listing: Listing; compact?: boolean }) {
  return (
    <Link
      to={`/marketplace/${listing.id}`}
      className="group block rounded-2xl overflow-hidden bg-slate-900/70 border border-slate-800 hover:border-amber-400/60 transition-colors"
    >
      <div className="aspect-square bg-slate-800 overflow-hidden">
        <img
          src={listingImage(listing)}
          alt={listing.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </div>
      <div className={compact ? "p-3" : "p-4"}>
        <h3 className={`font-semibold text-white leading-snug line-clamp-2 ${compact ? "text-sm" : ""}`}>{listing.title}</h3>
        <div className="flex items-center justify-between mt-2">
          <span className="text-amber-300 font-black">{formatPrice(listing.price)}</span>
          {!compact && listing.category && <Badge>{listing.category}</Badge>}
        </div>
        {!compact && <p className="text-xs text-slate-500 mt-2">Sold by {listing.seller.name}</p>}
      </div>
    </Link>
  );
}

export default function Marketplace() {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState("all");
  const [sortBy, setSortBy] = useState("relevance");
  const [searchTerm, setSearchTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { items } = useCart();

  useEffect(() => {
    api.get<{ name: string }[]>("/categories").then((res) => setCategories(res.data.map((c) => c.name)));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(searchTerm.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    let cancelled = false;
    setListings(null);
    const request = debounced
      ? api.get("/search", { params: { q: debounced, type: "listing", k: 24 } }).then((r) => r.data.results.listing as Listing[])
      : api.get<Listing[]>("/listings").then((r) => r.data);
    request
      .then((data) => !cancelled && setListings(data))
      .catch((err) => !cancelled && (setError(errorMessage(err)), setListings([])));
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const shown = (listings ?? [])
    .filter((l) => category === "all" || l.category === category)
    .sort((a, b) => {
      if (sortBy === "price-low") return a.price - b.price;
      if (sortBy === "price-high") return b.price - a.price;
      return 0;
    });

  return (
    <div>
      <PageHeader
        title="Marketplace"
        subtitle="Buy and sell with verified Fisk students."
        action={
          <div className="flex gap-3">
            <Link to="/checkout">
              <Button variant="ghost">
                <ShoppingCart className="w-4 h-4" /> Cart ({items.reduce((s, i) => s + i.quantity, 0)})
              </Button>
            </Link>
            <Link to="/marketplace/new">
              <Button variant="gold">
                <Plus className="w-4 h-4" /> Sell something
              </Button>
            </Link>
          </div>
        }
      />
      <ErrorBanner message={error} />
      <div className="flex flex-col lg:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className={`${inputClass} pl-10`}
            placeholder="Describe what you need, like 'something to keep drinks cold in my dorm'"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select className={`${inputClass} lg:w-56`} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select className={`${inputClass} lg:w-56`} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="relevance">{debounced ? "Best match" : "Newest"}</option>
          <option value="price-low">Price: low to high</option>
          <option value="price-high">Price: high to low</option>
        </select>
      </div>
      {!listings ? (
        <Loading label={debounced ? "Finding the best matches..." : "Loading listings..."} />
      ) : shown.length === 0 ? (
        <Empty title="No listings found">Try different words or another category.</Empty>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {shown.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      )}
    </div>
  );
}
