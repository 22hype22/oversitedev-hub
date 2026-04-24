import { useEffect, useState } from "react";
import { Menu, X, Lock, User as UserIcon, LogOut, Shield, LayoutDashboard } from "lucide-react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import oversiteLogo from "@/assets/oversite-logo.png";

const links = [
  { to: "/", label: "Home", end: true },
  { to: "/process", label: "Process" },
  { to: "/products", label: "Products" },
];

export const Navbar = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Failed to sign out");
      return;
    }
    toast.success("Signed out");
    navigate("/");
  };

  return (
    <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-background/80 border-b border-border/60">
      <nav className="container mx-auto flex items-center justify-between h-16 px-4">
        <Link to="/" className="flex items-center" aria-label="Oversite — Build, Grow, Succeed">
          <img
            src={oversiteLogo}
            alt="Oversite"
            className="h-10 md:h-12 w-auto object-contain"
          />
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
          <li aria-hidden="true" className="h-5 w-px bg-border/70 mx-2" />
          <li>
            <NavLink
              to="/bots"
              className={({ isActive }) =>
                `text-sm transition-smooth ${
                  isActive
                    ? "text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              Bots
            </NavLink>
          </li>
        </ul>

        <div className="hidden md:flex items-center gap-3">
          <Button variant="hero" size="sm" asChild>
            <Link to="/products">Start a project</Link>
          </Button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-smooth"
                aria-label="Account"
                title="Account"
              >
                <UserIcon size={15} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">
                  {user.email ?? "My account"}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                  <LayoutDashboard size={14} className="mr-2" />
                  Dashboard
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => isAdmin && navigate("/admin")}
                  disabled={!isAdmin}
                  className={!isAdmin ? "opacity-60" : ""}
                >
                  <span className="relative mr-2 inline-flex items-center justify-center">
                    <Shield size={14} />
                    {!isAdmin && (
                      <Lock
                        size={9}
                        className="absolute -bottom-0.5 -right-1 bg-popover rounded-sm p-[1px]"
                        strokeWidth={3}
                      />
                    )}
                  </span>
                  Admin
                  {!isAdmin && (
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      Locked
                    </span>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut size={14} className="mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <NavLink
              to="/auth"
              className={({ isActive }) =>
                `inline-flex items-center justify-center h-9 w-9 rounded-md border border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-smooth ${
                  isActive ? "text-foreground border-primary/60" : ""
                }`
              }
              aria-label="Sign in"
              title="Sign in"
            >
              <UserIcon size={15} />
            </NavLink>
          )}
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
            <li className="pt-2 mt-2 border-t border-border/40">
              <NavLink
                to="/bots"
                className={({ isActive }) =>
                  `block py-2 ${
                    isActive ? "text-foreground font-medium" : "text-muted-foreground"
                  }`
                }
              >
                Bots
              </NavLink>
            </li>
            <li>
              <Button variant="hero" className="w-full" asChild>
                <Link to="/products">Start a project</Link>
              </Button>
            </li>
            <li className="pt-3 mt-3 border-t border-border/50 space-y-2">
              {user ? (
                <>
                  <div className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </div>
                  <NavLink
                    to="/dashboard"
                    className="flex items-center gap-2 py-2 text-sm text-muted-foreground"
                  >
                    <LayoutDashboard size={14} />
                    Dashboard
                  </NavLink>
                  {isAdmin ? (
                    <NavLink
                      to="/admin"
                      className="flex items-center gap-2 py-2 text-sm text-muted-foreground"
                    >
                      <Shield size={14} />
                      Admin
                    </NavLink>
                  ) : (
                    <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground/60">
                      <span className="relative inline-flex items-center justify-center">
                        <Shield size={14} />
                        <Lock
                          size={9}
                          className="absolute -bottom-0.5 -right-1 bg-background rounded-sm p-[1px]"
                          strokeWidth={3}
                        />
                      </span>
                      Admin
                      <span className="ml-auto text-[10px]">Locked</span>
                    </div>
                  )}
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 py-2 text-sm text-muted-foreground"
                  >
                    <LogOut size={14} />
                    Sign out
                  </button>
                </>
              ) : (
                <NavLink
                  to="/auth"
                  className="flex items-center gap-2 py-2 text-sm text-muted-foreground"
                >
                  <UserIcon size={14} />
                  Sign in
                </NavLink>
              )}
            </li>
          </ul>
        </div>
      )}
    </header>
  );
};
