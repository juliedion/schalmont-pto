# Spirit Wear, Gift Cards + Coupon Books — Shopify setup

Three pages share one order: `/shop` (shirt builder), `/giftcards` and `/couponbook`.
The order is built on our site, then handed to Shopify for payment. Every choice rides along on its order line, so Shopify's checkout, the
order in Shopify admin, and the customer's confirmation email all show it:

| Item | What Shopify shows on the line |
|---|---|
| Shirt | Size, Color, Design (e.g. `#GD-047 No Fear, Just Pride`), Design placement, Print version (dark or light fabric), Front logo |
| Emailed gift card to someone else | Recipient name, Recipient email, Message |
| Printed gift card | To, From, Message, Delivery (Deliver to school, Local home delivery, Ship it), Student, School and Teacher for school delivery, Gift wrap when shipped |
| Coupon book | Delivery, plus Student, School and Teacher for school delivery |

Until the store is connected (step 6), the page works but the Checkout button says
"Online checkout opens soon."

## 1. Store and plan

Use a Shopify store on the **Basic plan or higher**. The site connects through
Shopify's **Headless** sales channel, which needs a paid plan, not the $5 Starter plan.

## 2. Shirt products

Create one product for each shirt. The **URL handle** must match exactly.
You'll find it under the product's *Search engine listing* section.

| Product | Handle | Price | Sizes | Colors |
|---|---|---|---|---|
| Short Sleeve Tee | `short-sleeve-tee` | $10 | Youth + Adult | Black, White, Dark Green, Bright Green, Heather Gray |
| Long Sleeve Tee | `long-sleeve-tee` | $15 | Youth + Adult | Black, White, Dark Green, Bright Green, Heather Gray |
| Hoodie | `hoodie` | $20 | Youth + Adult | Black, White, Dark Green, Bright Green, Heather Gray |
| Crewneck | `crewneck` | $15 | Youth + Adult | Black, White, Dark Green, Bright Green, Heather Gray |
| Performance Hooded Tee (Adult), Paragon 220 | `performance-hooded-tee` | $20 | Adult only | White, Black, Heather Gray, Medium Gray, Olive Green |
| Performance Hooded Tee (Youth), Team 365 TT41Y | `youth-performance-hooded-tee` | $20 | Youth only | White, Black, Sport Forest, Sport Graphite, Sport Silver |

Either way works:

- **Simple:** no variants. Size and color come through as line details.
- **With variants:** add options named exactly **Size** and **Color**. This lets Shopify
  track and report by size. Use these values, spelled the same, and only the ones that
  product offers:
  - Size: `Youth XS`, `Youth S`, `Youth M`, `Youth L`, `Youth XL`, `Adult S`, `Adult M`,
    `Adult L`, `Adult XL`, `Adult 2XL`, `Adult 3XL`, `Adult 4XL`, `Adult 5XL`
  - Color: the names in the table above, spelled the same.

Each item's colors and sizes are set in `js/spiritwear-catalog.json` (`colors` and
`sizeGroups` on each shirt).

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

## 4b. Coupon book

A regular product, handle **`coupon-book`**, priced **$25**, with **"This is a physical
product"** checked. The page lists 313 offers at 220 locations. Those numbers are in
`couponbook.html` and `js/spiritwear-catalog.json`; update both if SaveAround changes them.

## 5. Shipping and local delivery

*Settings → Shipping and delivery:*
- Add shipping rates for shipped orders.
- Turn on **Local delivery** (set your delivery zip codes or radius). This covers
  "Local home delivery."
- Turn on **Local pickup** with a location named something like **"Deliver to school
  (sent home with student)"**. For "Deliver to school," the buyer picks this at
  checkout. The student, school and teacher come through on the order line.
- "Ship it" on a printed gift card means it goes out gift-wrapped and addressed.
  The order line says "Gift wrap: Wrapped and addressed."


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
