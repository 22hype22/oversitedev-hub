import { Navbar } from "@/components/site/Navbar";
import { Products } from "@/components/site/Products";
import { ProductMemberships } from "@/components/site/ProductMemberships";
import { Footer } from "@/components/site/Footer";

const ProductsPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Products />
        <div className="container mx-auto px-4">
          <ProductMemberships />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ProductsPage;

