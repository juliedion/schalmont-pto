# Spirit Wear + Gift Cards — Shopify setup

The shop page (`/shop`) builds the order on our site, then hands it to Shopify for
payment. Every choice rides along on its order line, so Shopify's checkout, the
order in Shopify admin, and the customer's confirmation email all show it:

| Item | What Shopify shows on the line |
|---|---|
| Shirt | Size, Color, Design (e.g. `#GD-047 No Fear, Just Pride`), Design placement, Front logo |
| Emailed gift card to someone else | Recipient name, Recipient email, Message |
| Printed gift card | To, From, Message, Delivery preference |

Until the store is connected (step 6), the page works but the Checkout button says
"Online checkout opens soon."

## 1. Store and plan

Use a Shopify store on the **Basic plan or higher**. The site connects through
Shopify's **Headless** sales channel, which needs a paid plan, not the $5 Starter plan.

## 2. Shirt products

Create one product for each shirt. The **URL handle** must match exactly.
You'll find it under the product's *Search engine listing* section.

| Product | Handle | Price |
|---|---|---|
| Short Sleeve Tee | `short-sleeve-tee` | $10 |
| Long Sleeve Tee | `long-sleeve-tee` | $15 |
| Hoodie | `hoodie` | $20 |
| Crewneck | `crewneck` | $15 |
| Performance Hooded Tee | `performance-hooded-tee` | $20 |

Either way works:

- **Simple:** no variants. Size and color come through as line details.
- **With variants:** add options named exactly **Size** and **Color**. This lets Shopify
  track and report by size. Use these values, spelled the same:
  - Size: `Youth XS`, `Youth S`, `Youth M`, `Youth L`, `Youth XL`, `Adult S`, `Adult M`,
    `Adult L`, `Adult XL`, `Adult 2XL`, `Adult 3XL`, `Adult 4XL`, `Adult 5XL`
  - Color: `Black`, `White`, `Dark Green`

The site shows the prices it gets from Shopify, so change prices in Shopify.
If you also update `price` in `js/spiritwear-catalog.json`, the page shows the
right price before Shopify answers.

## 3. Emailed gift card

*Products → Gift cards → Add gift card product.* Use handle **`gift-card`**, with
denominations **$10, $25, $50, $100**. These amounts are set in
`js/spiritwear-catalog.json` under `giftCards.amounts`.

Shopify emails the code itself:
- **"Email it to me":** the code goes to the buyer.
- **"Email it to someone else":** the code goes to the recipient, with the message.

**Test this once (step 7).** Shopify doesn't fully document sending to a recipient
from a website like ours. If the recipient doesn't get the email, the buyer still gets
the code and can forward it.

## 4. Printed gift card

This is a **regular product, not a Shopify gift card**, because Shopify admin only
ever shows the last 4 characters of a gift card code it issued automatically.

- Handle **`printed-gift-card`**, with one variant per amount ($10, $25, $50, $100),
  each priced at its amount.
- Leave **"This is a physical product"** checked, so checkout asks how to deliver it.

When one sells:
1. *Products → Gift cards → Create gift card* for the amount. The full code shows
   right then.
2. Print it on the card (`Sabre Spiritwear Store/Giftcards/`) with the To/From/Message
   from the order.
3. Deliver or ship it.

## 5. Shipping and local delivery

*Settings → Shipping and delivery:*
- Add shipping rates for shipped orders.
- Turn on **Local delivery** (set your delivery zip codes or radius). Turn on
  **Local pickup** too if families can pick up at school.

The buyer picks the method at checkout. The site also records their preference
on printed cards.

## 6. Connect the site

1. Install the **Headless** channel from the Shopify App Store → *Create storefront*.
2. Copy the **public** Storefront API access token. It's meant to be visible in web
   pages, so it's fine in our files. **Never** put the *private* token or an Admin API
   token on the site.
3. Make every product above available on the **Headless** channel
   (product → *Publishing*).
4. In `js/spiritwear-catalog.json`, fill in:
   ```json
   "shopify": {
     "storeDomain": "your-store.myshopify.com",
     "storefrontToken": "the public token",
     "apiVersion": "2026-07"
   }
   ```

## 7. Test before announcing

Turn on test payments (*Settings → Payments*: Shopify Payments test mode or the
Bogus Gateway). Then place one order with:
- a shirt,
- an emailed gift card to a second email address you can check,
- a printed gift card.

Check that:
- the order lines show all the details,
- the recipient email arrives,
- coming back to `/shop` afterward shows "Thank you!" and an empty order.
