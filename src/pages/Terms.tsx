import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ShieldCheck, FileText, Receipt } from "lucide-react";
import { SiteNav } from "@/components/marketing/SiteNav";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { cn } from "@/lib/utils";

/**
 * Legal — Privacy Policy, Terms of Use and Sales & Refunds, tabbed. Route:
 * /terms (also deep-linkable via #privacy / #terms / #refunds).
 *
 * NOTE: This is solid starting copy, not lawyer-reviewed. Confirm/adjust the
 * bracketed items (support email, refund window, governing state) and consider
 * a review via Termly/iubenda or counsel before relying on it.
 */

const SUPPORT = "support@oversite.shop"; // ← confirm your real support email
const EFFECTIVE = "June 27, 2026";
const STATE = "Minnesota, United States";

type Section = { h: string; body: string[] };
type Doc = { key: string; label: string; title: string; icon: typeof FileText; intro: string; sections: Section[] };

const PRIVACY: Section[] = [
  { h: "1. Overview", body: [
    "This Privacy Policy explains how Oversite (\"Oversite\", \"we\", \"us\") collects, uses, and protects information when you use our website and services — managed Discord bots and related hosting (the \"Services\").",
    "By using the Services you agree to the practices described here. If you don't agree, please don't use the Services.",
  ]},
  { h: "2. Information we collect", body: [
    "Account information: your email address, password (stored only as a secure hash), display name, and Discord username. If you sign in with Discord or Google, we receive basic profile details from that provider.",
    "Payment information: when you purchase, our payment processor (Stripe) collects and stores your card details. Oversite never sees or stores full card numbers — we only receive limited data such as the card brand and last four digits.",
    "Service data: information needed to run your bots, such as the Discord servers, channels, and roles you connect, plus configuration you set in the dashboard. We also collect basic usage and diagnostic logs to operate and secure the Services.",
  ]},
  { h: "3. How we use information", body: [
    "To create and manage your account, provide and deploy your bots, process payments and renewals, send service and account notices, respond to support requests, prevent abuse and fraud, and improve the Services.",
    "We send account, billing, and service emails as part of providing the Services. You can manage optional notification categories in your account settings.",
  ]},
  { h: "4. How we share information", body: [
    "We share information only with providers that help us run the Services: Stripe (payments), Discord and Google (sign-in and bot functionality), Supabase (database and authentication), and our hosting/infrastructure providers. These providers process data on our behalf.",
    "We may disclose information if required by law, to enforce our terms, or to protect the rights, safety, and property of Oversite, our users, or others. We do not sell your personal information.",
  ]},
  { h: "5. Cookies & tracking", body: [
    "We use cookies and similar technologies to keep you signed in, remember preferences, and understand how the site is used. You can control cookies through your browser, though some features may not work without them.",
  ]},
  { h: "6. Data security & retention", body: [
    "We use reasonable technical and organizational measures to protect your information, including encryption in transit and access controls. No method of transmission or storage is 100% secure.",
    "We keep information for as long as your account is active or as needed to provide the Services, comply with legal obligations, resolve disputes, and enforce agreements.",
  ]},
  { h: "7. Your rights", body: [
    "Depending on where you live (including under GDPR and CCPA), you may have the right to access, correct, delete, or export your personal information, and to object to or restrict certain processing. To make a request, contact us at " + SUPPORT + ".",
  ]},
  { h: "8. Children", body: [
    "The Services are not directed to children under 13 (or the minimum age required by Discord in your region). We do not knowingly collect personal information from children. If you believe a child has provided us information, contact us and we will delete it.",
  ]},
  { h: "9. Changes & contact", body: [
    "We may update this policy from time to time. Material changes will be posted here with a new effective date. Questions? Email us at " + SUPPORT + ".",
  ]},
];

const TERMS: Section[] = [
  { h: "1. Acceptance of terms", body: [
    "These Terms of Use (\"Terms\") govern your access to and use of Oversite's website and Services. By creating an account or using the Services, you agree to these Terms. If you don't agree, don't use the Services.",
  ]},
  { h: "2. Eligibility & accounts", body: [
    "You must be at least 13 years old (or the minimum age Discord requires in your region) and able to form a binding contract. You're responsible for your account, for keeping your credentials secure, and for all activity under your account.",
  ]},
  { h: "3. The Services", body: [
    "Oversite provides managed Discord bots and related hosting. We configure, deploy, and maintain bots based on the options you select. We may add, change, or discontinue features, and we may need to perform maintenance that temporarily affects availability.",
  ]},
  { h: "4. Acceptable use", body: [
    "You agree not to use the Services to break the law, violate Discord's Terms of Service or Community Guidelines, infringe others' rights, distribute malware or spam, harass others, or interfere with or attempt to gain unauthorized access to the Services or other users' data.",
    "You are responsible for how the bots are used in servers you control, and for ensuring your use complies with all applicable rules and laws.",
  ]},
  { h: "5. Fees & billing", body: [
    "Paid Services are billed as described at checkout and in our Sales & Refunds policy. By purchasing, you authorize us and our payment processor to charge your selected payment method for the applicable fees, including recurring charges until you cancel.",
  ]},
  { h: "6. Intellectual property", body: [
    "Oversite and its software, branding, and content are owned by Oversite and protected by law. We grant you a limited, non-exclusive, non-transferable right to use the Services. You retain ownership of the content and configuration you provide; you grant us the rights needed to operate the Services for you.",
  ]},
  { h: "7. Service availability — \"as is\"", body: [
    "The Services are provided \"as is\" and \"as available\" without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the Services will be uninterrupted, error-free, or that bots will always remain online, including due to factors outside our control such as Discord outages.",
  ]},
  { h: "8. Limitation of liability", body: [
    "To the maximum extent permitted by law, Oversite will not be liable for any indirect, incidental, special, consequential, or punitive damages, or for lost profits, data, or goodwill. Our total liability for any claim relating to the Services will not exceed the amount you paid us in the three (3) months before the event giving rise to the claim.",
  ]},
  { h: "9. Indemnification", body: [
    "You agree to indemnify and hold Oversite harmless from claims, damages, and expenses (including reasonable legal fees) arising from your use of the Services, your content, or your violation of these Terms or applicable law.",
  ]},
  { h: "10. Suspension & termination", body: [
    "We may suspend or terminate your access if you violate these Terms, fail to pay, or create risk or legal exposure for us. You may stop using the Services at any time; certain provisions (such as fees owed, IP, disclaimers, and limitation of liability) survive termination.",
  ]},
  { h: "11. Governing law & changes", body: [
    "These Terms are governed by the laws of " + STATE + ", without regard to conflict-of-laws rules. We may update these Terms; material changes will be posted here with a new effective date, and continued use means you accept them. Questions? Email " + SUPPORT + ".",
  ]},
];

const REFUNDS: Section[] = [
  { h: "1. Pricing & billing", body: [
    "Prices are shown at checkout. Bot hosting may be offered as a one-time purchase or a recurring subscription, as indicated at the time of purchase. Recurring plans renew automatically at the then-current price until cancelled.",
    "Payments are processed securely by Stripe. You authorize us to charge your selected payment method for all applicable fees, including renewals.",
  ]},
  { h: "2. Cancellations", body: [
    "You can cancel a recurring plan at any time from your account or by contacting us. Cancellation stops future renewals; your bot remains active through the end of the current paid period, after which hosting ends.",
  ]},
  { h: "3. Refund policy", body: [
    "Because the Services are digital and delivered/hosted on demand, all sales are generally final. As a courtesy, we may offer a refund if you request one within [7 days] of purchase AND your bot has not yet been deployed or substantially used. [Adjust this window and conditions to match the policy you want to offer.]",
    "Refunds are not available for time already elapsed on a hosting period, for renewals you forgot to cancel, or where we've terminated your access for violating these terms.",
  ]},
  { h: "4. Failed payments", body: [
    "If a renewal payment fails, we may retry the charge and may suspend or pause your bot until payment succeeds. Extended non-payment may result in termination of the Service and deletion of associated configuration.",
  ]},
  { h: "5. Chargebacks", body: [
    "If you have a billing concern, please contact us first — we're happy to help. Filing a chargeback without contacting us may result in immediate suspension of your account while the dispute is reviewed.",
  ]},
  { h: "6. Contact", body: [
    "For billing questions or refund requests, email " + SUPPORT + ".",
  ]},
];

const DOCS: Doc[] = [
  { key: "privacy", label: "Privacy Policy", title: "Privacy Policy", icon: ShieldCheck, intro: "How Oversite collects, uses and protects your information.", sections: PRIVACY },
  { key: "terms", label: "Terms of Use", title: "Terms of Use", icon: FileText, intro: "The rules for using Oversite's website and services.", sections: TERMS },
  { key: "refunds", label: "Sales & Refunds", title: "Sales & Refunds", icon: Receipt, intro: "Billing, cancellations and our refund policy.", sections: REFUNDS },
];

const Terms = () => {
  const { hash } = useLocation();
  const [active, setActive] = useState<string>("privacy");

  useEffect(() => {
    const key = hash.replace("#", "");
    if (DOCS.some((d) => d.key === key)) setActive(key);
  }, [hash]);

  const doc = DOCS.find((d) => d.key === active) ?? DOCS[0];

  return (
    <div className="oversite-theme min-h-screen bg-os-bg font-body text-os-body antialiased">
      <SiteNav />
      <main className="mx-auto w-full max-w-[1000px] px-5 pb-24 pt-28">
        <header>
          <p className="font-label text-[11px] uppercase tracking-[0.2em] text-os-faint">Legal</p>
          <h1 className="mt-2 text-[clamp(2rem,5vw,3rem)] font-extrabold tracking-[-0.02em] text-os-heading">
            Policies &amp; terms
          </h1>
          <p className="mt-2 text-[13px] text-os-faint">
            Effective {EFFECTIVE} · Governing law: {STATE}
          </p>
        </header>

        <div className="mt-10 grid gap-8 lg:grid-cols-[220px_1fr]">
          <nav className="flex gap-2 overflow-x-auto lg:sticky lg:top-28 lg:h-max lg:flex-col lg:overflow-visible">
            {DOCS.map((d) => {
              const Icon = d.icon;
              const on = d.key === active;
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setActive(d.key)}
                  className={cn(
                    "flex flex-none items-center gap-2.5 rounded-[10px] border px-4 py-2.5 text-left text-[13px] font-semibold transition",
                    on
                      ? "border-os-accent/40 bg-os-accent/10 text-os-heading"
                      : "border-os-hairline/30 text-os-body hover:border-os-hairline/50 hover:text-os-heading",
                  )}
                >
                  <Icon size={15} className={on ? "text-os-accent" : "text-os-faint"} aria-hidden />
                  {d.label}
                </button>
              );
            })}
          </nav>

          <article className="rounded-[18px] border border-os-hairline/30 bg-os-surface/40 p-6 sm:p-9">
            <h2 className="text-[24px] font-bold text-os-heading">{doc.title}</h2>
            <p className="mt-1.5 text-[13.5px] text-os-faint">{doc.intro}</p>

            <div className="mt-7 space-y-8">
              {doc.sections.map((s) => (
                <section key={s.h}>
                  <h3 className="text-[15px] font-bold text-os-heading">{s.h}</h3>
                  <div className="mt-2.5 space-y-3">
                    {s.body.map((p, i) => (
                      <p key={i} className="text-[13.5px] leading-relaxed text-os-body">{p}</p>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <p className="mt-9 rounded-[10px] border border-os-hairline/30 bg-os-bg/40 px-4 py-3 text-[12px] text-os-faint">
              ⓘ Starting copy — review and adjust the bracketed items before launch.
            </p>
          </article>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Terms;
