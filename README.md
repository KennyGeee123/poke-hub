# PokéVault Pro

Pokémon TCG catalog on Vercel + Supabase.

Live: https://pokedex-hub-lime.vercel.app/

## Owned Supabase env vars

Set in Vercel and .env.local (never commit):
- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY
- SUPABASE_URL
- SUPABASE_PUBLISHABLE_KEY
- SUPABASE_SERVICE_ROLE_KEY (server only)

Optional AI: AI_GATEWAY_URL, AI_GATEWAY_API_KEY

## Google OAuth (Supabase)
1. Enable Google under Authentication -> Providers.
2. Create Google Cloud OAuth web credentials; use Supabase callback.
3. Redirect URLs: https://pokedex-hub-lime.vercel.app/login and /** plus localhost:3000/5173/8080 /login
4. Site URL: https://pokedex-hub-lime.vercel.app
App uses supabase.auth.signInWithOAuth google redirectTo origin+/login.

## Scripts
bun install; bun run dev; bun run build

## Notes
- Whatnot: deep-links only in price aggregator.
- Discover sorts market price high to low.

Existing Lovable-provisioned Supabase project env vars continue to work after this strip; no new Supabase required for cutover.
Next step (not in this change): Cloudflare Workers / D1 if moving off Vercel.
