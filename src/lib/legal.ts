import { supportEmail } from "@/lib/platform";

export const LEGAL_UPDATED = "September 24, 2026";

export interface LegalSection {
  title: string;
  body: string;
}

export function privacySections(): LegalSection[] {
  const email = supportEmail();
  return [
    {
      title: "Who we are",
      body: `PokéVault is an unofficial fan-made Pokémon TCG collection tracker, market helper, and playful Adventure mode. It is not affiliated with, endorsed by, or sponsored by Nintendo, The Pokémon Company, Game Freak, or any related rights holders. This policy describes what we collect on the PokéVault website, iOS app, and Android app.`,
    },
    {
      title: "Information you give us",
      body: `Account details (email, password, or Sign in with Google / Apple identifiers). Collection data you choose to save (cards in your Vault, quantities, wishlist). Optional API keys you paste for pokemontcg.io (stored only in your browser/device local storage). Photos or camera frames you capture when you use Scan — used only to identify cards on your device / session; we do not sell scan images.`,
    },
    {
      title: "Information we get from others",
      body: `Authentication providers (Google, Apple) return a verified email and, if you allow it, your name. Card catalog and pricing data is fetched from public/third-party TCG data sources (e.g. pokemontcg.io, TCGdex, marketplace public pages). We do not sell this data.`,
    },
    {
      title: "How we use it",
      body: `To run PokéVault: create your account, sync your collection, show market prices, power Scan, Adventure progress tied to your account, prevent abuse, and provide support. Marketplace Buy/Sell buttons only deep-link to third-party sites (eBay, TCGplayer, etc.); those sites have their own privacy policies.`,
    },
    {
      title: "Who we share it with",
      body: `Service providers that process data for us: Supabase (database, auth), the app host (Vercel). We share information if required by law or to protect safety. We do not sell personal information and we do not share it for cross-app advertising.`,
    },
    {
      title: "Tracking",
      body: `PokéVault does not use third-party advertising SDKs and does not track you across other companies' apps or websites. We do not show an App Tracking Transparency prompt because we do not track.`,
    },
    {
      title: "Camera and photos",
      body: `Camera access is used only when you choose Scan to identify a card. We do not use the camera in the background.`,
    },
    {
      title: "Retention",
      body: `We keep account and collection records while your account is open. Sign out anytime. To request deletion of your account and server-side collection data, email ${email}.`,
    },
    {
      title: "Children",
      body: `PokéVault is not directed at children under 13. Do not create an account if you are under 13. Parents: contact ${email} to request deletion.`,
    },
    {
      title: "Fan-app notice",
      body: `Pokémon and Pokémon character names are trademarks of their respective owners. PokéVault is a fan project for collectors. Card images and names shown in-app come from third-party catalog APIs for identification and collection tracking.`,
    },
    {
      title: "Contact",
      body: `Privacy questions: ${email}.`,
    },
  ];
}

export function termsSections(): LegalSection[] {
  const email = supportEmail();
  return [
    {
      title: "The service",
      body: `PokéVault provides tools to browse Pokémon TCG catalogs, track a personal collection, compare public market prices, scan cards, and play optional fan-made Adventure / Game Boy–style modes. PokéVault is an unofficial fan app and is not affiliated with Nintendo, The Pokémon Company, or Game Freak.`,
    },
    {
      title: "Eligibility",
      body: `You must be able to enter a binding contract in your region. If you are under 18, use the app only with a parent or guardian's permission.`,
    },
    {
      title: "Accounts",
      body: `You are responsible for activity on your account. Keep login details to yourself. You may sign out anytime. Email ${email} to request account deletion.`,
    },
    {
      title: "Collections and Scan",
      body: `Vault and wishlist data are for your personal use. Scan uses the camera only when you start a scan. Do not scan cards you do not have the right to photograph.`,
    },
    {
      title: "Market prices and third-party links",
      body: `Prices are estimates from third-party sources and may be wrong, delayed, or incomplete. Buy / Sell actions open external marketplaces; PokéVault is not a party to those sales and does not process card payments for physical cards.`,
    },
    {
      title: "Premium",
      body: `Optional Pro / Elite features may be offered for a subscription. Until a payment provider is enabled, any in-app "subscribe" control is a local preview and does not charge you. When payments go live, fees and cancellation will be shown at checkout.`,
    },
    {
      title: "Adventure and Game Boy modes",
      body: `Adventure, battles, and Game Boy–style play are fan entertainment. They do not use copyrighted commercial ROMs. Do not upload or request ripped Nintendo assets.`,
    },
    {
      title: "Prohibited uses",
      body: `Do not use PokéVault to harass others, scrape or overload our services, attempt unauthorized access, or distribute illegal content.`,
    },
    {
      title: "Disclaimers",
      body: `The service is provided "as is." We are not liable for lost collection data, inaccurate prices, or third-party marketplace disputes, except where the law says we cannot limit liability.`,
    },
    {
      title: "Changes and contact",
      body: `We may update these terms. Continued use after an update means you accept the new terms. Questions: ${email}.`,
    },
  ];
}
