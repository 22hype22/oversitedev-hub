import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-8">
    <h2 className="text-xl font-semibold mb-3 text-foreground">{title}</h2>
    <div className="text-muted-foreground leading-relaxed space-y-3 text-sm">{children}</div>
  </section>
);

const Terms = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 pt-28 pb-16 max-w-3xl">
        <header className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight mb-2">Terms of Service</h1>
          <p className="text-sm text-muted-foreground">
            Oversite Marketplace · Effective date: April 26, 2026 · Governing law: Minnesota, United States
          </p>
        </header>

        <div className="rounded-lg border border-border bg-card/40 p-4 mb-8 text-sm text-muted-foreground">
          <strong className="text-foreground">Important notice:</strong> Please read these terms carefully before using Oversite Marketplace. By accessing or purchasing from this website, you agree to be bound by these terms. If you do not agree, do not use this site.
        </div>

        <Section title="1. About us">
          <p>Oversite Marketplace ("Company," "we," "us," or "our") operates an e-commerce platform offering digital products and services. Our business is located in Minnesota, United States, and all transactions are subject to the laws of that state.</p>
          <p>By using our website, placing an order, or creating an account, you ("Customer," "you," or "your") agree to these Terms of Service in full.</p>
        </Section>

        <Section title="2. Eligibility">
          <p>You must be at least 13 years of age to use this website. If you are under 18, you must have the consent of a parent or legal guardian to make purchases. By using this site, you confirm that you meet these requirements.</p>
          <p>We reserve the right to refuse service, terminate accounts, or cancel orders at our sole discretion, including but not limited to situations involving suspected fraud, abuse, or violation of these terms.</p>
        </Section>

        <Section title="3. Accounts">
          <p>Certain features of our site may require you to create an account. When creating an account, you agree to provide accurate, current, and complete information. You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account.</p>
          <p>You must notify us immediately at support@oversite.shop if you suspect unauthorized access to your account. We are not liable for any loss or damage arising from your failure to protect your credentials.</p>
          <p>We reserve the right to suspend or permanently terminate accounts that violate these terms, engage in fraudulent activity, or are inactive for an extended period, with or without prior notice.</p>
        </Section>

        <Section title="4. Products and digital goods">
          <p>Oversite Marketplace sells digital products, including but not limited to software, licenses, downloadable files, templates, or access credentials. All product descriptions are provided in good faith, and we strive for accuracy; however, we do not warrant that descriptions are error-free or complete.</p>
          <p>We reserve the right to modify, discontinue, or update any product at any time without prior notice. Product availability is not guaranteed.</p>
          <p>Digital products are licensed, not sold. Purchase grants you a limited, non-exclusive, non-transferable license to use the product for your personal or commercial use (as specified per product), subject to the restrictions outlined in these terms.</p>
        </Section>

        <Section title="5. Pricing and payment">
          <p>All prices are displayed in US Dollars (USD) and are subject to change at any time without notice. Prices listed at the time of purchase are the prices you will be charged.</p>
          <p>We accept payment methods as listed at checkout. By providing payment information, you represent that you are authorized to use the payment method provided. All transactions are processed securely through third-party payment processors; we do not store your full payment details.</p>
          <p>In the event of a pricing error, we reserve the right to cancel the order and issue a full refund. Applicable taxes may be added at checkout depending on your location.</p>
        </Section>

        <Section title="6. Refund and return policy">
          <p>Because our products are digital in nature and are delivered electronically, all sales are generally <strong className="text-foreground">final and non-refundable</strong> once the digital product has been delivered, downloaded, or accessed.</p>
          <p>Exceptions may be made at our sole discretion in cases where:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>The product was not delivered due to a technical error on our end.</li>
            <li>The product is materially different from its description.</li>
            <li>Duplicate charges occurred due to a payment processing error.</li>
          </ul>
          <p>To request a refund under an eligible exception, contact us within 7 days of purchase at support@oversite.shop with your order details. We will review requests and respond within 5 business days.</p>
        </Section>

        <Section title="7. Intellectual property">
          <p>All content on this website — including but not limited to text, graphics, logos, icons, images, product files, and software — is the property of Oversite Marketplace or its content suppliers and is protected by United States and international intellectual property laws.</p>
          <p>You may not reproduce, duplicate, copy, sell, resell, reverse engineer, redistribute, or exploit any portion of this website or its products without express written permission from us, except as permitted by applicable law.</p>
          <p>Any unauthorized use of our intellectual property may result in termination of your account, legal action, or both.</p>
        </Section>

        <Section title="8. Prohibited conduct">
          <p>When using Oversite Marketplace, you agree not to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Violate any applicable local, state, national, or international law or regulation.</li>
            <li>Engage in fraudulent activity, including chargebacks filed in bad faith.</li>
            <li>Attempt to gain unauthorized access to any part of our systems or another user's account.</li>
            <li>Use automated bots, scrapers, or similar tools to access or extract data from our site.</li>
            <li>Resell, redistribute, or sublicense digital products without express written authorization.</li>
            <li>Upload or transmit malicious code, viruses, or any disruptive software.</li>
            <li>Harass, abuse, or harm other users, our staff, or third parties through our platform.</li>
            <li>Impersonate any person, business, or entity, including Oversite Marketplace or its staff.</li>
          </ul>
        </Section>

        <Section title="9. Third-party links and services">
          <p>Our website may contain links to third-party websites or services (including payment processors, delivery platforms, or external resources). These links are provided for convenience only. We do not endorse, control, or assume responsibility for the content, privacy policies, or practices of any third-party services.</p>
          <p>Your interactions with third-party services are governed by their own terms and privacy policies. We strongly recommend reading them before providing any personal information.</p>
        </Section>

        <Section title="10. Disclaimer of warranties">
          <p>This website and its products are provided on an "as is" and "as available" basis without any warranties of any kind, either express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, or non-infringement.</p>
          <p>We do not warrant that the website will be uninterrupted, error-free, or free of viruses or other harmful components. You use the site at your own risk.</p>
        </Section>

        <Section title="11. Limitation of liability">
          <p>To the fullest extent permitted by applicable law, Oversite Marketplace, its owners, employees, agents, and affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages — including but not limited to loss of profits, data, use, or goodwill — arising out of or in connection with your use of this website or its products.</p>
          <p>In no event shall our total cumulative liability to you exceed the greater of (a) the amount you paid to us in the 12 months preceding the claim, or (b) $50 USD.</p>
        </Section>

        <Section title="12. Indemnification">
          <p>You agree to indemnify, defend, and hold harmless Oversite Marketplace and its owners, officers, employees, and agents from and against any claims, liabilities, damages, losses, and expenses — including reasonable attorney's fees — arising out of or in any way connected to your use of this website, your violation of these terms, or your violation of any rights of a third party.</p>
        </Section>

        <Section title="13. Privacy">
          <p>Your use of Oversite Marketplace is also governed by our Privacy Policy, which is incorporated into these Terms of Service by reference. By using this site, you consent to the data practices described therein.</p>
        </Section>

        <Section title="14. Dispute resolution and governing law">
          <p>These terms shall be governed by and construed in accordance with the laws of the State of Minnesota, United States, without regard to its conflict of law principles.</p>
          <p>Any dispute arising from or relating to these terms or your use of this website shall first be attempted to be resolved informally by contacting us. If informal resolution fails, both parties agree to submit to binding arbitration in Minnesota, except that either party may seek injunctive or other equitable relief in a court of competent jurisdiction.</p>
          <p>You waive any right to participate in class action lawsuits or class-wide arbitration against Oversite Marketplace.</p>
        </Section>

        <Section title="15. Changes to these terms">
          <p>We reserve the right to update or modify these Terms of Service at any time. Changes will be effective immediately upon posting to this page with an updated effective date. Your continued use of the website following any changes constitutes your acceptance of the revised terms. We encourage you to review these terms periodically.</p>
        </Section>

        <Section title="16. Severability">
          <p>If any provision of these Terms of Service is found to be unlawful, void, or unenforceable, that provision shall be deemed severable from these terms and shall not affect the validity or enforceability of the remaining provisions.</p>
        </Section>

        <Section title="17. Entire agreement">
          <p>These Terms of Service, together with our Privacy Policy and any additional terms applicable to specific products or services, constitute the entire agreement between you and Oversite Marketplace with respect to your use of this website and supersede all prior agreements and understandings.</p>
        </Section>

        <Section title="18. Contact us">
          <p>If you have any questions, concerns, or disputes regarding these Terms of Service, please contact us at:</p>
          <p>
            <strong className="text-foreground">Oversite Marketplace</strong><br />
            Minnesota, United States<br />
            Email: <a href="mailto:support@oversite.shop" className="text-primary hover:underline">support@oversite.shop</a>
          </p>
        </Section>

        <p className="text-xs text-muted-foreground mt-12 pt-6 border-t border-border">
          © 2026 Oversite Marketplace. All rights reserved. This document does not constitute legal advice. Consult a licensed attorney for legal guidance specific to your business.
        </p>
      </main>
      <Footer />
    </div>
  );
};

export default Terms;
