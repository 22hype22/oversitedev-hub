import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { SystemScreen, SystemCard, SystemBadge } from "@/components/site/SystemScreen";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <SystemScreen footer={<>404 — {location.pathname}</>}>
      <SystemCard>
        <SystemBadge>
          <Search />
        </SystemBadge>
        <h1 style={{ fontSize: 64, lineHeight: 1, marginBottom: 4 }}>404</h1>
        <h1 style={{ fontSize: 20, marginBottom: 10 }}>This page wandered off</h1>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 28 }}>
          We couldn't find what you were looking for. It may have been moved, or the link
          was mistyped.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button className="ossys-ghost" onClick={() => navigate(-1)}>
            Go back
          </button>
          <Link className="ossys-accent" to="/">
            Return home
          </Link>
        </div>
      </SystemCard>
    </SystemScreen>
  );
};

export default NotFound;
