import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";

const BotsPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pt-32 pb-20">
        <div className="max-w-3xl">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            <span className="text-gradient">Bots</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            Custom Discord and Roblox bots built for your community — moderation,
            verification, economy, analytics, and more. Coming soon.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default BotsPage;
