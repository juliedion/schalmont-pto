# Fort Crazypants Storefront V1

Customer-facing affiliate discovery storefront for Fort Crazypants.

## V1 includes
- Editorial/discovery homepage rather than a traditional ecommerce catalog
- Trending Finds
- category chips
- Road Trip Rescues feature
- Why Didn't I Think of That?
- Under $25 feature
- The Crazy List editorial section
- newsletter block
- affiliate-ready individual Find pages
- FTC-style affiliate disclosure
- mobile responsive layout
- demo product data in `lib/finds.ts`

## Run locally
```bash
npm install
npm run dev
```

## Deploy
Create a new GitHub repo (recommended name: `fcp-storefront`) and upload the **contents** of this folder to the repo root. Import that repo into Vercel.

## Connecting to the Find Engine / Shopify
V1 uses local demo data so the storefront can be designed and deployed independently.

The intended V2 data flow is:

`Find Engine → Shopify affiliate product + metafields → Storefront API → Fort Crazypants storefront`

Recommended product metafields:
- `custom.is_affiliate`
- `custom.affiliate_url`
- `custom.affiliate_network`
- `custom.merchant`
- `custom.fcp_verdict`
- `custom.quick_take`
- `custom.why_we_picked_it`
- `custom.badge`
- `custom.cta_text`

Use Shopify's Storefront API for public product reads rather than exposing Admin API credentials to the browser.

## Before launch
Replace all demo `affiliateUrl: "#"` values with real data from Shopify/API.
