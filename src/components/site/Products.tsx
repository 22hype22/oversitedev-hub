import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import { ShoppingCart, Plus, Minus, Trash2, Search, Package } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
  blurb: string;
  emoji: string;
};

const PRODUCTS: Product[] = [
  { id: "p1", name: "Discord Moderation Bot", price: 29, category: "Bots", blurb: "Auto-mod, warns, mutes, and logs.", emoji: "🛡️" },
  { id: "p2", name: "Music Bot Premium", price: 19, category: "Bots", blurb: "High-quality music streaming for servers.", emoji: "🎵" },
  { id: "p3", name: "Leveling System", price: 15, category: "Bots", blurb: "XP, ranks, and leaderboards.", emoji: "⭐" },
  { id: "p4", name: "Ticket Support Bot", price: 25, category: "Bots", blurb: "Full ticket workflow with transcripts.", emoji: "🎫" },
  { id: "p5", name: "Economy Bot", price: 22, category: "Bots", blurb: "Currency, shops, gambling, and more.", emoji: "💰" },
  { id: "p6", name: "Giveaway Manager", price: 12, category: "Bots", blurb: "Reroll, requirements, and entries.", emoji: "🎁" },
  { id: "p7", name: "Welcome Card Pack", price: 9, category: "Assets", blurb: "10 animated welcome card templates.", emoji: "👋" },
  { id: "p8", name: "Server Template Pro", price: 14, category: "Templates", blurb: "Complete community server setup.", emoji: "📋" },
  { id: "p9", name: "Custom Emoji Pack", price: 7, category: "Assets", blurb: "100+ custom server emojis.", emoji: "😀" },
  { id: "p10", name: "Bot Hosting (1 mo)", price: 5, category: "Hosting", blurb: "24/7 uptime for your bot.", emoji: "☁️" },
  { id: "p11", name: "Bot Hosting (1 yr)", price: 49, category: "Hosting", blurb: "Save big with annual hosting.", emoji: "🚀" },
  { id: "p12", name: "Custom Bot Build", price: 199, category: "Services", blurb: "Tailored bot built to your spec.", emoji: "🔧" },
];

const CATEGORIES = ["All", "Bots", "Assets", "Templates", "Hosting", "Services"];

type CartItem = Product & { qty: number };

export const Products = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");

  const filtered = PRODUCTS.filter(
    (p) =>
      (category === "All" || p.category === category) &&
      p.name.toLowerCase().includes(query.toLowerCase()),
  );

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) => (i.id === product.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { ...product, qty: 1 }];
    });
    toast({ title: "Added to cart", description: product.name });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0),
    );
  };

  const removeItem = (id: string) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0);
  const cartTotal = cart.reduce((sum, i) => sum + i.qty * i.price, 0);

  return (
    <section className="py-12 md:py-16">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="text-primary text-sm font-medium mb-2">Shop</div>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
              Browse all <span className="text-gradient">products</span>
            </h1>
            <p className="mt-3 text-muted-foreground">
              Pick what you need and check out — instant delivery on digital items.
            </p>
          </div>

          {/* Cart trigger */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="hero" className="relative">
                <ShoppingCart />
                Cart
                {cartCount > 0 && (
                  <Badge className="ml-1 bg-primary-foreground text-primary">{cartCount}</Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md flex flex-col">
              <SheetHeader>
                <SheetTitle>Your cart ({cartCount})</SheetTitle>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto py-4 space-y-3">
                {cart.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    <Package className="mx-auto mb-3 opacity-40" size={40} />
                    <p>Your cart is empty.</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
                    >
                      <div className="text-2xl">{item.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{item.name}</div>
                        <div className="text-xs text-muted-foreground">${item.price} each</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          onClick={() => updateQty(item.id, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center text-sm">{item.qty}</span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          onClick={() => updateQty(item.id, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <SheetFooter className="border-t border-border pt-4 flex-col gap-3 sm:flex-col">
                  <div className="flex justify-between items-center w-full">
                    <span className="text-muted-foreground">Total</span>
                    <span className="text-2xl font-bold">${cartTotal.toFixed(2)}</span>
                  </div>
                  <Button
                    variant="hero"
                    className="w-full"
                    onClick={() =>
                      toast({ title: "Checkout", description: "Checkout coming soon!" })
                    }
                  >
                    Checkout
                  </Button>
                </SheetFooter>
              )}
            </SheetContent>
          </Sheet>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search products..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {CATEGORIES.map((c) => (
              <Button
                key={c}
                variant={category === c ? "hero" : "outlineGlow"}
                size="sm"
                onClick={() => setCategory(c)}
              >
                {c}
              </Button>
            ))}
          </div>
        </div>

        {/* Product grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            No products match your search.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((p) => (
              <Card
                key={p.id}
                className="group p-5 bg-gradient-card border-border hover:border-primary/50 transition-smooth flex flex-col"
              >
                <div className="aspect-square rounded-lg bg-gradient-hero flex items-center justify-center text-6xl mb-4 group-hover:scale-105 transition-smooth">
                  {p.emoji}
                </div>
                <Badge variant="secondary" className="self-start mb-2 text-xs">
                  {p.category}
                </Badge>
                <h3 className="font-semibold text-base">{p.name}</h3>
                <p className="text-sm text-muted-foreground mt-1 flex-1">{p.blurb}</p>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-2xl font-bold">${p.price}</span>
                  <Button size="sm" variant="hero" onClick={() => addToCart(p)}>
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
