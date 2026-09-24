# PokéVault — App Store / Play submission pack

Bundle id: `com.kennygeee.pokevault` · App name: **PokéVault**

Native chrome (status bar, splash, safe areas, camera permission string,
Sign in with Apple code path, hosted Privacy/Support URLs) is in the repo.
Apple/Google still need your developer accounts and a reviewed binary — do
**not** submit from this automation.

## What already ships

- Five-tab mobile shell: Discover / Search / Vault / Market / More
- Google + email/password + **Apple Sign In code path** (Supabase OAuth)
- Hosted `/privacy.html`, `/terms.html`, `/support.html`
- In-app legal links under More and Settings
- Unofficial fan-app disclaimer (not Nintendo / TPC / Game Freak)
- PWA manifest + icons (`apple-touch-icon`, 192, 512)
- Capacitor `ios/` + `android/` shells
- Camera usage for Scan only
- `PrivacyInfo.xcprivacy` (no tracking) after first `cap sync` / assets pass

## Blockers you must finish

1. **Apple Developer Program** ($99/yr) — Xcode → Signing & Capabilities → your Team,
   bundle `com.kennygeee.pokevault`.
2. **Sign in with Apple**
   - Apple Developer → Identifiers → enable Sign in with Apple on the App ID
   - Supabase → Auth → Providers → Apple (Services ID, Key ID, Team ID, `.p8`)
   - Redirect: `com.kennygeee.pokevault://auth/callback` (+ site `/login`)
3. **Google OAuth** already documented in README — confirm redirect URLs include the
   custom scheme for Capacitor.
4. **Privacy / Support URLs** (already live once deployed):
   - Privacy: `https://pokedex-hub-lime.vercel.app/privacy.html`
   - Support: `https://pokedex-hub-lime.vercel.app/support.html`
5. **Play Console** (optional) — same privacy URL; package `com.kennygeee.pokevault`.

## Build & archive (iOS)

```bash
cd ~/Projects/lovable-apps/tcg-vault-master
bun install   # or npm install
python3 scripts/generate-icons.py
npm run cap:sync
npx cap open ios
```

In Xcode: Team + signing, Version/Build, add Sign in with Apple capability if
the provider is enabled, then Archive → App Store Connect.

## Listing copy (paste)

| Field | Copy |
|---|---|
| Name | PokéVault |
| Subtitle | TCG collection & market helper |
| Category | Entertainment / Utilities |
| Privacy URL | `https://pokedex-hub-lime.vercel.app/privacy.html` |
| Support URL | `https://pokedex-hub-lime.vercel.app/support.html` |
| Description | PokéVault helps Pokémon TCG collectors scan cards, track a Vault, compare public market prices, and play optional fan-made Adventure modes. Unofficial fan app — not affiliated with Nintendo, The Pokémon Company, or Game Freak. |
| Review notes | Camera is only for optional card Scan. Auth is Supabase (Google / Apple / email). Buy/Sell deep-link to third-party marketplaces; no IAP required for physical card sales. Demo: browse Discover as guest; Sign in to sync Vault. |

## Privacy nutrition labels

Declare for **App Functionality**, not tracking:

- Email Address, User ID, Name (from auth providers)
- Photos / Camera (Scan only, user-initiated)
- Product Interaction (collection / vault)

**No tracking.**
