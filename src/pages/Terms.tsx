import { useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ShieldCheck, FileText, Receipt } from "lucide-react";
import { SiteNav } from "@/components/marketing/SiteNav";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { cn } from "@/lib/utils";

/**
 * Legal — Privacy Policy, Terms of Use and Sales & Refunds, tabbed.
 * Route: /terms (deep-linkable via #privacy / #terms / #refunds).
 *
 * Drafted to Oversite's actual operating model (Minnesota sole proprietorship,
 * one-time build fee + monthly subscription, 14-day money-back, binding
 * arbitration, 13+). Solid and concrete, but not a substitute for review by a
 * licensed attorney once the business is registered.
 */

const SUPPORT = "support@oversite.shop";
const EFFECTIVE = "September 9, 2026";
const STATE = "Minnesota, United States";

type Section = { h: string; body: string[] };
type Doc = { key: string; slug: string; label: string; title: string; icon: typeof FileText; intro: string; sections: Section[] };

const PRIVACY: Section[] = [
  { h: "1. Who we are", body: [
    "Oversite (“Oversite,” “we,” “us,” “our”) is a sole proprietorship based in " + STATE + " that provides managed Discord bots and related hosting (the “Services”). This Privacy Policy explains what information we collect, how we use it, who we share it with, and the choices you have.",
    "By creating an account or using the Services, you agree to this Privacy Policy. If you do not agree, please do not use the Services. Questions: " + SUPPORT + ".",
  ]},
  { h: "2. Account information you provide", body: [
    "When you create an account we collect your email address and a password, which is stored only as a salted, irreversible hash — we never store your password in plain text. You may also provide a display name and your Discord username.",
    "If you sign in with Discord or Google, we receive basic profile information from that provider (such as your account ID, username or name, email address, and avatar) to create and secure your account. We do not receive your Discord or Google password.",
  ]},
  { h: "3. Payment information", body: [
    "Payments are processed by our payment processor, Stripe. When you purchase, Stripe collects and stores your payment card details directly. Oversite never receives or stores your full card number — we receive only limited information such as the card brand, the last four digits, expiration, and the Stripe customer and subscription identifiers needed to manage your billing.",
    "Your use of Stripe is also subject to Stripe’s own privacy policy and terms.",
  ]},
  { h: "4. Data our bots access and store", body: [
    "When you add an Oversite bot to a Discord server you control, the bot accesses and may store data from that server in order to provide the features you enable. Depending on the features turned on, this can include:",
    "• Server, channel, category, and role identifiers, names, and settings; • Member information such as Discord user IDs, usernames, nicknames, roles, and join/leave activity; • Message content and metadata where a feature requires it — for example automated moderation, moderation/audit logs, support ticket transcripts, starboard, and message-to-action features;",
    "• Moderation records such as warnings, mutes, bans, kicks, case notes, and moderation history; • Support data such as ticket contents and transcripts; • Utility data such as leveling/XP, economy balances, giveaway entries, reaction roles, server statistics, and third-party alert settings (e.g., Twitch/YouTube); and • The configuration you set in the dashboard.",
    "The exact data stored depends on which features you enable, and you control what the bot can access through the Discord permissions you grant it. You are responsible for telling your own server members how their data is used, where required.",
  ]},
  { h: "5. How we use information", body: [
    "We use information to: create and manage your account; configure, deploy, host, and maintain your bots; process payments, subscriptions, and renewals; provide customer support; operate and secure the Services and prevent fraud and abuse; send you service, account, billing, and (optional) update notifications; comply with legal obligations; and improve the Services.",
  ]},
  { h: "6. How we share information", body: [
    "We share information only as needed to run the Services, with providers that process data on our behalf: Stripe (payments), Discord and Google (sign-in and bot functionality), Supabase (database and authentication), our hosting and infrastructure providers (for example, Railway), and the artificial intelligence providers described in Section 7.",
    "We may also disclose information if required by law or valid legal process, or where we believe in good faith it is necessary to enforce our terms or protect the rights, safety, and property of Oversite, our users, or others. We do not sell your personal information.",
  ]},
  { h: "7. Artificial intelligence features", body: [
    "Some features of the Services are powered by artificial intelligence models run by third parties. Message translation uses Google Gemini models through an AI gateway operated by Lovable. Avatar safety screening on the Protection bot sends the avatar image being checked to Anthropic (Claude). Text-to-speech and radio voices use Google, Microsoft, or ElevenLabs speech services, depending on what the bot owner has enabled. We may add or change providers; this section will be updated when we do.",
    "We send a provider only the content that feature needs: the text being translated, the image being screened, or the text being spoken. We do not send your account details, payment details, or Discord credentials to AI providers, and we do not use your content to train AI models. Content sent to a provider is processed under that provider’s own terms and privacy policy.",
    "AI output can be wrong, incomplete, or inappropriate. Automated actions a bot takes based on AI output, such as flagging or removing an avatar, are controlled by the server owner’s settings and can be reviewed and reversed by the server’s staff. If you believe an automated decision was made in error, contact the server’s staff or reach us at " + SUPPORT + ".",
    "We also use AI-assisted tools to help build and operate the Services, including writing and reviewing code and drafting support replies. A person at Oversite remains responsible for the Services and for any reply you receive from us.",
  ]},
  { h: "8. Cookies", body: [
    "We use essential cookies and similar technologies to keep you signed in and remember your preferences. We do not use third-party advertising cookies. You can control cookies in your browser settings, but some features may not work without them.",
  ]},
  { h: "9. Data security", body: [
    "We use reasonable technical and organizational safeguards, including encryption of data in transit and access controls, to protect your information. However, no method of transmission or storage is completely secure, and we cannot guarantee absolute security.",
  ]},
  { h: "10. Data retention & deletion", body: [
    "We keep information for as long as your account and bots are active and as needed to provide the Services, comply with legal and tax obligations, resolve disputes, and enforce our agreements.",
    "When you remove a bot from a server, that bot stops collecting new data from it. When you delete your account, or on request, we delete or anonymize your associated personal data within a reasonable period, except where we are required to retain it by law.",
  ]},
  { h: "11. Your rights & choices", body: [
    "Depending on where you live (including under the GDPR and CCPA), you may have the right to access, correct, delete, port, or restrict the processing of your personal information, and to object to certain processing. To exercise these rights, email " + SUPPORT + ". You can also remove a bot from your server at any time and manage optional notification categories in your account settings.",
  ]},
  { h: "12. Children", body: [
    "The Services are intended for users who are at least 13 years old (or the minimum age Discord requires in your region). We do not knowingly collect personal information from children under 13. If you believe a child under 13 has provided us information, contact " + SUPPORT + " and we will delete it.",
  ]},
  { h: "13. International users & changes", body: [
    "We operate from the United States; if you use the Services from outside the U.S., your information is processed in the U.S. We may update this Privacy Policy from time to time; material changes will be posted here with a new effective date, and your continued use of the Services means you accept the updated policy.",
  ]},
];

const TERMS: Section[] = [
  { h: "1. Agreement to these terms", body: [
    "These Terms of Use (“Terms”) are a binding agreement between you and Oversite, a sole proprietorship based in " + STATE + " (“Oversite,” “we,” “us”). They govern your access to and use of our website and Services. By creating an account or using the Services, you agree to these Terms and to our Privacy Policy. If you do not agree, do not use the Services.",
  ]},
  { h: "2. Eligibility", body: [
    "You must be at least 13 years old (or the minimum age Discord requires in your region) to use the Services. If you are under the age of majority where you live, you may use the Services only with the involvement and consent of a parent or legal guardian. By using the Services you represent that you meet these requirements and have the authority to enter into these Terms.",
  ]},
  { h: "3. Your account", body: [
    "You are responsible for the information you provide, for keeping your login credentials secure, and for all activity that occurs under your account. Notify us promptly at " + SUPPORT + " if you suspect unauthorized use. You may not share, sell, or transfer your account.",
  ]},
  { h: "4. The Services", body: [
    "Oversite provides managed Discord bots and related hosting. We configure, deploy, and maintain bots based on the options you select at purchase and in the dashboard. We may add, change, suspend, or discontinue features, and we may perform maintenance that temporarily affects availability. You are responsible for having the authority to add bots to any Discord server you connect and for that server’s compliance with Discord’s rules.",
  ]},
  { h: "5. Acceptable use", body: [
    "You agree not to use the Services to: violate any law or regulation; violate Discord’s Terms of Service or Community Guidelines; infringe anyone’s intellectual property or privacy rights; distribute malware, spam, or harmful content; harass, abuse, or harm others; or interfere with, disrupt, reverse engineer, or attempt to gain unauthorized access to the Services, our systems, or other users’ data.",
    "You are solely responsible for how the bots are configured and used in the servers you control, and for ensuring that use complies with all applicable rules and laws. We may suspend or remove bots that we reasonably believe violate these Terms or create risk.",
  ]},
  { h: "6. Fees, subscriptions & renewals", body: [
    "Some Services require a one-time build/setup fee and an ongoing monthly subscription for hosting, as shown at checkout; others (such as our ER:LC / Roblox bots) are one-time purchases with hosting included and no recurring fee. By purchasing, you authorize Oversite and Stripe to charge your selected payment method for the amounts shown at checkout — including, where applicable, a recurring monthly fee that automatically renews each month at the then-current price until you cancel.",
    "You may cancel at any time. When you cancel, your bot remains active through the end of the month you have already paid for, and is then removed from your server. Billing details, cancellation, and refunds are described in our Sales & Refunds policy, which is part of these Terms.",
  ]},
  { h: "7. Your content & license to operate", body: [
    "You retain ownership of the content, data, and configuration you and your server provide. You grant Oversite the limited rights necessary to host, process, and display that content solely to operate and provide the Services to you. You represent that you have the rights and permissions needed to provide it.",
  ]},
  { h: "8. Intellectual property", body: [
    "Oversite and its software, bots, branding, designs, and content are owned by Oversite and protected by intellectual property laws. We grant you a limited, non-exclusive, non-transferable, revocable right to use the Services as intended. You may not copy, modify, resell, or create derivative works from the Services except as expressly permitted.",
  ]},
  { h: "9. Third-party services", body: [
    "The Services rely on third parties including Discord, Stripe, Google, and our infrastructure providers. Your use of those services is subject to their terms and policies. We are not responsible for third-party services or for outages, changes, or actions outside our control (including Discord outages or API changes).",
  ]},
  { h: "10. Artificial intelligence & automated features", body: [
    "Parts of the Services use artificial intelligence, including message translation, text-to-speech and radio voices, avatar and content screening, and similar features we may add. AI-generated output may be inaccurate, incomplete, offensive, or unsuitable for your purpose. You are responsible for reviewing AI output before relying on it, and it is not legal, financial, medical, or other professional advice.",
    "Automated actions taken by a bot, including actions based on AI output, follow the settings chosen by the server owner. The server owner is responsible for those settings and for reviewing and reversing automated actions where appropriate. Oversite is not liable for automated actions taken under a server owner’s configuration.",
    "You may not use AI features to create or distribute content that is unlawful, that infringes the rights of others, or that violates Discord’s or Roblox’s rules. AI features are provided by third-party providers named in our Privacy Policy and your use of them is also subject to those providers’ terms.",
    "We use AI-assisted tools in building and operating the Services, including software development and customer support, under human supervision. Nothing in the Services should be read as a promise that any particular part was or was not produced with AI assistance.",
  ]},
  { h: "11. Disclaimers — “as is”", body: [
    "The Services are provided “as is” and “as available,” without warranties of any kind, whether express, implied, or statutory, including any implied warranties of merchantability, fitness for a particular purpose, title, and non-infringement. We do not warrant that the Services will be uninterrupted, secure, error-free, or that bots will remain online at all times, including due to factors outside our control.",
  ]},
  { h: "12. Limitation of liability", body: [
    "To the maximum extent permitted by law, Oversite and its owner will not be liable for any indirect, incidental, special, consequential, exemplary, or punitive damages, or for any loss of profits, revenue, data, goodwill, or business, arising out of or related to the Services, even if advised of the possibility.",
    "To the maximum extent permitted by law, Oversite’s total aggregate liability for all claims relating to the Services will not exceed the greater of (a) the total amount you paid Oversite in the three (3) months before the event giving rise to the claim, or (b) twenty U.S. dollars ($20).",
  ]},
  { h: "13. Indemnification", body: [
    "You agree to indemnify, defend, and hold harmless Oversite and its owner from and against any claims, damages, losses, liabilities, and expenses (including reasonable attorneys’ fees) arising out of or related to your use of the Services, your content or servers, your violation of these Terms, or your violation of any law or third-party right.",
  ]},
  { h: "14. Suspension & termination", body: [
    "We may suspend or terminate your access, with or without notice, if you violate these Terms, fail to pay, or create legal risk or harm to the Services or others. You may stop using the Services at any time by cancelling and removing the bots. Sections that by their nature should survive termination — including fees owed, ownership, disclaimers, limitation of liability, indemnification, and dispute resolution — will survive.",
  ]},
  { h: "15. Dispute resolution — arbitration & class-action waiver", body: [
    "Please read this section carefully — it affects your legal rights. First, informal resolution: before starting any formal proceeding, you agree to contact us at " + SUPPORT + " and give us at least thirty (30) days to resolve the dispute informally.",
    "Binding arbitration: except as noted below, any dispute arising out of or relating to the Services or these Terms will be resolved by final and binding individual arbitration administered under the rules of a recognized arbitration provider, rather than in court. The Federal Arbitration Act governs the interpretation and enforcement of this section.",
    "Class-action & jury waiver: you and Oversite agree that disputes will be brought only in an individual capacity, and not as a plaintiff or class member in any class, collective, or representative proceeding. You and Oversite waive any right to a jury trial.",
    "Exceptions & opt-out: either party may bring an individual claim in small-claims court, and either party may seek injunctive relief for intellectual-property or unauthorized-access claims. You may opt out of this arbitration agreement by emailing " + SUPPORT + " within thirty (30) days of first accepting these Terms, stating your intent to opt out.",
  ]},
  { h: "16. Governing law & changes", body: [
    "These Terms and any dispute are governed by the laws of the State of Minnesota and applicable U.S. federal law, without regard to conflict-of-laws rules; venue for any matter not subject to arbitration lies in the state or federal courts located in Minnesota. We may update these Terms from time to time; material changes will be posted here with a new effective date, and your continued use means you accept them.",
  ]},
  { h: "17. Contact", body: [
    "Questions about these Terms? Email " + SUPPORT + ".",
  ]},
];

const REFUNDS: Section[] = [
  { h: "1. What you are purchasing", body: [
    "Most Oversite Discord bots are sold as a one-time build/setup fee plus an ongoing monthly hosting subscription, as shown at checkout. The one-time fee covers building and deploying your bot; the monthly fee keeps it hosted, maintained, and online.",
    "Some products — including our ER:LC / Roblox bots (for example Dispatch and Customs) — are one-time purchases with hosting included at no additional charge, and have no recurring monthly fee. What applies to your order is always shown at checkout before you pay and is what governs your purchase.",
    "Prices are listed at checkout and may exclude applicable taxes, which will be added where required.",
  ]},
  { h: "2. Billing & automatic renewal", body: [
    "Payments are processed securely by Stripe. For bots that include a monthly hosting subscription, you are charged the one-time fee and your first monthly fee at purchase, and the monthly subscription then automatically renews each month at the then-current price, charged to your payment method on file, until you cancel. By purchasing, you authorize these recurring charges. Products sold as one-time purchases (such as our ER:LC / Roblox bots) are charged once and do not renew.",
  ]},
  { h: "3. Cancellation", body: [
    "You can cancel your subscription at any time from your account settings or by emailing " + SUPPORT + ". When you cancel, your bot stays active through the end of the month you have already paid for; after that period ends, the subscription stops, no further charges are made, and the bot is removed from your server. We do not provide partial-month refunds for cancellations (see the money-back guarantee below).",
  ]},
  { h: "4. 14-day money-back guarantee", body: [
    "If you are not satisfied, you may request a full refund of your initial purchase (the one-time fee plus your first month) by emailing " + SUPPORT + " within fourteen (14) days of that initial purchase. Approved refunds are returned to your original payment method, and your bot will be removed from your server.",
    "After the 14-day window, all fees are non-refundable. Monthly renewal charges are not refundable — to avoid a renewal, cancel before your next billing date. Refunds are not available where we have terminated your access for violating these terms.",
  ]},
  { h: "5. Failed payments", body: [
    "If a renewal payment fails, we may retry the charge and may pause or suspend your bot until payment succeeds. Extended non-payment may result in termination of the Services and deletion of associated configuration and data.",
  ]},
  { h: "6. Price changes", body: [
    "We may change prices for the Services. Any price change will apply to your next renewal after we provide notice; you can cancel before the change takes effect if you do not agree.",
  ]},
  { h: "7. Chargebacks", body: [
    "If you have a billing concern, please contact " + SUPPORT + " first — we want to make it right. Filing a chargeback or payment dispute without first contacting us may result in immediate suspension or termination of your account while the dispute is reviewed.",
  ]},
  { h: "8. Contact", body: [
    "For billing questions, cancellations, or refund requests, email " + SUPPORT + ".",
  ]},
];

const DOCS: Doc[] = [
  { key: "privacy", slug: "privacy-policy", label: "Privacy Policy", title: "Privacy Policy", icon: ShieldCheck, intro: "How Oversite collects, uses and protects your information.", sections: PRIVACY },
  { key: "terms", slug: "terms-of-use", label: "Terms of Use", title: "Terms of Use", icon: FileText, intro: "The rules for using Oversite’s website and services.", sections: TERMS },
  { key: "refunds", slug: "sales-and-refunds", label: "Sales & Refunds", title: "Sales & Refunds", icon: Receipt, intro: "Billing, automatic renewal, cancellations and refunds.", sections: REFUNDS },
];

const Terms = () => {
  // Each document has its own address under /legal. The old /terms#key
  // addresses still work: they are sent to the matching new one.
  const { hash } = useLocation();
  const { doc: slug } = useParams<{ doc: string }>();
  const navigate = useNavigate();
  useEffect(() => {
    if (slug) return;
    const key = hash.replace("#", "");
    const target = DOCS.find((d) => d.key === key) ?? DOCS[0];
    navigate(`/legal/${target.slug}`, { replace: true });
  }, [slug, hash, navigate]);
  const active = DOCS.find((d) => d.slug === slug)?.key ?? "privacy";
  const setActive = (key: string) => {
    const target = DOCS.find((d) => d.key === key);
    if (target) navigate(`/legal/${target.slug}`);
  };

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
            Effective {EFFECTIVE} · Oversite · {STATE}
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
          </article>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Terms;
