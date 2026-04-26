import { Link } from "react-router-dom";
import { Mail, MessageCircle } from "lucide-react";

export const Footer = () => {
  const year = new Date().getFullYear();
  // Memberships only live on the Bots page, so always link there.
  const membershipHref = "/bots#memberships";

  return (
    <footer className="border-t border-border bg-card/30 mt-12">
      <div className="container mx-auto px-4 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2">
              <img src="/favicon.png" alt="Oversite" className="w-8 h-8" />
              <span className="font-semibold text-lg">Oversite</span>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Professional Roblox development & premium systems built around your vision.
            </p>
          </div>

          {/* Explore */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Explore</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/" className="hover:text-foreground transition-colors">Home</Link></li>
              <li><Link to="/process" className="hover:text-foreground transition-colors">Our Process</Link></li>
              <li><Link to="/products" className="hover:text-foreground transition-colors">Products</Link></li>
              <li><Link to="/bots" className="hover:text-foreground transition-colors">Discord Bots</Link></li>
              <li><Link to="/process#faq" className="hover:text-foreground transition-colors">FAQ</Link></li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Account</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/auth" className="hover:text-foreground transition-colors">Sign in</Link></li>
              <li><Link to="/auth?mode=signup" className="hover:text-foreground transition-colors">Create account</Link></li>
              <li><Link to="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link></li>
              <li><Link to={membershipHref} className="hover:text-foreground transition-colors">Memberships</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Contact</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="mailto:support@oversite.shop" className="inline-flex items-center gap-2 hover:text-foreground transition-colors">
                  <Mail className="h-4 w-4" />
                  support@oversite.shop
                </a>
              </li>
              <li>
                <a href="https://discord.gg/B23N33DfUU" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-foreground transition-colors">
                  <MessageCircle className="h-4 w-4" />
                  Discord
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-border flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div>© {year} Oversite. All rights reserved.</div>
          <div className="flex items-center gap-4">
            <span>Instant delivery on every order</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
