# PiPhop Roeung · Netlify

This branch redesigns the existing DramaVerse frontend. The original movie IDs, prices, Supabase configuration and checkout RPC contracts are retained. The logo is SVG with live Khmer text in Kantumruy Pro; the hero is newly generated fictional cinematic artwork.

## Deploy

1. In Netlify, import `lensbykai-bit/DramaVerse` and select `feat/piphop-roeung-netlify` to preview this version, or merge its PR before using `main`.
2. `netlify.toml` sets build command `node scripts/build.mjs` and publish folder `dist`. No npm installation is required.
3. Add the deployed `/admin.html` URL to the existing Supabase Auth redirect allowlist. Admin redirects now use the current host.
4. Open the homepage and verify the catalog and checkout against the actual backend before accepting purchases.

## Existing backend dependencies

The original repository contains frontend code only. It expects the existing Supabase tables `movies`, `site_settings`, `payment_settings`; RPCs `create_checkout_order`, `get_checkout_order`, `attach_order_khqr`; and Edge Function `bakong-order` for payment verification. Their definitions and Telegram bot implementation are not present in this repository. This update does not provision, change or verify those backend services.

A real server must validate the authoritative order amount and currency against Bakong before marking an order paid, keep payment and Telegram bot credentials server-side, and issue a per-order Telegram invite only after payment verification. Single-use/revoke-on-first-join behavior must be implemented and tested by that server/bot; the frontend cannot enforce it. USD $3 pricing requires an explicit backend currency/price update: the retained checkout currently uses KHR. Do not infer a conversion rate or merely change display labels.

When live catalog retrieval fails, JSON sample data is clearly labeled and checkout is disabled. Sample movies do not contain posters; upload real posters through the existing content workflow. No private full-movie links should be placed in public JSON.

## Validation

Run `node scripts/build.mjs`, `node --check js/app.js`, `node --check js/pay.js`, `node --check js/admin.js`, and `node --test tests/checkout.test.mjs`.

Browser QA covered homepage display, Khmer search, movie modal, sample checkout guard, and the missing payment link error page. Mock tests cover malformed token encoding and paid/pending link guards. No real money was transferred, no paid order was created, and no Telegram invite lifecycle was tested.
