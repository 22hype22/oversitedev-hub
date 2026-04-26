import { Navbar } from "@/components/site/Navbar";
import { Products } from "@/components/site/Products";
import { Memberships } from "@/components/site/Memberships";
import { Footer } from "@/components/site/Footer";

const ProductsPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Products />
        <div className="container mx-auto px-4">
          <Memberships />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ProductsPage;
