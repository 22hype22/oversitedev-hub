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
        <section id="memberships" className="container mx-auto px-4 scroll-mt-24">
          <ProductMemberships />
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default ProductsPage;

