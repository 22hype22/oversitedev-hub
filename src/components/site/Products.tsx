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
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Search,
  Package,
  Check,
  X as XIcon,
  Sparkles,
  CreditCard,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { CheckoutDialog, type CheckoutItem } from "@/components/CheckoutDialog";

// Maps internal product/subscription IDs to Stripe price IDs (lookup keys)
const PRICE_MAP: Record<string, string> = {
  "sub-basic": "sub_basic_monthly",
  "sub-standard": "sub_standard_monthly",
  "sub-premium": "sub_premium_monthly",
  "sub-enterprise": "sub_enterprise_monthly",
  p1: "prod_moderation_system_onetime",
  p2: "prod_music_system_onetime",
  p3: "prod_leveling_system_onetime",
  p4: "prod_ticket_system_onetime",
  p5: "prod_economy_system_onetime",
  p6: "prod_giveaway_system_onetime",
  p7: "prod_welcome_card_pack_onetime",
  p8: "prod_server_template_pro_onetime",
  p9: "prod_custom_emoji_pack_onetime",
  p10: "prod_banner_icon_set_onetime",
  p11: "prod_role_icon_bundle_onetime",
  p12: "prod_embed_template_kit_onetime",
};

type Product = {
  id: string;
  name: string;
  price: number;
  category: "Systems" | "Assets";
  blurb: string;
  emoji: string;
  tag?: string;
};

type Subscription = {
  id: string;
  name: string;
  tagline: string;
  price: number;
  popular?: boolean;
  features: { label: string; included: boolean }[];
};

const SUBSCRIPTIONS: Subscription[] = [
  {
    id: "sub-basic",
    name: "Basic",
    tagline: "Starter access",
    price: 9,
    features: [
      { label: "Access to pre-built UI systems", included: true },
      { label: "Access to pre-built game systems", included: true },
      { label: "Community support", included: true },
      { label: "Monthly asset drop", included: true },
    ],
  },
  {
    id: "sub-standard",
    name: "Standard",
    tagline: "More drops & priority",
    price: 24,
    popular: true,
    features: [
      { label: "Everything in Basic", included: true },
      { label: "Access to pre-built builds", included: true },
      { label: "Priority support", included: true },
      { label: "More asset drops", included: true },
      { label: "Early access to new systems", included: true },
    ],
  },
  {
    id: "sub-premium",
    name: "Premium",
    tagline: "Custom + first access",
    price: 49,
    features: [
      { label: "Everything in Standard", included: true },
      { label: "Custom UI requests", included: true },
      { label: "Custom system requests", included: true },
      { label: "Dedicated support channel", included: true },
      { label: "First access to everything new", included: true },
    ],
  },
  {
    id: "sub-enterprise",
    name: "Enterprise",
    tagline: "Full custom development",
    price: 99,
    features: [
      { label: "Everything in Premium", included: true },
      { label: "Full custom game development", included: true },
      { label: "Direct access to developers", included: true },
      { label: "Unlimited requests", included: true },
      { label: "Private builds made for you", included: true },
    ],
  },
];

const PRODUCTS: Product[] = [
  { id: "p1", name: "Moderation System", price: 29, category: "Systems", blurb: "Auto-mod, warns, mutes, and audit logs.", emoji: "🛡️", tag: "Popular" },
  { id: "p2", name: "Music System Premium", price: 19, category: "Systems", blurb: "High-quality streaming with queue controls.", emoji: "🎵" },
  { id: "p3", name: "Leveling System", price: 15, category: "Systems", blurb: "XP, ranks, role rewards, and leaderboards.", emoji: "⭐" },
  { id: "p4", name: "Ticket System", price: 25, category: "Systems", blurb: "Full support flow with transcripts.", emoji: "🎫" },
  { id: "p5", name: "Economy System", price: 22, category: "Systems", blurb: "Currency, shops, and mini-games.", emoji: "💰" },
  { id: "p6", name: "Giveaway System", price: 12, category: "Systems", blurb: "Entries, requirements, and rerolls.", emoji: "🎁" },
  { id: "p7", name: "Welcome Card Pack", price: 9, category: "Assets", blurb: "10 animated welcome card templates.", emoji: "👋" },
  { id: "p8", name: "Server Template Pro", price: 14, category: "Assets", blurb: "Complete community server layout.", emoji: "📋" },
  { id: "p9", name: "Custom Emoji Pack", price: 7, category: "Assets", blurb: "100+ premium server emojis.", emoji: "😀" },
  { id: "p10", name: "Banner & Icon Set", price: 11, category: "Assets", blurb: "Matching banners, icons, and splash art.", emoji: "🎨" },
  { id: "p11", name: "Role Icon Bundle", price: 8, category: "Assets", blurb: "50 clean role icons in multiple styles.", emoji: "🏷️" },
  { id: "p12", name: "Embed Template Kit", price: 13, category: "Assets", blurb: "Ready-to-use rich embed designs.", emoji: "📨" },
];

const COMING_SOON = [
  { name: "Reaction Roles 2.0", blurb: "Drag-and-drop role menus with conditions.", emoji: "✨" },
  { name: "AI Chat Companion", blurb: "Context-aware AI replies in any channel.", emoji: "🤖" },
  { name: "Stats Dashboard", blurb: "Live server analytics and member insights.", emoji: "📊" },
];

const CATEGORIES = ["All", "Systems", "Assets"] as const;

type CartItem = (Product | (Subscription & { category: "Subscription"; emoji: string })) & {
  qty: number;
};

export const Products = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");
  const [query, setQuery] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutItems, setCheckoutItems] = useState<CheckoutItem[]>([]);

  const startCheckout = () => {
    const items: CheckoutItem[] = [];
    let missing = false;
    for (const item of cart) {
      const priceId = PRICE_MAP[item.id];
      if (!priceId) {
        missing = true;
        continue;
      }
      items.push({ priceId, quantity: item.qty });
    }
    if (missing && items.length === 0) {
      sonnerToast.error("Checkout unavailable", {
        description: "These items aren't set up for purchase yet.",
      });
      return;
    }
    const hasSub = items.some((i) => i.priceId.startsWith("sub_"));
    const hasOneTime = items.some((i) => !i.priceId.startsWith("sub_"));
    if (hasSub && hasOneTime) {
      sonnerToast.error("Mixed cart", {
        description: "Please check out subscriptions and products separately.",
      });
      return;
    }
    setCheckoutItems(items);
    setCartOpen(false);
    setCheckoutOpen(true);
  };

  const notifyAdded = (name: string) => {
    sonnerToast(`Added: ${name}`, {
      description: "What would you like to do next?",
      action: {
        label: "View cart",
        onClick: () => setCartOpen(true),
      },
      cancel: {
        label: "Continue shopping",
        onClick: () => {},
      },
    });
  };

  const filtered = PRODUCTS.filter(
    (p) =>
      (category === "All" || p.category === category) &&
      p.name.toLowerCase().includes(query.toLowerCase()),
  );

  const addProductToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) => (i.id === product.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { ...product, qty: 1 }];
    });
    notifyAdded(product.name);
  };

  const addSubscriptionToCart = (sub: Subscription) => {
    if (cart.find((i) => i.id === sub.id)) {
      sonnerToast.info("Already in cart", { description: sub.name });
      return;
    }
    const existingSub = cart.find(
      (i) => "category" in i && i.category === "Subscription",
    );
    setCart((prev) => {
      const filtered = prev.filter(
        (i) => !("category" in i && i.category === "Subscription"),
      );
      return [
        ...filtered,
        { ...sub, category: "Subscription" as const, emoji: "💎", qty: 1 },
      ];
    });
    if (existingSub) {
      sonnerToast(`Switched to ${sub.name}`, {
        description: `Removed ${existingSub.name} — only one subscription allowed at a time.`,
        action: { label: "View cart", onClick: () => setCartOpen(true) },
      });
    } else {
      notifyAdded(sub.name);
    }
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0),
    );
  };

  const removeItem = (id: string) => setCart((prev) => prev.filter((i) => i.id !== id));

  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0);
  const cartTotal = cart.reduce((sum, i) => sum + i.qty * i.price, 0);

  return (
    <section className="py-12 md:py-16">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 pb-8 border-b border-border">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-widest mb-3">
              <Sparkles className="h-3.5 w-3.5" />
              Storefront
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Browse the <span className="text-gradient">catalog</span>
            </h1>
            <p className="mt-3 text-muted-foreground text-lg">
              Premium systems and assets for your community. Instant delivery on every order.
            </p>
          </div>

          <Sheet open={cartOpen} onOpenChange={setCartOpen}>
            <SheetTrigger asChild>
              <Button variant="hero" size="lg" className="relative">
                <ShoppingCart />
                Cart
                {cartCount > 0 && (
                  <Badge className="ml-1 bg-primary-foreground text-primary hover:bg-primary-foreground">
                    {cartCount}
                  </Badge>
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
                  cart.map((item) => {
                    const isSub = "category" in item && item.category === "Subscription";
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
                      >
                        <div className="text-2xl">{item.emoji}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{item.name}</div>
                          <div className="text-xs text-muted-foreground">
                            ${item.price}
                            {isSub ? " / month" : " each"}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {isSub ? (
                            <Badge variant="secondary" className="mr-1 text-[10px]">
                              Monthly
                            </Badge>
                          ) : (
                            <>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-7 w-7"
                                onClick={() => updateQty(item.id, -1)}
                                aria-label="Decrease quantity"
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-6 text-center text-sm">{item.qty}</span>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-7 w-7"
                                onClick={() => updateQty(item.id, 1)}
                                aria-label="Increase quantity"
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => removeItem(item.id)}
                            aria-label="Remove item"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
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
                    size="lg"
                    className="w-full"
                    onClick={startCheckout}
                  >
                    <CreditCard className="h-4 w-4" />
                    Checkout
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setCartOpen(false)}
                  >
                    Continue shopping
                  </Button>
                </SheetFooter>
              )}
            </SheetContent>
          </Sheet>
        </div>

        {/* Subscriptions */}
        <div className="mb-20">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="inline-flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-widest mb-3">
              <Sparkles className="h-3.5 w-3.5" />
              Monthly Subscriptions
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Choose your <span className="text-gradient">growth plan</span>
            </h2>
            <p className="mt-3 text-muted-foreground">
              Flexible monthly pricing to fit any community's needs.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {SUBSCRIPTIONS.map((s) => (
              <Card
                key={s.id}
                className={`relative p-7 flex flex-col transition-smooth ${
                  s.popular
                    ? "border-2 border-primary shadow-elegant scale-[1.02] bg-card"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                {s.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase bg-primary text-primary-foreground shadow-glow">
                    Popular
                  </div>
                )}
                <div className="text-center">
                  <h3 className="text-xl font-bold">{s.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">
                    {s.tagline}
                  </p>
                  <div className="mt-5 flex items-baseline justify-center gap-1">
                    <span className="text-sm text-muted-foreground self-start mt-2">$</span>
                    <span className="text-5xl font-bold tracking-tight">{s.price}</span>
                    <span className="text-muted-foreground text-sm">/mo</span>
                  </div>
                </div>

                <ul className="mt-7 space-y-3 flex-1">
                  {s.features.map((f) => (
                    <li key={f.label} className="flex items-center gap-2 text-sm">
                      {f.included ? (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      ) : (
                        <XIcon className="h-4 w-4 text-destructive/70 shrink-0" />
                      )}
                      <span className={f.included ? "" : "text-muted-foreground line-through"}>
                        {f.label}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={s.popular ? "hero" : "outlineGlow"}
                  className="w-full mt-7 rounded-full"
                  onClick={() => addSubscriptionToCart(s)}
                >
                  <CreditCard className="h-4 w-4" />
                  Purchase
                </Button>
              </Card>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border mb-12" />

        {/* Products header */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-widest mb-3">
            <Package className="h-3.5 w-3.5" />
            All Products
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            One-time <span className="text-gradient">purchases</span>
          </h2>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-10 justify-center items-center">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search products..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 h-11"
            />
          </div>
          <div className="flex gap-2">
            {CATEGORIES.map((c) => (
              <Button
                key={c}
                variant={category === c ? "hero" : "outlineGlow"}
                size="sm"
                onClick={() => setCategory(c)}
                className="h-11 px-5 rounded-full"
              >
                {c}
              </Button>
            ))}
          </div>
        </div>

        {/* Result count */}
        <div className="text-sm text-muted-foreground mb-4 text-center">
          Showing <span className="text-foreground font-medium">{filtered.length}</span>{" "}
          {filtered.length === 1 ? "product" : "products"}
        </div>

        {/* Product grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground border border-dashed border-border rounded-xl">
            No products match your search.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((p) => (
              <Card
                key={p.id}
                className="group p-0 overflow-hidden bg-card border-border hover:border-primary/50 hover:shadow-elegant transition-smooth flex flex-col"
              >
                <div className="relative aspect-[4/3] bg-gradient-hero flex items-center justify-center text-7xl overflow-hidden">
                  <span className="group-hover:scale-110 transition-smooth">{p.emoji}</span>
                  {p.tag && (
                    <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground hover:bg-primary">
                      {p.tag}
                    </Badge>
                  )}
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <Badge variant="secondary" className="self-start mb-2 text-xs font-medium">
                    {p.category}
                  </Badge>
                  <h3 className="font-semibold text-base leading-tight">{p.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1.5 flex-1">{p.blurb}</p>
                  <div className="flex items-center justify-between mt-5 pt-4 border-t border-border">
                    <div>
                      <div className="text-xs text-muted-foreground">Price</div>
                      <span className="text-xl font-bold">${p.price}</span>
                    </div>
                    <Button size="sm" variant="hero" onClick={() => addProductToCart(p)}>
                      <CreditCard className="h-4 w-4" />
                      Purchase
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Coming Soon */}
        <div className="mt-24 pt-12 border-t border-border">
          <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-widest mb-2">
                <Sparkles className="h-3.5 w-3.5" />
                In development
              </div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Coming soon</h2>
              <p className="mt-2 text-muted-foreground">
                Sneak peeks at the next products dropping into the catalog.
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {COMING_SOON.map((c) => (
              <Card
                key={c.name}
                className="p-0 overflow-hidden bg-card border-border border-dashed hover:border-primary/40 transition-smooth"
              >
                <div className="aspect-[16/9] bg-gradient-hero flex items-center justify-center text-6xl relative">
                  <span className="opacity-80">{c.emoji}</span>
                  <Badge className="absolute top-3 right-3 bg-background/80 backdrop-blur text-foreground border border-border">
                    Soon
                  </Badge>
                </div>
                <div className="p-5">
                  <h3 className="font-semibold text-base">{c.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{c.blurb}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Floating cart button */}
      {cartCount > 0 && (
        <Button
          variant="hero"
          size="lg"
          onClick={() => setCartOpen(true)}
          className="fixed bottom-6 right-6 z-40 rounded-full shadow-glow h-14 pl-5 pr-6 gap-2"
          aria-label="View cart"
        >
          <ShoppingCart className="h-5 w-5" />
          <span className="font-semibold">Cart</span>
          <Badge className="bg-primary-foreground text-primary hover:bg-primary-foreground">
            {cartCount}
          </Badge>
        </Button>
      )}
      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        items={checkoutItems}
      />
    </section>
  );
};
