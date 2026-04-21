import { useEffect } from "react";
import { Navbar } from "@/components/site/Navbar";
import { Products } from "@/components/site/Products";
import { Footer } from "@/components/site/Footer";

const ProductsPage = () => {
  useEffect(() => {
    document.documentElement.classList.add("theme-orange");
    return () => {
      document.documentElement.classList.remove("theme-orange");
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-16">
        <Products />
      </main>
      <Footer />
    </div>
  );
};

export default ProductsPage;
