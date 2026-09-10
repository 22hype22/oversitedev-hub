# Legal documents: drafting notes for counsel

These notes go with the Privacy Policy, Terms of Use and Sales & Refund Policy
that live in `src/pages/Terms.tsx` and are published at oversite.shop/legal.
They record what the documents were drafted against, the choices made, and the
points that need a licensed Minnesota attorney's judgment. Nothing here is
legal advice.

Effective date in the documents: September 10, 2026.

## What Oversite actually does (the facts the documents describe)

- Sole proprietorship based in Minnesota. No entity name other than Oversite.
- Sells managed Discord bots. Protection, Support, Utilities and the All in One
  Pack: one-time fee plus a continuous monthly hosting subscription, tiered per
  account (one bot $5/mo, two bots $10/mo, third bot free). Customs, Roleplay and
  Dispatch (Roblox and ER:LC bots) and extra server slots: one-time only.
- Card payments through Stripe. Card saved at checkout, charged when the build
  starts. Waitlist and pre-order orders are not charged until a slot opens or
  the product ships. Payment plans of 3, 6 or 10 equal monthly instalments, no
  interest, due on the 1st, grace to the 15th.
- Robux payments: buyer purchases a shirt (Roblox Select accounts) or a
  developer product (standard accounts) from the Oversite Customs group at the
  dollar price plus 30 percent, 100 Robux per dollar, rounded up to end in 999.
  The sale is matched against the group's sales log within five minutes.
  Refund is 70 percent, paid through the group, and Roblox requires 14 days of
  group membership before a payout.
- Cancelling: one step in the dashboard, 30-second undo, then the bot leaves
  every server and its data is deleted. Charges stop immediately. No partial
  refund of the current month outside the 14-day guarantee.
- 14-day money-back guarantee on the initial purchase (one-time fee plus first
  month of hosting), refund to the original payment method.
- Failed hosting payment: 10-day grace, then cancellation.
- Downtime credit: a full month of hosting for a bot down 3 or more days.
- Ages: 13 or Discord's minimum. Under 18 must buy through a parent.
- Hosting: Supabase (database, auth, functions) and Railway (bots), both in the
  United States. Lovable is used only for the domain, not for the site.
- AI providers: Anthropic (support chat, avatar screening, Dispatch),
  Google Gemini (translation), Google, Microsoft and ElevenLabs (voices).

## Minnesota statutes the documents were drafted against

### Automatic renewal: Minn. Stat. 325G.56 to 325G.62 (effective 2024)

Applies to the hosting subscription. Requirements and where they are met:

- Clear and conspicuous disclosure of the automatic renewal offer terms before
  the consumer accepts (325G.57): Sales & Refund Policy "Automatic renewal of
  hosting", Terms "Prices, payment and renewal". The checkout page must also
  show these terms next to the price. See the open item below.
- Affirmative consent before charging (325G.57): the Place order button is the
  consent. Counsel should confirm the checkout copy above the button is enough.
- A retainable acknowledgment with the offer terms, the cancellation policy and
  how to cancel (325G.57 subd. 1(c)): the documents say the order confirmation
  and the first Stripe receipt contain this. See the open item below.
- Cost-effective, timely, easy-to-use cancellation, online where the contract
  was made online, and an "immediate termination election" (325G.60): one step
  in the dashboard, no survey, no offers, email also accepted.
- Notice before a material change in the terms, including price (325G.58):
  documents promise 30 days' email notice before a renewal at a new price.
- Continuous-service reminder: documents promise a yearly email reminder of
  the subscription and how to cancel. See the open item below.
- Remedy: goods or services sent without compliant consent are an
  unconditional gift (325G.61). This is why the checkout acknowledgment matters.

### Minnesota Consumer Data Privacy Act: Minn. Stat. ch. 325M (effective July 31, 2025)

- Threshold: 100,000 consumers, or 25,000 consumers with more than 25 percent
  of revenue from selling data. Oversite is probably below the threshold today
  (about 2,000 customers, but bots see many more server members). Small
  businesses under the SBA definition are exempt from most of the Act except
  the ban on selling sensitive data without consent (325M.11 subd. 5). The
  Privacy Policy was written to comply anyway, because it costs little and
  because the Act's rights track the GDPR and CCPA rights customers expect.
- Privacy notice contents (325M.14): categories collected, purposes, categories
  shared and with whom, how to exercise rights and appeal, contact details,
  and a list of specific third parties on request. All present.
- Rights (325M.05): access, correction, deletion, portability, a list of
  specific third parties, opt out of sale, targeted advertising and profiling,
  and the right to question profiling results. All present.
- Timing (325M.06): respond within 45 days, one 45-day extension with notice;
  appeal within 45 days; appeal decided within 45 days with written reasons and
  a way to contact the Attorney General. All present.
- Data inventory and documented policies (325M.07 subd. 3): Oversite should
  keep a written data inventory. This is an operational item, not in the
  policy.
- Children: data of a known child under 13 is sensitive data and needs
  verified parental consent; 13 to 15 needs consent for sale and targeted
  advertising. Oversite does neither. Age floor is 13.

### Deceptive Trade Practices Act and Consumer Fraud Act: 325D.44, 325F.69

- All-in pricing (325D.44 subd. 1(16), effective January 1, 2025): the price
  first displayed must include all mandatory fees except government taxes and
  shipping. The documents say prices include every mandatory fee and any sales
  tax. The site must not add anything at checkout that was not in the first
  displayed price.
- False price reductions (325D.44 subd. 1(11), (13)): a struck-through former
  price must be a genuine former price. See the open item on "preorder sale".
- The 14-day guarantee, the downtime credit and the 24-to-48-hour reply time
  are now promises in the documents. Each must be honoured in practice or it
  becomes a deceptive practice claim.

### Breach notification: Minn. Stat. 325E.61

- Notify affected Minnesota residents without unreasonable delay; if more than
  500 people are notified at once, notify the consumer reporting agencies
  within 48 hours. The Privacy Policy promises notice "as the law requires".
  Have an incident plan on hand.

### Other Minnesota points

- Age of majority is 18 (Minn. Stat. 645.451). A minor's contract is voidable
  by the minor, which is why the documents make the parent the customer for
  anyone under 18, including Robux purchases from Roblox Select accounts.
- 325F.80 (refund policy posting) applies to retail premises, not online.
- Software as a service delivered electronically is generally not subject to
  Minnesota sales tax; the "includes any sales tax that applies" wording covers
  the case where it is.
- Statute of limitations: contractual shortening to one year is generally
  enforceable in Minnesota if reasonable; the clause says "to the extent the
  law allows". Counsel should confirm it does not conflict with 325F.69 claims.

## Federal points

- Federal Arbitration Act governs the arbitration clause. AAA Consumer
  Arbitration Rules (May 2025) are named. The AAA requires businesses to
  register consumer arbitration clauses in its Consumer Clause Registry before
  filing (fee applies). See the open item below.
- Heckman v. Live Nation (9th Cir. 2024) struck an arbitration clause for
  mass-arbitration rules that favoured the business. The clause here uses the
  standard AAA consumer rules, a 30-day opt-out, small-claims and injunction
  carve-outs, and lets a court decide the class-waiver question, all of which
  help enforceability.
- ROSCA (15 U.S.C. 8403) for online negative-option features: clear
  disclosure before charging, express informed consent, simple cancellation.
  Covered by the same provisions as the Minnesota renewal law.
- COPPA: no accounts under 13, no knowing collection.
- E-SIGN: electronic notices clause in "Everything else".
- DMCA: a notice procedure is included. Registering a designated agent with the
  Copyright Office ($6) is needed to get the safe harbour. See open items.

## Platform terms

- Discord Developer Terms and Developer Policy: privacy policy must be linked
  in the Developer Portal for each application; data must be deleted on
  request; no selling of data; no use beyond what the user authorised. The
  Privacy Policy states all of this. Each Discord application in the pool needs
  the link set.
- Roblox Terms of Use: Roblox prohibits selling or trading Robux, virtual items
  and off-platform goods for Robux, and prohibits payment for anything not
  "inside the experience". Selling Discord bot hosting for Robux through group
  shirts and developer products is, in our reading, a breach of Roblox's terms
  that could lead to the group, the payment experience or the accounts being
  actioned. This is the single largest risk in the business model. The
  documents shift what they can onto the buyer (must be allowed to use the
  account, Roblox decides its own terms, no liability for Roblox's actions),
  but they cannot make the practice compliant with Roblox's rules. Counsel
  should look at this squarely.

## Drafting choices worth knowing

- Cancellation now removes the bot immediately after the 30-second undo. The
  earlier documents let the bot run to the end of the paid period. The site's
  FAQ, the help lounge and the support-chat brief were updated to match.
- The limitation of liability is the greater of 12 months of payments or $100.
  Consequential damages are excluded. Carve-outs for fraud, personal injury and
  anything the law forbids limiting.
- Indemnity is limited to third-party claims arising from the customer's
  servers, content, use, breach or violations.
- Disclaimers and the arbitration notice are in capitals for conspicuousness.
- Governing law is Minnesota; venue for anything outside arbitration is
  Minnesota courts, with small claims where the customer lives.
- Terms changes: 14 days' notice for material changes with a refund of prepaid
  hosting if the customer leaves because the change reduces what they paid
  for. Privacy Policy changes: notice before effect.
- The documents mention Lovable nowhere, per the owner's instruction that it
  is used only for the domain.
- Data location is described as the United States, not Minnesota, because the
  providers run in US regions outside Minnesota. The support brief says the
  same.
- The support assistant is described as unable to see or change accounts and
  as not able to alter the Terms. This closes the "the bot told me" argument.
- The Privacy Policy says AI providers are used through business interfaces
  whose terms do not permit training on submitted content. This is true of the
  Anthropic API, the Google Gemini paid API and ElevenLabs, but check the
  translation path, which still goes through a third-party gateway in code.

## Open items to fix in the product (not just in the text)

1. Checkout acknowledgment (325G.57): the order confirmation email must state
   the monthly amount, that it renews monthly until cancelled, and how to
   cancel. Check the current confirmation email; add this if missing.
2. Checkout page (325G.57): done. The line under the Place order button now
   states the monthly amount, that it is charged when the build starts and
   every month until cancelled, and that cancelling is one step in the
   dashboard. Counsel should confirm the size and placement are conspicuous
   enough; the line is small text.
3. Annual continuous-service reminder email: promised in the documents, not
   yet built. Needs a yearly email to every account with an active hosting
   subscription.
4. Price-change notice: the documents promise 30 days' email notice before a
   renewal at a new price. There is no tooling for this; it must be done by
   hand before any price change.
5. Automatic 14-day refund: the documents say cancelling in the dashboard
   within 14 days issues the refund automatically. Nothing in the code issues a
   Stripe refund on cancel today. Until that is built, someone must refund by
   hand from Stripe whenever a bot is cancelled within 14 days of its charge,
   or the wording should change to "email us and we will refund".
6. "Preorder sale" strike-through prices: only show a struck-through price if
   the product was genuinely sold at that price for a reasonable period.
7. Discord Developer Portal: set the privacy policy and terms links on every
   pooled application.
8. AAA Consumer Clause Registry: register the arbitration clause with the AAA.
9. DMCA agent: register a designated agent with the US Copyright Office.
10. Data inventory and incident plan: write both down.
11. Account deletion: the policy promises 30 days at most, usually two business
    days. Make sure deletion requests are tracked.
12. Roblox: decide, with counsel, whether to keep taking Robux at all.

## Questions for the lawyer

- Is the sole proprietorship the right vehicle given the liability exposure,
  or should Oversite form an LLC before these documents go live?
- Does the parent-as-customer structure hold up for Robux purchases from
  accounts Roblox designates for younger users?
- Is the one-year limitations clause enforceable against consumer-fraud claims?
- Is the "greater of 12 months or $100" cap reasonable for a service at this
  price point?
- Should the arbitration clause add a mass-arbitration bellwether process, or
  is the plain AAA consumer process safer after Heckman?
- Does the downtime credit as "sole remedy" survive Minnesota consumer law?
- Should the documents name the owner personally, since a sole proprietorship
  has no separate legal identity?
