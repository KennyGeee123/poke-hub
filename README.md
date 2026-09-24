# PokéVault

Unofficial fan-made Pokémon TCG collection tracker, market helper, scanner, and Adventure mode.

**Not affiliated with Nintendo, The Pokémon Company, or Game Freak.**

Live: https://pokedex-hub-lime.vercel.app/

## Stack

- TanStack Start + Vite + React + Tailwind
- Supabase Auth (Google + Apple OAuth + email/password)
- Capacitor iOS / Android shells (`com.kennygeee.pokevault`)
- Vercel host (Nitro)

## Getting started

```bash
bun install   # or npm install
cp .env.example .env.local
# fill VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY (and server mirrors)
bun run dev
```

## Env

See [`.env.example`](.env.example). Never commit secrets. Vercel needs the same
`VITE_*` and server `SUPABASE_*` keys.

## Auth (Supabase)

1. Authentication → Providers → enable **Google** and (for iOS store) **Apple**.
2. Redirect URLs:
   - `https://pokedex-hub-lime.vercel.app/login`
   - `https://pokedex-hub-lime.vercel.app/**`
   - `com.kennygeee.pokevault://auth/callback`
   - localhost `/login` for local ports you use
3. Site URL: `https://pokedex-hub-lime.vercel.app`
4. Apple provider needs Services ID, Team ID, Key ID, and `.p8` from Apple Developer
   (see [`docs/APP-STORE.md`](docs/APP-STORE.md)). Code path is wired; secrets are yours.

App OAuth: `signInWithOAuth` with `redirectTo` from `src/lib/platform.ts`
(web origin `/login`, native custom scheme). Native opens Capacitor Browser and
finishes via `appUrlOpen` deep link.

## Web deploy

Push to `main` on `KennyGeee123/poke-hub` — Vercel project `pokedex-hub` auto-deploys.

```bash
bun run build
# optional: npx vercel --prod
```

## iOS / Android

```bash
python3 scripts/generate-icons.py
npx capacitor-assets generate   # optional; needs @capacitor/assets
npm run ios      # prepare www + cap sync + open Xcode
npm run android  # same for Android Studio
```

Native shells load the **live** Vercel URL in the WebView (`capacitor.config.ts`
`server.url`) because TanStack Start is SSR. Bundle id: `com.kennygeee.pokevault`.

Full store checklist: [`docs/APP-STORE.md`](docs/APP-STORE.md).

## Legal

Hosted for store listings and in-app links (More + Settings):

- https://pokedex-hub-lime.vercel.app/privacy.html
- https://pokedex-hub-lime.vercel.app/terms.html
- https://pokedex-hub-lime.vercel.app/support.html

## Scripts

| Script | What |
|---|---|
| `bun run dev` | Local Vite/TanStack Start |
| `bun run build` | Production build |
| `npm run icons` | Regen icon/splash PNGs |
| `npm run cap:sync` | Prepare `www/` + Capacitor sync |
| `npm run ios` / `android` | Sync + open native IDE |

## Notes

- Leave untracked local experiments alone (`public/fx/` large media, etc.).
- Whatnot / marketplaces: deep-links only.
- Do not ship copyrighted ROMs or ripped Nintendo assets.
