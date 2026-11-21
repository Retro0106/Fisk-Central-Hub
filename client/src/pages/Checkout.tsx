import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MessageSquare, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { api, type Listing } from "../api";
import { useCart } from "../CartContext";
import { Button, Card, Empty, PageHeader } from "../components/ui";
import { formatPrice } from "../format";

export default function CheckoutPage() {
  const { items, updateQuantity, removeItem, subtotal } = useCart();
  const navigate = useNavigate();
  const [listings, setListings] = useState<Record<number, Listing>>({});

  useEffect(() => {
    Promise.all(items.map((i) => api.get<Listing>(`/listings/${i.id}`).then((r) => r.data).catch(() => null))).then(
      (rows) => setListings(Object.fromEntries(rows.filter((r): r is Listing => r !== null).map((r) => [r.id, r]))),
    );
  }, [items]);

  return (
    <div>
      <PageHeader
        title="Your cart"
        subtitle="Payment happens in person with each seller. Message them to arrange pickup on campus."
      />
      {items.length === 0 ? (
        <Empty title="Your cart is empty">
          <Link to="/marketplace" className="text-amber-400">Browse the marketplace</Link>
        </Empty>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => {
              const listing = listings[item.id];
              return (
                <Card key={item.id} className="p-4 flex items-center gap-4">
                  <img src={item.image} alt={item.name} className="w-24 h-24 rounded-xl object-cover bg-slate-800" />
                  <div className="flex-1 min-w-0">
                    <Link to={`/marketplace/${item.id}`} className="font-semibold text-white hover:text-amber-300">
                      {item.name}
                    </Link>
                    <p className="text-amber-300 font-bold mt-1">{formatPrice(item.price)}</p>
                    {listing && <p className="text-sm text-slate-500">Seller: {listing.seller.name}</p>}
                    {listing?.is_sold && <p className="text-sm text-red-300">This item has been sold.</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQuantity(item.id, -1)} className="p-2 rounded-lg bg-slate-800" aria-label="Decrease">
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-6 text-center text-white">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, 1)} className="p-2 rounded-lg bg-slate-800" aria-label="Increase">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {listing && (
                    <Button
                      variant="ghost"
                      onClick={() =>
                        navigate(`/messages?with=${listing.seller.id}`, {
                          state: { draft: `Hi! I'd like to buy "${listing.title}". When can we meet?` },
                        })
                      }
                    >
                      <MessageSquare className="w-4 h-4" /> Message seller
                    </Button>
                  )}
                  <button onClick={() => removeItem(item.id)} className="p-2 text-slate-500 hover:text-red-300" aria-label="Remove">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </Card>
              );
            })}
          </div>
          <Card className="p-6 h-fit">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-amber-400" /> Summary
            </h2>
            <div className="flex justify-between mt-4 text-slate-300">
              <span>{items.reduce((s, i) => s + i.quantity, 0)} items</span>
              <span className="text-2xl font-black text-amber-300">{formatPrice(subtotal)}</span>
            </div>
            <p className="text-sm text-slate-500 mt-4">
              Meet in a public campus spot like the Student Union, and only pay once you've seen the item.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
