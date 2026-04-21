export const Footer = () => (
  <footer className="border-t border-border py-10">
    <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-md bg-gradient-primary grid place-items-center text-primary-foreground font-bold text-sm">
          O
        </div>
        <span className="font-semibold">Oversite</span>
        <span className="text-muted-foreground text-sm ml-2">Professional Roblox development</span>
      </div>
      <div className="text-sm text-muted-foreground">
        © {new Date().getFullYear()} Oversite. All rights reserved.
      </div>
    </div>
  </footer>
);
