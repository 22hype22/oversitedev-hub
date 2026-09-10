import { useEffect } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ShieldCheck, FileText, Receipt } from "lucide-react";
import { SiteNav } from "@/components/marketing/SiteNav";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { cn } from "@/lib/utils";

/**
 * Legal: the Privacy Policy, the Terms of Use and the Sales & Refund Policy.
 * Each lives at its own address under /legal, and /legal is the index.
 *
 * Written for Oversite's actual operating model: a Minnesota sole
 * proprietorship selling managed Discord bots, some with a one-time fee plus
 * a continuous monthly hosting subscription, some one-time only, paid by card
 * through Stripe or in Robux through Roblox items, with a 14-day money-back
 * guarantee, binding individual arbitration with a 30-day opt-out, and a
 * 13+ age floor with adults contracting for anyone under 18.
 *
 * Drafted against Minnesota's automatic renewal law (Minn. Stat. 325G.56 to
 * 325G.62), the Minnesota Consumer Data Privacy Act (Minn. Stat. ch. 325M),
 * the Deceptive Trade Practices Act and Consumer Fraud Act (325D.44, 325F.69,
 * including the all-in pricing rule), the breach notification statute
 * (325E.61), the Federal Arbitration Act, COPPA, and the Discord and Roblox
 * developer and platform terms. See docs/legal-notes.md for the reasoning
 * and the points to raise with counsel. Not a substitute for review by a
 * licensed attorney.
 */

const SUPPORT = "support@oversite.shop";
const EFFECTIVE = "September 10, 2026";
const STATE = "Minnesota, United States";
const DISCORD = "https://discord.gg/ovs";
export { SUPPORT as LEGAL_SUPPORT, EFFECTIVE as LEGAL_EFFECTIVE, STATE as LEGAL_STATE };

/** A paragraph, a bold run-in heading, or a bulleted list. */
type Block = string | { sub: string } | { list: string[] };
type Section = { h: string; body: Block[] };
type Doc = { key: string; slug: string; label: string; title: string; icon: typeof FileText; intro: string; sections: Section[] };

// ───────────────────────────── Privacy Policy ─────────────────────────────

const PRIVACY: Section[] = [
  { h: "Who we are and what this covers", body: [
    "Oversite (“Oversite,” “we,” “us,” or “our”) is a sole proprietorship based in " + STATE + ". We build, host and operate managed Discord bots and the web dashboard at oversite.shop that customers use to configure them (together, the “Services”).",
    "This Privacy Policy explains what personal data we collect, why we collect it, who we share it with, how long we keep it, and the rights and choices you have. It applies to our website, the dashboard, our bots, and our support channels. It does not apply to Discord, Roblox, Stripe or any other company’s own services, which have their own privacy policies.",
    "If you have any question about this policy or about your data, email us at " + SUPPORT + ". We are the controller of the personal data described here.",
  ]},
  { h: "Two kinds of people this policy covers", body: [
    { sub: "Customers" },
    "People who create an Oversite account, buy a bot, or are invited to a customer’s dashboard. We collect your data directly from you and from the sign-in providers you choose.",
    { sub: "Members of servers that run an Oversite bot" },
    "People who use a Discord server where a customer has installed one of our bots. We collect your data through the bot, on the customer’s instructions, in order to provide the features that server has turned on. The server owner decides which features run and is responsible for telling their community how the bot is used. If you have a question about a specific server’s use of a bot, start with that server’s staff; you can also contact us and we will help.",
  ]},
  { h: "What we collect from customers", body: [
    { sub: "Account details" },
    "Your email address and a password. The password is stored only as a salted, one-way hash; we never see or store it in plain text. You can add a display name. If you sign in with Discord or Google, that provider sends us your account identifier, username or name, email address and avatar so we can create and secure your account. We never receive your Discord or Google password.",
    { sub: "Linked accounts" },
    "If you link a Discord account, we store its identifier and username so we can send you build progress, service alerts and team invites, and so the bots can recognise you as a dashboard user. If you link a Roblox account, Roblox sends us your Roblox user identifier and username only. We use it to match a Robux purchase to your order and, on servers that use Roblox verification, to identify you.",
    { sub: "Orders and payments" },
    "The bot and features you chose, the price, discount code, payment method and plan, and the status of each order. Card payments are handled by Stripe. Stripe collects and stores your card details; we never receive your full card number. We receive only the card brand, the last four digits, the expiration date and the identifiers Stripe uses for your customer record, saved payment method and subscription. Robux payments are handled by Roblox; we receive a record of the sale from the Roblox group that sold the item, showing the buyer’s Roblox account, the item and the amount.",
    { sub: "Dashboard configuration" },
    "Everything you set up for your bots: names, icons, banners, bios, statuses, feature settings, message designs, team members and their roles, groups, and any API keys or credentials you enter for a bot. Credentials are encrypted at rest and are read only by the bot they belong to; the dashboard never shows them back.",
    { sub: "Support" },
    "Messages you send us by email, in our Discord, or in the dashboard’s support chat, and our replies. The support chat is answered by an AI assistant, described below.",
    { sub: "Technical and usage data" },
    "Standard server logs (IP address, browser type, pages requested, timestamps), bot health and error logs, and counts of commands and messages each bot handles. We use these to keep the Services running, to show you your own bots’ activity, and to detect abuse.",
  ]},
  { h: "What our bots collect from servers", body: [
    "A bot only sees what Discord allows it to see in a server, and only stores what the features that server has enabled need. Depending on those features, this can include:",
    { list: [
      "Server, channel, category, thread and role identifiers, names and settings.",
      "Member identifiers, usernames, nicknames, avatars, roles, and join and leave activity.",
      "Message content and metadata where a feature requires it: automated moderation, phishing and scam detection, moderation and audit logs, ticket transcripts, starboards, message posting, translation, and features that react to what is said.",
      "Moderation records the server’s staff create: warnings, mutes, kicks, bans, notes, infractions, promotions and blacklists.",
      "Support records: ticket contents, transcripts, claims, priorities and staff statistics.",
      "Utility records: experience points and levels, economy balances, giveaway entries, reaction roles, reminders, birthdays, shift and session records, server statistics, and the settings for third-party alerts such as Twitch or YouTube.",
      "Voice activity where a voice feature is on: the audio a member speaks in a channel that a voice feature is listening to, processed to transcribe it and reply, and not kept once processed.",
      "Roblox data where Roblox features are on: the Roblox user identifier and username a member links, group rank, and, for Roblox purchases, the sale records of the customer’s own group.",
      "Game data where an ER:LC feature is on: the calls, player positions, vehicles and kill logs the customer’s private server exposes through the ER:LC API.",
    ]},
    "We do not read or store message content for any purpose other than the features the server owner enabled. Bots never see direct messages between users.",
  ]},
  { h: "Why we use this data", body: [
    { list: [
      "To create and secure your account and let you and your team sign in.",
      "To build, deploy, host, monitor, update and support your bots, and to apply the settings you choose.",
      "To take payment, manage subscriptions, prevent fraud, and keep records the law requires us to keep.",
      "To send you the messages the Services need: order and build progress, service alerts, billing notices, security notices, team invites, and the annual reminder about any continuous subscription you hold.",
      "To answer your questions and resolve problems.",
      "To understand how the Services are used and to improve them.",
      "To enforce our terms, protect the Services and our users, and comply with the law.",
    ]},
    "We do not sell personal data. We do not use personal data for targeted advertising. We do not make decisions about you by profiling that have legal or similarly significant effects.",
  ]},
  { h: "Who we share data with", body: [
    "We share personal data only with companies that process it on our behalf to run the Services, with the platforms the Services connect to, and when the law requires it.",
    { list: [
      "Stripe, for card payments, subscriptions and receipts.",
      "Discord, which the bots run on and which handles Discord sign-in.",
      "Roblox, for Roblox sign-in, verification, group features and Robux purchases.",
      "Google, for Google sign-in.",
      "Supabase, which hosts our database, authentication and server functions.",
      "Railway, which hosts the bots.",
      "The AI providers named in the next section, for the specific features that use them.",
      "Email delivery providers, to send the messages described above.",
    ]},
    "These providers may only use your data to provide their service to us. We may also disclose data if required by law, subpoena or court order, to protect the rights, property or safety of Oversite, our users or others, or as part of a sale or transfer of the business, in which case this policy would continue to apply to your data.",
  ]},
  { h: "Artificial intelligence features", body: [
    "Some features use artificial intelligence models run by third parties. We tell you which, so you can decide whether to turn them on.",
    { list: [
      "The dashboard’s support chat is answered by an AI assistant built on Anthropic’s Claude models. Your questions in that chat are sent to Anthropic to generate the reply. The assistant cannot see or change your account, orders or bots.",
      "Avatar and content screening on the Protection bot sends the image or text being checked to Anthropic.",
      "Message translation sends the text being translated to Google’s Gemini models.",
      "Text-to-speech and radio voices use Google, Microsoft or ElevenLabs speech services, depending on the setting the server owner chose.",
      "The Dispatch bot sends the game events it reads and the radio traffic it hears to Anthropic to write its replies, and to ElevenLabs to speak them and to transcribe officers’ speech.",
    ]},
    "We send a provider only the content the feature needs. We never send account details, payment details, passwords or Discord credentials to an AI provider, and we use these providers through their business interfaces, whose terms do not allow the provider to use the content we send to train its models. Content sent to a provider is processed under that provider’s privacy policy.",
    "AI output can be wrong, incomplete or inappropriate. Any automated action a bot takes on the basis of AI output, such as flagging or removing an avatar, follows the settings the server owner chose and can be reviewed and reversed by that server’s staff. If you believe an automated decision about you was wrong, contact the server’s staff or email us and we will look into it.",
    "We also use AI tools in building and operating the Services, including writing and reviewing code and drafting replies. A person at Oversite remains responsible for the Services and for any reply you receive from us.",
  ]},
  { h: "Cookies and similar technologies", body: [
    "We use only the cookies and browser storage needed to keep you signed in, remember your preferences, and protect the site against abuse. We do not use advertising cookies or third-party tracking. Because we do not track you across other sites, we do not respond to browser “Do Not Track” signals; there is nothing to turn off. You can clear or block cookies in your browser, but you will not be able to stay signed in without them.",
  ]},
  { h: "How long we keep data", body: [
    { list: [
      "Account data is kept for as long as your account exists. When you delete your account, or ask us to, we delete or anonymise your personal data within 30 days, and usually within two business days, except for records we must keep by law.",
      "Order and payment records are kept for seven years after the transaction to meet tax, accounting and dispute obligations.",
      "Data a bot collected from a server is deleted when that bot is deleted or cancelled. Removing a bot from a server stops new collection from that server immediately.",
      "Bot logs and usage counts are kept for up to 30 days.",
      "Support conversations are kept for up to two years so we can follow up on earlier problems.",
      "Server logs are kept for up to 90 days for security.",
    ]},
    "Backups are kept for a short period and overwritten on a rolling basis; data deleted from live systems ages out of backups within 30 days.",
  ]},
  { h: "How we protect data", body: [
    "We encrypt data in transit and at rest, encrypt bot credentials separately, and limit access to production systems to the people who need it to do their work. No system is perfectly secure, and we cannot promise that yours will never be breached. If a breach affects your personal data, we will notify you as the law requires, without unreasonable delay, and tell you what happened and what we are doing about it.",
  ]},
  { h: "Your rights", body: [
    "You can exercise the following rights over the personal data we hold about you, wherever you live. If you live in Minnesota, these rights are also yours under the Minnesota Consumer Data Privacy Act; if you live in the European Economic Area, the United Kingdom or California, the corresponding rights under the GDPR, UK GDPR and CCPA apply.",
    { list: [
      "Access: confirm whether we process your personal data and get a copy of it.",
      "Correction: fix inaccurate personal data.",
      "Deletion: have your personal data deleted.",
      "Portability: get your data in a portable, readily usable format.",
      "Restriction and objection: ask us to limit or stop certain processing.",
      "A list of the specific third parties we have disclosed your personal data to.",
      "Opt out of the sale of personal data, targeted advertising and significant profiling. We do none of these, so there is nothing to opt out of, but the right is yours.",
    ]},
    "To exercise a right, email " + SUPPORT + " from the address on your account, or from any address with enough detail for us to verify that you are the person the data is about. You do not need to create an account to make a request. We respond within 45 days; if a request is unusually complex we may take up to 45 more days and will tell you why within the first 45. Requests are free up to twice a year; beyond that we may charge a reasonable fee for requests that are plainly excessive or repetitive.",
    "If we decline a request, we will tell you why. You can appeal by replying to our decision within 45 days. We decide appeals within 45 days and give written reasons. If we deny your appeal and you live in Minnesota, you can complain to the Minnesota Attorney General’s Office at ag.state.mn.us; residents of other places can contact their own data protection authority.",
    "Server members: if you want data a bot holds about you corrected or deleted, ask the server’s staff first, since they control that data. If they cannot help, email us with the server name and your Discord username and we will act on it.",
  ]},
  { h: "Children", body: [
    "The Services are for people aged 13 and over, or the higher minimum age Discord sets where you live. We do not knowingly collect personal data from children under 13, and we do not let a child under 13 create an account. If you believe a child under 13 has given us personal data, email " + SUPPORT + " and we will delete it.",
    "Anyone under 18 may buy from us only through a parent or legal guardian, as described in our Terms of Use. Where a Roblox purchase is made from an account Roblox designates for younger users, we treat the parent or guardian as the customer.",
  ]},
  { h: "Where data is processed", body: [
    "We operate from the United States and our providers process data in the United States. If you use the Services from elsewhere, your data is transferred to and processed in the United States, where privacy law may differ from your own. We rely on our contracts with providers to protect that data.",
  ]},
  { h: "Discord and Roblox", body: [
    "Our bots use Discord’s API under Discord’s Developer Terms of Service and Developer Policy. We use Discord data only to provide the Services, we delete it as described above, and you can ask for it to be corrected or deleted at any time by emailing us. Our Roblox features use Roblox’s sign-in and Open Cloud services under Roblox’s terms. Neither Discord nor Roblox is responsible for our Services, and we are not affiliated with either.",
  ]},
  { h: "Changes to this policy", body: [
    "We may update this policy. When we make a material change, we will post the new version here with a new effective date and, if you have an account, email you or show you a notice in the dashboard before it takes effect. Continuing to use the Services after the change takes effect means the new version applies.",
  ]},
  { h: "Contact", body: [
    "Oversite, " + STATE + ". Email " + SUPPORT + ". You can also reach us in our Discord at " + DISCORD + ", in the #dashboard channel, using the Need assistance button.",
  ]},
];

// ───────────────────────────── Terms of Use ─────────────────────────────

const TERMS: Section[] = [
  { h: "These terms are a contract", body: [
    "These Terms of Use (the “Terms”) are a binding agreement between you and Oversite, a sole proprietorship based in " + STATE + " (“Oversite,” “we,” “us”). They govern the website at oversite.shop, the dashboard, our Discord bots and everything else we provide (the “Services”). Our Privacy Policy and our Sales & Refund Policy are part of these Terms.",
    "By creating an account, placing an order, using the dashboard, or adding one of our bots to a server, you accept these Terms. If you do not accept them, do not use the Services.",
    "These Terms contain an arbitration agreement and a class action waiver, under the heading “Resolving disputes.” They affect how disputes between us are resolved. Please read that section.",
  ]},
  { h: "Who may use the Services", body: [
    "You must be at least 13 years old, or the higher minimum age Discord requires where you live.",
    "If you are under 18, you may use the Services only with the permission of a parent or legal guardian who has read these Terms, and only that parent or guardian may buy from us. When a purchase is made for someone under 18, the parent or guardian is our customer, is the party to these Terms and to the purchase, and is responsible for the account and for how the bots are used. This applies to purchases made in Robux from a Roblox account, including accounts Roblox designates for younger users.",
    "You must have the authority to add a bot to any Discord server you connect, and you must comply with Discord’s Terms of Service and Community Guidelines and, where Roblox features are used, Roblox’s Terms of Use and Community Standards.",
    "You may not use the Services if you are barred from doing so under the laws of the United States or the place where you live, or if you are on a United States government sanctions list.",
  ]},
  { h: "Your account", body: [
    "You are responsible for the accuracy of the information you give us, for keeping your password and any linked accounts secure, and for everything that happens under your account, including what your team members do. Tell us at " + SUPPORT + " right away if you think your account has been used without your permission.",
    "You may not share, sell, rent or transfer your account. A bot may be transferred to another account only through the dashboard’s ownership transfer, which moves the bot, its data and its billing to the new owner and ends your access.",
    "If you give team members access to your dashboard, you are responsible for choosing what they may do. If you give Oversite’s support team access through the dashboard, we will use it only to help with your request and you can revoke it at any time.",
  ]},
  { h: "What the Services are", body: [
    "Oversite builds and hosts Discord bots. Each bot runs on our infrastructure on a Discord application that we own and assign to your order; you configure the bot’s name, appearance and features from the dashboard, and changes apply while it runs. We may add, change or retire features, and we may perform maintenance that affects availability. We will give you reasonable notice of any change that materially reduces what you paid for, and you may cancel if you do not accept it.",
    "The Discord application, its token and its identity belong to Oversite. When a bot is cancelled or deleted, the application is returned to our pool: it leaves your servers, and its avatar, banner and description are cleared so it can serve another customer.",
    "Bots depend on Discord, Roblox, the ER:LC API, Stripe and other third-party platforms. Those platforms can change, restrict or interrupt their services, and we are not responsible for what they do. If a platform change makes a feature impossible to provide, we may remove that feature.",
    "Some features carry limits that are set out in the dashboard or the product description, such as one Discord server per bot unless you have bought extra server slots. Add-ons are currently included at no charge; we may begin charging for new features, but any feature you have already been given free will stay free for you on the bot that has it.",
  ]},
  { h: "Acceptable use", body: [
    "You agree not to use the Services, or let anyone else use them through your account, to:",
    { list: [
      "Break any law, or violate Discord’s or Roblox’s rules.",
      "Harass, threaten, defame, exploit or harm anyone, or run a server that does.",
      "Infringe anyone’s intellectual property, privacy or other rights.",
      "Send spam, malware, phishing links or unsolicited advertising.",
      "Collect or store data about server members beyond what the bot’s enabled features need, or use bot data for surveillance, profiling or resale.",
      "Evade a ban, raid or nuke a server, or interfere with another server’s bots.",
      "Probe, scan, overload, reverse engineer, decompile, copy or resell the Services, or attempt to access another customer’s account, bots or data.",
      "Use the Services for anything that requires a licence you do not hold, such as gambling with real money.",
    ]},
    "You alone are responsible for how the bots you control are configured and used, for the content your server produces, and for making sure your use complies with the law and with the platforms’ rules. We may investigate suspected violations, remove content, suspend or delete bots, or close your account if we reasonably believe you have broken these rules or exposed us or others to harm or legal risk. Where practical we will tell you first and give you a chance to fix the problem.",
  ]},
  { h: "Prices, payment and renewal", body: [
    "The price of each product, whether it carries a monthly hosting subscription, and the amount of that subscription are shown on the bot’s page and again at checkout before you buy. Prices include all mandatory fees. Prices are in United States dollars and include any sales tax that applies; you will not be charged more than the price shown.",
    { sub: "One-time and recurring charges" },
    "Our Discord bots (Protection, Support, Utilities and the All in One Pack) are sold as a one-time fee plus a continuous monthly hosting subscription. Our Roblox and ER:LC bots (Customs, Roleplay and Dispatch) and extra server slots are one-time purchases with no recurring charge. The hosting subscription continues, and is charged each month to the payment method on file, until you cancel it. The current monthly amount is shown at checkout and in your dashboard’s Billing page; it is charged per account at the tiered rate shown there, and it may change only after we give you notice as described below.",
    { sub: "When your card is charged" },
    "When you order by card, we save your card through Stripe but do not charge it at checkout. We charge the one-time fee, and the first month of any hosting subscription, at the moment your bot’s build begins, after you confirm your order and a bot slot is available. If no slot is available, your order waits on our waitlist at no charge until one is, and you can withdraw it at any time before we charge. If a product is marked as a pre-order, your card is saved and not charged until the product is released. If the charge is declined, your order is not built until you update your payment method.",
    { sub: "Payment plans" },
    "Where offered, you may split the one-time fee into three, six or ten equal monthly instalments with no interest or fees. The build begins after the first instalment clears. Instalments are due on the first of each month; if one fails, you have until the fifteenth to update your payment method, and we will tell you in the dashboard, after which the bot is removed and dashboard access is suspended until the balance is paid. The instalment plan is a minimum purchase obligation: the full one-time fee remains owed even if you cancel hosting or stop using the bot.",
    { sub: "Robux" },
    "You may pay for some products in Robux. The Robux price is the dollar price plus 30 percent, converted at 100 Robux per dollar and rounded up to a figure ending in 999, and is shown before you buy. Robux payment works by buying a shirt from the Oversite Customs group on Roblox at that price; the order is confirmed when the sale appears in the group’s records and matches your linked Roblox account. Roblox keeps a share of every Robux sale, which is why Robux refunds are limited as described in the Sales & Refund Policy. Robux purchases must be made from a Roblox account you own and are permitted to use under Roblox’s terms. Roblox decides what its terms allow, and we are not responsible for any action Roblox takes on your Roblox account.",
    { sub: "Discounts and comped accounts" },
    "Discount codes and complimentary accounts are offered at our discretion, apply only as stated when offered, and may be withdrawn if misused. A complimentary order carries no payment and no refund.",
    { sub: "Changes to prices" },
    "We may change the price of a hosting subscription or of any product. A change to your subscription price takes effect only from a later renewal, after we have emailed you at least 30 days in advance with the new price and how to cancel. If you do not want to pay the new price, cancel before it takes effect and you will not be charged it.",
  ]},
  { h: "Cancelling", body: [
    "You can cancel a hosting subscription, or delete a one-time bot, at any time from the dashboard: open the bot, choose Cancel subscription or Delete bot, and confirm. That is all the cancellation requires. You can also cancel by emailing " + SUPPORT + " from your account’s email address, and we will process it within two business days. We will not ask you to give a reason, complete a survey or sit through offers before we process a cancellation.",
    "When you cancel, no further hosting charges are made. The bot is removed from your servers after a 30-second window in which you can undo the cancellation, and the bot’s data is deleted as described in the Privacy Policy. Hosting you have already paid for the current month is not refunded, except under the money-back guarantee in the Sales & Refund Policy.",
    "We will email you at least once a year to remind you of any continuous subscription you hold and how to cancel it.",
  ]},
  { h: "Your content", body: [
    "You keep ownership of everything you and your servers provide to the Services: names, images, message designs, settings, ticket contents, and the data your members generate. You give us a non-exclusive, worldwide licence to host, store, copy, process and display that content only as needed to provide the Services to you, and you promise that you have the rights needed to grant that licence. That licence ends when the content is deleted from the Services, except for copies kept in backups for the period the Privacy Policy describes.",
    "If you send us ideas or suggestions, we may use them without any obligation to you.",
  ]},
  { h: "Our intellectual property", body: [
    "The Services, including all software, bots, designs, text, graphics, names and logos, are owned by Oversite or our licensors and protected by copyright, trademark and other laws. We grant you a limited, non-exclusive, non-transferable, revocable licence to use the Services for your own servers while your account is in good standing. You may not copy, modify, distribute, sell or lease any part of the Services, or use our names or logos, except as these Terms allow.",
    "Custom work we build for you at your request is licensed to you on the same basis unless we agree otherwise in writing. We keep ownership of the underlying code and may reuse it for other customers.",
  ]},
  { h: "Copyright complaints", body: [
    "If you believe content in the Services infringes your copyright, send a notice to " + SUPPORT + " with the subject line “Copyright,” identifying the work, the material you say infringes it and where it is, your contact details, a statement that you believe in good faith the use is unauthorised, a statement under penalty of perjury that the notice is accurate and that you are the owner or authorised to act for the owner, and your physical or electronic signature. We will act on valid notices and may terminate the accounts of repeat infringers.",
  ]},
  { h: "Artificial intelligence and automated features", body: [
    "Parts of the Services use artificial intelligence: the dashboard’s support assistant, message translation, text-to-speech and radio voices, avatar and content screening, the Dispatch bot’s dispatcher, and features we may add. The Privacy Policy names the providers.",
    "AI output can be inaccurate, incomplete, offensive or unsuitable for your purpose. You are responsible for reviewing it before relying on it. Nothing an AI feature produces is legal, financial, medical or other professional advice, and nothing the support assistant says changes these Terms or creates a promise on our behalf; only a written statement from Oversite does that.",
    "Automated actions a bot takes, including actions based on AI output, follow the settings the server owner chose. The server owner is responsible for those settings and for reviewing and reversing automated actions where appropriate. We are not liable for automated actions taken under a server owner’s configuration.",
    "You may not use AI features to create or distribute unlawful content, content that infringes others’ rights, or content that violates Discord’s or Roblox’s rules.",
  ]},
  { h: "Availability and support", body: [
    "We host our bots and aim to keep them online around the clock, and we roll out updates without resets. We do not guarantee uninterrupted or error-free service; outages happen, including because of Discord, Roblox, our hosting providers, or maintenance. If a hosted bot is offline for three or more consecutive days because of a fault on our side, we will credit that month’s hosting fee for that bot; ask us at " + SUPPORT + ". This credit is your sole remedy for downtime.",
    "Support is available by email at " + SUPPORT + " and in our Discord at " + DISCORD + ". We usually reply within 24 to 48 hours.",
  ]},
  { h: "Disclaimer of warranties", body: [
    "THE SERVICES ARE PROVIDED “AS IS” AND “AS AVAILABLE.” TO THE FULLEST EXTENT THE LAW ALLOWS, OVERSITE DISCLAIMS ALL WARRANTIES, EXPRESS, IMPLIED OR STATUTORY, INCLUDING ANY IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE AND NON-INFRINGEMENT, AND ANY WARRANTY ARISING FROM COURSE OF DEALING OR USAGE OF TRADE. WE DO NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED, SECURE OR ERROR-FREE, THAT DEFECTS WILL BE CORRECTED, OR THAT ANY BOT WILL REMAIN ONLINE OR RETAIN ANY DATA.",
    "Some places do not allow the exclusion of implied warranties, so some of the above may not apply to you. Nothing in these Terms limits any consumer right that cannot be limited by contract under the law where you live.",
  ]},
  { h: "Limitation of liability", body: [
    "TO THE FULLEST EXTENT THE LAW ALLOWS, OVERSITE AND ITS OWNER, STAFF AND CONTRACTORS WILL NOT BE LIABLE TO YOU FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, DATA, GOODWILL OR COMMUNITY, ARISING OUT OF OR RELATING TO THE SERVICES OR THESE TERMS, HOWEVER CAUSED AND UNDER ANY THEORY OF LIABILITY, EVEN IF WE HAVE BEEN TOLD SUCH DAMAGES ARE POSSIBLE.",
    "TO THE FULLEST EXTENT THE LAW ALLOWS, OUR TOTAL LIABILITY FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THE SERVICES OR THESE TERMS WILL NOT EXCEED THE GREATER OF THE AMOUNT YOU PAID US IN THE TWELVE MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM AND ONE HUNDRED UNITED STATES DOLLARS.",
    "These limits apply together and to every kind of claim. They do not limit liability for fraud, for death or personal injury caused by negligence, or for anything else that the law does not allow to be limited.",
  ]},
  { h: "Indemnity", body: [
    "You will defend, indemnify and hold harmless Oversite and its owner, staff and contractors from any claim, demand, loss, liability, damage and expense, including reasonable legal fees, brought by a third party and arising from your servers, your content, your use of the Services, your breach of these Terms, or your violation of any law or of anyone’s rights. We may take over the defence of any matter you must indemnify, in which case you will cooperate with us.",
  ]},
  { h: "Suspension and termination", body: [
    "You may close your account at any time by cancelling your bots and emailing " + SUPPORT + ". We may suspend or terminate your access to all or part of the Services if you breach these Terms, fail to pay, use the Services in a way that creates legal risk or harm, or if we stop providing the Services. Where we terminate for a reason other than your breach, we will refund any prepaid hosting for the period after termination.",
    "On termination, your bots are removed from your servers and your data is deleted as the Privacy Policy describes. The parts of these Terms that by their nature should survive, including amounts owed, ownership, disclaimers, limitation of liability, indemnity and dispute resolution, survive termination.",
  ]},
  { h: "Resolving disputes", body: [
    "PLEASE READ THIS SECTION CAREFULLY. IT REQUIRES YOU AND OVERSITE TO RESOLVE DISPUTES THROUGH BINDING INDIVIDUAL ARBITRATION, AND IT WAIVES THE RIGHT TO A JURY TRIAL AND TO PARTICIPATE IN A CLASS ACTION. YOU CAN OPT OUT AS DESCRIBED BELOW.",
    { sub: "Talk to us first" },
    "Before starting arbitration or a lawsuit, you agree to send a written notice of the dispute to " + SUPPORT + " with your name, your account email, a description of the problem and what you want us to do. We will do the same if we have a claim against you, using the email on your account. Both of us agree to try in good faith to resolve the dispute informally for 60 days from the notice. Most problems are solved this way. This step is required before any arbitration or court claim may be filed.",
    { sub: "Binding arbitration" },
    "If we cannot resolve a dispute informally, any dispute, claim or controversy arising out of or relating to the Services, these Terms, or the relationship between us, including whether a claim is subject to arbitration, will be resolved by binding arbitration before a single neutral arbitrator, rather than in court. The Federal Arbitration Act governs this agreement. The arbitration will be administered by the American Arbitration Association under its Consumer Arbitration Rules in force when the arbitration is filed, which are available at adr.org. The arbitrator may award the same individual relief a court could, and must follow these Terms as a court would.",
    "Arbitration fees will be allocated as the AAA’s consumer rules provide, and if the arbitrator finds your claim was not frivolous, we will pay your filing fee. The arbitration may be conducted by phone, video or written submissions; any in-person hearing will be held in the county where you live, or another place we agree. Judgment on the award may be entered in any court with jurisdiction.",
    { sub: "Only individual claims" },
    "You and Oversite agree that each may bring claims against the other only in an individual capacity, and not as a plaintiff or class member in any class, consolidated or representative proceeding, and that the arbitrator may not award relief to or against anyone who is not a party. If this paragraph is found unenforceable as to a particular claim or request for relief, then that claim or request must be brought in court, and it will be severed and stayed while the remaining claims are arbitrated. A court, not an arbitrator, decides whether this paragraph is enforceable.",
    { sub: "Exceptions" },
    "Either of us may bring an individual claim in small claims court where it qualifies, and either of us may ask a court for an injunction to stop infringement or misuse of intellectual property or unauthorised access to the Services. This section does not prevent you from reporting a concern to a government agency.",
    { sub: "Your right to opt out" },
    "You may reject this arbitration agreement by emailing " + SUPPORT + " within 30 days after you first accept these Terms, with the subject “Arbitration opt-out” and your name and account email. If you opt out, neither of us is bound to arbitrate, but the rest of these Terms, including the choice of Minnesota law and courts, still applies. Opting out does not affect any earlier arbitration agreement.",
    { sub: "Jury waiver and courts" },
    "TO THE EXTENT A DISPUTE IS HEARD IN COURT RATHER THAN IN ARBITRATION, YOU AND OVERSITE EACH WAIVE THE RIGHT TO A JURY TRIAL. Any such dispute will be brought only in the state or federal courts located in Minnesota, and you consent to their jurisdiction, except that you may bring a small claims action where you live.",
    { sub: "Time to bring a claim" },
    "To the extent the law allows, any claim arising out of or relating to the Services or these Terms must be filed within one year after it arises, or it is permanently barred.",
    { sub: "If this section changes" },
    "If we change this section after you have accepted these Terms, the change will not apply to a dispute you have already notified us of, and you may reject the change by opting out, as above, within 30 days after it takes effect.",
  ]},
  { h: "Governing law", body: [
    "These Terms and any dispute between us are governed by the laws of the State of Minnesota and, for the arbitration agreement, the Federal Arbitration Act, without regard to conflict of law rules. If you live outside the United States, you may also have protections under the mandatory consumer laws of your home country that these Terms cannot take away.",
  ]},
  { h: "Changes to these terms", body: [
    "We may change these Terms. When we make a material change, we will post the new version here with a new effective date and, if you have an account, email you or show you a notice in the dashboard at least 14 days before it takes effect. If you continue to use the Services after the change takes effect, you accept it. If you do not accept it, cancel and stop using the Services before then, and, if the change materially reduces what you paid for, we will refund any prepaid hosting for the period after you cancel.",
  ]},
  { h: "Everything else", body: [
    { list: [
      "Electronic communications: you agree that we may give you notices, receipts and other communications electronically, by email to your account address or in the dashboard, and that they satisfy any requirement that a communication be in writing.",
      "Entire agreement: these Terms, with the Privacy Policy and the Sales & Refund Policy, are the whole agreement between us about the Services and replace any earlier agreement.",
      "Severability: if any part of these Terms is found unenforceable, the rest remains in force and the unenforceable part is limited to the smallest extent needed, except as stated under “Only individual claims.”",
      "No waiver: our not enforcing a term is not a waiver of it.",
      "Assignment: you may not assign these Terms. We may assign them to a successor to our business, and will tell you if we do.",
      "Force majeure: neither of us is liable for a failure caused by events outside our reasonable control, other than payment obligations.",
      "Export and sanctions: you will not use the Services in violation of United States export or sanctions laws.",
      "Relationship: nothing in these Terms creates a partnership, employment or agency relationship. Discord and Roblox are not parties to these Terms and are not affiliated with Oversite.",
      "Language: these Terms are written in English; translations are for convenience and the English version controls.",
    ]},
  ]},
  { h: "Contact", body: [
    "Oversite, " + STATE + ". Email " + SUPPORT + ", or find us in our Discord at " + DISCORD + ".",
  ]},
];

// ───────────────────────────── Sales & Refund Policy ─────────────────────────────

const REFUNDS: Section[] = [
  { h: "About this policy", body: [
    "Thanks for choosing Oversite. This policy explains what you are buying, how and when you are charged, how to cancel, and when you can get a refund. It is part of our Terms of Use, and by placing an order you agree to it together with the Terms of Use and the Privacy Policy. The price, the renewal terms and the cancellation terms for your order are also shown at checkout before you buy, and those figures are the ones that apply to your order.",
  ]},
  { h: "What you are buying", body: [
    { sub: "Discord bots" },
    "Oversite Protection, Oversite Support, Oversite Utilities and the All in One Pack are sold as a one-time fee plus a monthly hosting subscription. The one-time fee pays for building and deploying your bot on our infrastructure. The hosting subscription keeps it hosted, maintained and online, and continues until you cancel it. The subscription is charged per account at the tiered rate shown at checkout and on your Billing page: at today’s rate, one bot is five dollars a month, two bots are ten dollars a month, and a third bot’s hosting is free.",
    { sub: "Roblox and ER:LC bots" },
    "Oversite Customs, Oversite Roleplay and Oversite Dispatch are one-time purchases. Hosting is included, and there is no recurring charge.",
    { sub: "Extra server slots and add-ons" },
    "Extra Discord server slots are one-time purchases that never expire. Feature add-ons are currently included at no charge.",
    { sub: "Bundles" },
    "Any two Discord bots bought together are priced as a bundle, and all three are sold as the All in One Pack. Bundle pricing applies only to bots bought in the same order.",
    "Prices are in United States dollars and include every mandatory fee and any sales tax that applies. The price you see is the price you pay.",
  ]},
  { h: "Paying by card", body: [
    "Card payments are processed by Stripe. At checkout we save your card but do not charge it. We charge the one-time fee, together with the first month of any hosting subscription, at the moment your bot’s build begins: after you confirm your order on the thank-you page and a bot slot is available.",
    { list: [
      "If a slot is available, we charge your card and the build begins right away.",
      "If every slot is taken, your order joins our waitlist at no charge. We email you and message you on Discord when a slot opens, and we charge your card only when you confirm you still want the bot. You can withdraw a waitlisted order at any time before then, with nothing owed.",
      "If a product is marked pre-order or coming soon, your card is saved and not charged until the product is released.",
      "If your card is declined when the build begins, nothing is built. Update your payment method from the dashboard and we will try again.",
    ]},
    "Stripe emails you a receipt for every charge. You can see your receipts, update your card and manage your subscription at any time from the Billing page in the dashboard, which opens your Stripe billing portal.",
  ]},
  { h: "Paying in Robux", body: [
    "Some products can be paid for in Robux. The Robux price is the dollar price plus 30 percent, converted at 100 Robux per dollar and rounded up to a figure ending in 999, and is shown before you choose Robux. To pay in Robux you sign in with Roblox on our site, tell us which kind of Roblox account you have, and buy the shirt we set up for your order from the Oversite Customs group store. Your order is confirmed, and your bot’s build begins, only once the sale appears in the group’s records from your linked Roblox account. A purchase must be confirmed within five minutes of buying; if Roblox is slow to record a sale, wait a moment and try again, or open a ticket in our Discord and we will match it by hand.",
    "Robux orders are always paid in full up front. Roblox keeps a share of every Robux sale, which limits what we can return on a Robux refund, as described below. If you already own every shirt we use for payment, Roblox will not sell you another; open a ticket in our Discord and we will take your order another way.",
  ]},
  { h: "Automatic renewal of hosting", body: [
    "A hosting subscription is a continuous service. It renews automatically each month, on the same day of the month you first paid, at the rate then in effect, charged to the payment method on file, until you cancel. By buying a bot with a hosting subscription you authorise these recurring charges.",
    "Your order confirmation and your first Stripe receipt state the subscription amount, that it renews monthly until cancelled, and how to cancel. We will email you at least once every calendar year to remind you that the subscription is continuing and how to cancel it. If we change the monthly price, we will email you at least 30 days before the first renewal at the new price, with instructions for cancelling, and the change will not apply if you cancel before it takes effect.",
  ]},
  { h: "Cancelling", body: [
    "You can cancel at any time, and cancelling takes one step: open the bot in your dashboard, choose Cancel subscription for a hosted bot or Delete bot for a one-time bot, and confirm. You can also cancel by emailing " + SUPPORT + " from your account’s email address; we process emailed cancellations within two business days. We will never make you call, give a reason or click through offers to cancel.",
    "When you cancel a hosting subscription, no further charges are made. The bot is removed from your servers after a 30-second undo window and its data is deleted. Hosting already paid for the current month is not refunded in part, except under the money-back guarantee below. To avoid being charged for another month, cancel before your renewal date, which is shown on the Billing page.",
    "One-time bots can be deleted the same way. Deleting a bot does not create a refund outside the money-back guarantee.",
  ]},
  { h: "Fourteen-day money-back guarantee", body: [
    "If you are not happy with a bot for any reason, you can get a full refund of what you paid for it within 14 days of the initial purchase. That includes the one-time fee and, for a hosted bot, the first month of hosting.",
    { list: [
      "Cancel or delete the bot from your dashboard within 14 days of the charge and the refund is issued automatically to your original payment method.",
      "Or email " + SUPPORT + " within the 14 days and we will process it for you.",
      "Card refunds are returned to the card that paid and usually appear within five to ten business days, depending on your bank.",
      "Robux refunds are paid through the Oversite Customs group on Roblox. Roblox keeps 30 percent of every sale and does not return it, so a Robux refund is 70 percent of the Robux you paid, and Roblox requires you to have been a member of the group for at least 14 days before it will pay out to you. If you would rather wait for that, or need help, open a ticket in our Discord.",
      "A comped order carries no payment and therefore no refund.",
    ]},
    "The bot is removed from your servers when a refund is issued. The guarantee covers a bot once; a bot bought again after a refund is not eligible again.",
  ]},
  { h: "After the fourteen days", body: [
    "After the 14-day window, the one-time fee and any hosting already charged are not refundable, and monthly renewals are not refundable. Cancelling stops future charges but does not refund a month that has already been charged. We may make exceptions at our discretion, but we are not obliged to.",
    { sub: "Bought the wrong bot?" },
    "If you bought the wrong bot, tell us within the 14 days and we will swap it, refund it or credit the amount toward the right one, whichever you prefer. After 14 days, contact us and we will do what we reasonably can.",
    { sub: "If your bot is down" },
    "If a hosted bot is offline for three or more consecutive days because of a fault on our side, we credit that month’s hosting fee for that bot. Ask us at " + SUPPORT + ".",
    { sub: "Extra server slots and add-ons" },
    "Extra server slots are refundable under the 14-day guarantee if unused, and are not refundable once used. Add-ons currently carry no charge.",
  ]},
  { h: "Payment plans", body: [
    "Where a payment plan is offered, you may pay the one-time fee in three, six or ten equal monthly instalments, with no fees or interest. The build begins once the first instalment clears. Instalments are due on the first of each month. If an instalment fails, you have until the fifteenth of that month to update your payment method; we will remind you in the dashboard. If it is still unpaid after the fifteenth, the bot is removed from your servers and your dashboard access is suspended until the balance is paid, after which the bot is restored. The full one-time fee remains owed under a payment plan even if you stop using the bot; the 14-day guarantee applies to the plan as a whole from the first instalment.",
  ]},
  { h: "Failed hosting payments", body: [
    "If a monthly hosting charge fails, we retry it and show a notice in your dashboard. You have ten days from the failed charge to update your payment method in the Stripe billing portal; your bot keeps running during those ten days. If the charge still fails after ten days, the subscription is cancelled, the bot is removed from your servers, and its data is deleted as described in the Privacy Policy. Roblox and ER:LC bots have no hosting charge and are never affected by this.",
  ]},
  { h: "Chargebacks", body: [
    "If you have a billing concern, please contact us first at " + SUPPORT + " or in our Discord. We will always talk it through and put right anything we got wrong. Filing a chargeback or payment dispute without contacting us first may lead us to suspend your account while the dispute is resolved, and we may recover any refunded amount if the dispute is decided in our favour.",
  ]},
  { h: "Contact", body: [
    "For billing questions, cancellations and refunds, email " + SUPPORT + " or open a ticket in our Discord at " + DISCORD + ", in the #dashboard channel, with the Need assistance button. We usually reply within 24 to 48 hours.",
  ]},
];

const DOCS: Doc[] = [
  { key: "privacy", slug: "privacy-policy", label: "Privacy Policy", title: "Privacy Policy", icon: ShieldCheck, intro: "What we collect, why, who sees it, how long we keep it, and the rights you have over it.", sections: PRIVACY },
  { key: "terms", slug: "terms-of-use", label: "Terms of Use", title: "Terms of Use", icon: FileText, intro: "The agreement between you and Oversite for the website, the dashboard and the bots.", sections: TERMS },
  { key: "refunds", slug: "sales-and-refunds", label: "Sales & Refunds", title: "Sales & Refund Policy", icon: Receipt, intro: "What you are buying, how and when you are charged, how to cancel, and when you can get a refund.", sections: REFUNDS },
];

/** The documents, for the /legal index. */
export const LEGAL_DOCS = DOCS.map(({ slug, title, intro, icon }) => ({ slug, title, intro, icon }));

function Body({ block }: { block: Block }) {
  if (typeof block === "string") return <p className="text-[15px] leading-[1.7] text-os-body">{block}</p>;
  if ("sub" in block) return <h3 className="pt-2 text-[15px] font-bold text-os-heading">{block.sub}</h3>;
  return (
    <ul className="space-y-2 pl-5">
      {block.list.map((item, i) => (
        <li key={i} className="list-disc text-[15px] leading-[1.7] text-os-body marker:text-os-faint">{item}</li>
      ))}
    </ul>
  );
}

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
  const doc = DOCS.find((d) => d.slug === slug) ?? DOCS[0];

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [slug]);

  return (
    <div className="oversite-theme min-h-screen bg-os-bg font-body text-os-body antialiased">
      <SiteNav />
      <main className="mx-auto w-full max-w-[820px] px-5 pb-28 pt-28">
        <header className="text-center">
          <Link to="/legal" className="font-label text-[11px] uppercase tracking-[0.2em] text-os-faint transition hover:text-os-heading">
            Legal
          </Link>
          <h1 className="mt-3 text-[clamp(2.1rem,5.5vw,3.2rem)] font-extrabold leading-[1.05] tracking-[-0.025em] text-os-heading">
            {doc.title}
          </h1>
          <p className="mx-auto mt-4 max-w-[560px] text-[15px] leading-relaxed text-os-body">{doc.intro}</p>
          <p className="mt-3 text-[13px] text-os-faint">Effective {EFFECTIVE}</p>
        </header>

        <nav className="mt-8 flex flex-wrap justify-center gap-2" aria-label="Legal documents">
          {DOCS.map((d) => {
            const on = d.slug === doc.slug;
            return (
              <Link
                key={d.slug}
                to={`/legal/${d.slug}`}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-[13px] font-semibold transition",
                  on
                    ? "border-os-accent/40 bg-os-accent/10 text-os-heading"
                    : "border-os-hairline/30 text-os-faint hover:border-os-hairline/50 hover:text-os-heading",
                )}
              >
                {d.label}
              </Link>
            );
          })}
        </nav>

        <hr className="mt-10 border-os-hairline/30" />

        <article className="mt-10 space-y-12">
          {doc.sections.map((s) => (
            <section key={s.h}>
              <h2 className="text-[22px] font-bold leading-snug tracking-[-0.01em] text-os-heading">{s.h}</h2>
              <div className="mt-4 space-y-4">
                {s.body.map((b, i) => (
                  <Body key={i} block={b} />
                ))}
              </div>
            </section>
          ))}
        </article>

        <hr className="mt-14 border-os-hairline/30" />
        <p className="mt-6 text-center text-[13px] text-os-faint">
          Oversite, {STATE}. Questions: <a href={`mailto:${SUPPORT}`} className="text-os-body underline underline-offset-4 hover:text-os-heading">{SUPPORT}</a>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Terms;
