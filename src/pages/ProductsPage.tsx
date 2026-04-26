import { Navbar } from "@/components/site/Navbar";
import { Products } from "@/components/site/Products";
import { Footer } from "@/components/site/Footer";

const ProductsPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Products />
      </main>
      <Footer />
    </div>
  );
};

export default ProductsPage;

