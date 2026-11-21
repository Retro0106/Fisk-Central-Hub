import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MessageSquare, ShoppingCart } from "lucide-react";
import { api, errorMessage, type Listing } from "../api";
import { useCart } from "../CartContext";
import { useUser } from "../UserContext";
import { Avatar, Badge, Button, Card, ErrorBanner, Loading } from "../components/ui";
import { CONDITION_LABELS, formatPrice, listingImage } from "../format";

export default function ListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useUser();
  const { items, addItem, removeItem } = useCart();
  const [listing, setListing] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Listing>(`/listings/${id}`).then((res) => setListing(res.data)).catch((err) => setError(errorMessage(err)));
  }, [id]);

  if (!listing) return error ? <ErrorBanner message={error} /> : <Loading />;

  const mine = listing.seller.id === user?.id;
  const inCart = items.some((i) => i.id === listing.id);

  const messageSeller = () => navigate(`/messages?with=${listing.seller.id}`, { state: { draft: `Hi! Is "${listing.title}" still available?` } });

  const update = async (changes: Partial<Listing>) => {
    try {
      const res = await api.patch<Listing>(`/listings/${listing.id}`, changes);
      setListing(res.data);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const remove = async () => {
    if (!confirm("Delete this listing?")) return;
    try {
      await api.delete(`/listings/${listing.id}`);
      navigate("/account");
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div>
      <Link to="/marketplace" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to marketplace
      </Link>
      <ErrorBanner message={error} />
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="rounded-3xl overflow-hidden bg-slate-800 aspect-square">
          <img src={listingImage(listing)} alt={listing.title} className="w-full h-full object-cover" />
        </div>
        <div>
          <div className="flex flex-wrap gap-2 mb-3">
            {listing.category && <Badge tone="blue">{listing.category}</Badge>}
            <Badge>{CONDITION_LABELS[listing.condition] ?? listing.condition}</Badge>
            {listing.color && <Badge>{listing.color}</Badge>}
            {listing.is_sold && <Badge tone="red">Sold</Badge>}
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white">{listing.title}</h1>
          <p className="text-4xl font-black text-amber-300 mt-4">{formatPrice(listing.price)}</p>
          <p className="text-slate-300 mt-6 whitespace-pre-line">{listing.description || "No description provided."}</p>

          <Card className="p-5 mt-8 flex items-center gap-4">
            <Avatar name={listing.seller.name} />
            <div className="flex-1">
              <p className="text-white font-semibold">{listing.seller.name}</p>
              <p className="text-sm text-slate-400">
                {[listing.seller.major, listing.seller.class_year && `Class of ${listing.seller.class_year}`].filter(Boolean).join(" · ") ||
                  "Fisk student"}
              </p>
            </div>
            <Badge tone="green">Verified Fisk</Badge>
          </Card>

          <div className="flex flex-wrap gap-3 mt-6">
            {mine ? (
              <>
                <Button variant="gold" onClick={() => update({ is_sold: !listing.is_sold })}>
                  {listing.is_sold ? "Mark as available" : "Mark as sold"}
                </Button>
                <Button variant="danger" onClick={remove}>Delete listing</Button>
              </>
            ) : (
              <>
                <Button variant="gold" onClick={messageSeller} disabled={listing.is_sold}>
                  <MessageSquare className="w-4 h-4" /> Message seller
                </Button>
                <Button
                  variant="ghost"
                  disabled={listing.is_sold}
                  onClick={() =>
                    inCart
                      ? removeItem(listing.id)
                      : addItem({ id: listing.id, name: listing.title, price: listing.price, color: listing.color, image: listingImage(listing) })
                  }
                >
                  <ShoppingCart className="w-4 h-4" /> {inCart ? "Remove from cart" : "Add to cart"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
