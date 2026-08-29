# Fort Crazypants hybrid products

The storefront now supports affiliate finds and Shopify/Zendrop products from the same Shopify catalog.

## Product metafields (namespace: custom)
Create these in Shopify Settings → Custom data → Products and expose them to the Storefront API:

- `custom.product_source` — single line text: `affiliate`, `zendrop`, or `shopify`
- `custom.is_affiliate` — true/false
- `custom.affiliate_url` — URL
- `custom.affiliate_network` — single line text, e.g. Amazon Associates, Mavely
- `custom.merchant` — single line text, e.g. Amazon, Target
- `custom.fcp_verdict` — multi-line text
- `custom.quick_take` — multi-line text
- `custom.why_we_picked_it` — multi-line text
- `custom.badge` — single line text
- `custom.cta_text` — single line text

## Behavior
- affiliate URL / is_affiliate / source=affiliate → external sponsored/nofollow retailer CTA; Shopify inventory is ignored
- source=zendrop or Zendrop tag → Shopify cart + checkout; Zendrop can fulfill the Shopify order
- everything else → normal Shopify cart + checkout

## Existing affiliate products
For each existing Amazon/affiliate listing, set:
- product_source = affiliate
- is_affiliate = true
- affiliate_url = your tracked link
- merchant = Amazon (or retailer)
- optional badge / verdict / quick take / CTA

## Zendrop products
Imported Zendrop products can use:
- product_source = zendrop
- no affiliate_url
- publish to the Headless sales channel
- ensure at least one variant is available for sale in Shopify
