# Shopify live data connection

This build replaces the hard-coded demo product cards with Shopify Storefront API data.

Required Vercel environment variables (already configured by the site owner):
- SHOPIFY_STORE_DOMAIN
- SHOPIFY_STOREFRONT_ACCESS_TOKEN
- SHOPIFY_API_VERSION

What is live:
- Homepage product cards: title, image, description, price, vendor/type, availability
- Shop by Collection labels: Shopify collections
- Product detail pages by Shopify product handle
- Product detail links back to the Shopify product URL

The hero, animations, header, footer, and existing visual design were left intact.
