import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Download, Loader2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { useAuth } from "@/hooks/useAuth";

type PurchasedFile = {
  id: string;
  productName: string;
  fileName: string | null;
  url: string | null;
};

export default function CheckoutReturn() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<PurchasedFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        const { data, error } = await supabase.functions.invoke(
          "get-purchase-files",
          {
            body: { sessionId, environment: getStripeEnvironment() },
          },
        );
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);
        setFiles(data?.files || []);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sessionId]);

  const downloadable = files.filter((f) => f.url);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full text-center bg-card border border-border rounded-2xl p-8 shadow-elegant">
        <CheckCircle2 className="mx-auto h-14 w-14 text-primary mb-4" />
        <h1 className="text-2xl font-bold mb-2">Thanks for your order!</h1>
        <p className="text-muted-foreground mb-6">
          {sessionId
            ? "Your payment was received."
            : "No session information found."}
        </p>

        {sessionId && (
          <div className="mb-6 text-left">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Your downloads
            </h2>
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Preparing your files…
              </div>
            ) : error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : downloadable.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No downloadable files for this order.
              </p>
            ) : (
              <ul className="space-y-2">
                {downloadable.map((f) => (
                  <li key={f.id}>
                    <a
                      href={f.url!}
                      download={f.fileName ?? undefined}
                      className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-border bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Download className="h-4 w-4 shrink-0 text-primary" />
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {f.productName}
                          </div>
                          {f.fileName && (
                            <div className="text-xs text-muted-foreground truncate">
                              {f.fileName}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        Download
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!user && downloadable.length > 0 && (
          <div className="mb-6 rounded-lg border border-primary/30 bg-primary/5 p-4 text-left">
            <div className="flex items-start gap-3">
              <UserPlus className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">
                  Save these to your account
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Sign up with the same email you used at checkout to access
                  your purchases anytime.
                </p>
                <Button asChild size="sm" variant="hero" className="mt-3">
                  <Link to="/auth">Create an account</Link>
                </Button>
              </div>
            </div>
          </div>
        )}

        {sessionId && (
          <p className="text-xs text-muted-foreground mb-6 break-all">
            Ref: {sessionId}
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <Button asChild variant="outlineGlow">
            <Link to="/">Back home</Link>
          </Button>
          <Button asChild variant="hero">
            <Link to="/products">Keep shopping</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
