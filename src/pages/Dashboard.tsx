import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Navbar } from "@/components/site/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LayoutDashboard } from "lucide-react";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  if (loading || !user) return null;

  return (
    <>
      <Navbar />
      <main className="container mx-auto pt-28 pb-16 px-4">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-md bg-primary/10 text-primary inline-flex items-center justify-center">
            <LayoutDashboard size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <Card className="p-6">
          <h2 className="font-medium mb-2">Welcome back 👋</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Your dashboard is coming soon. From here you'll be able to view your purchases,
            manage your account, and track project orders.
          </p>
          <Button asChild variant="hero" size="sm">
            <Link to="/products">Browse products</Link>
          </Button>
        </Card>
      </main>
    </>
  );
}
