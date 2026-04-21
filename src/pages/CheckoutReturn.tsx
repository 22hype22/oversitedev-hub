import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export default function CheckoutReturn() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center bg-card border border-border rounded-2xl p-8 shadow-elegant">
        <CheckCircle2 className="mx-auto h-14 w-14 text-primary mb-4" />
        <h1 className="text-2xl font-bold mb-2">Thanks for your order!</h1>
        <p className="text-muted-foreground mb-6">
          {sessionId
            ? "Your payment was received. We'll be in touch shortly."
            : "No session information found."}
        </p>
        {sessionId && (
          <p className="text-xs text-muted-foreground mb-6 break-all">Ref: {sessionId}</p>
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
