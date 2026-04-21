import { useEffect, useState } from "react";
import { Menu, X, Lock } from "lucide-react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";

const links = [
  { to: "/", label: "Home", end: true },
  { to: "/process", label: "Process" },
  { to: "/products", label: "Products" },
];

export const Navbar = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-background/80 border-b border-border/60">
      <nav className="container mx-auto flex items-center justify-between h-16 px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-gradient-primary shadow-glow grid place-items-center text-primary-foreground font-bold">
            O
          </div>
          <span className="font-semibold tracking-tight text-lg">Oversite</span>
        </Link>

        <ul className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <li key={l.to}>
              <NavLink
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `text-sm transition-smooth ${
                    isActive
                      ? "text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`
                }
              >
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="hidden md:flex items-center gap-3">
          <Button variant="hero" size="sm" asChild>
            <Link to="/products">Start a project</Link>
          </Button>
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `inline-flex items-center justify-center h-9 w-9 rounded-md border border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-smooth ${
                isActive ? "text-foreground border-primary/60" : ""
              }`
            }
            aria-label="Admin"
            title="Admin"
          >
            <Lock size={15} />
          </NavLink>
        </div>

        <button
          className="md:hidden p-2 text-foreground"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {open && (
        <div className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur">
          <ul className="px-4 py-4 space-y-3">
            {links.map((l) => (
              <li key={l.to}>
                <NavLink
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) =>
                    `block py-2 ${
                      isActive ? "text-foreground font-medium" : "text-muted-foreground"
                    }`
                  }
                >
                  {l.label}
                </NavLink>
              </li>
            ))}
            <li>
              <Button variant="hero" className="w-full" asChild>
                <Link to="/products">Start a project</Link>
              </Button>
            </li>
            <li className="pt-3 mt-3 border-t border-border/50">
              <NavLink
                to="/admin"
                className="flex items-center gap-2 py-2 text-sm text-muted-foreground"
              >
                <Lock size={14} />
                Admin
              </NavLink>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
};
