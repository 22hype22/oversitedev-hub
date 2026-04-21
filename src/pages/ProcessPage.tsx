import { Navbar } from "@/components/site/Navbar";
import { Process } from "@/components/site/Process";
import { Footer } from "@/components/site/Footer";

const ProcessPage = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <main className="pt-16">
      <Process />
    </main>
    <Footer />
  </div>
);

export default ProcessPage;
