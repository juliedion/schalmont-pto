import { notFound } from "next/navigation";
import Header from "@/components/Header";
import ProductAction from "@/components/ProductAction";
import { commerceMode, formatMoney, getProduct, metaValue, productCategory, productRetailer } from "@/lib/shopify";

export const dynamic = "force-dynamic";

export default async function FindPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = await getProduct(slug);
  if (!item) notFound();
  const price = formatMoney(item.priceRange.minVariantPrice.amount, item.priceRange.minVariantPrice.currencyCode);
  const mode = commerceMode(item);
  const verdict = metaValue(item.fcpVerdict);
  const quickTake = metaValue(item.quickTake);
  const why = metaValue(item.whyWePickedIt);
  const variant = item.variants.nodes.find((v) => v.availableForSale) || item.variants.nodes[0] || null;

  return (
    <>
      <Header />
      <main className="findPage">
        <a href="/" className="backLink">← Back to all Finds</a>
        <section className="findDetail">
          <div className="detailVisual productDetailVisual">
            {item.featuredImage ? <img src={item.featuredImage.url} alt={item.featuredImage.altText || item.title} /> : <span>🎁</span>}
            {mode !== "affiliate" && !item.availableForSale && <b>Sold Out</b>}
          </div>
          <div className="detailCopy">
            <p className="kicker">{productCategory(item)} · {productRetailer(item)}</p>
            <h1>{item.title}</h1>
            <div className="verdict"><small>{verdict ? "FORT CRAZYPANTS VERDICT" : "PRICE"}</small><strong>{verdict || price}</strong></div>
            <p className="detailLead">{quickTake || item.description || "A fresh crazy-good find from Fort Crazypants."}</p>
            {why ? <><h2>Why it made the list</h2><p>{why}</p></> : item.tags.length > 0 && <><h2>Why it made the list</h2><ul>{item.tags.filter((tag) => !["affiliate", "zendrop"].includes(tag.toLowerCase())).slice(0,6).map((tag) => <li key={tag}>✓ {tag}</li>)}</ul></>}
            <ProductAction mode={mode} affiliateUrl={metaValue(item.affiliateUrl)} retailer={productRetailer(item)} ctaText={metaValue(item.ctaText)} variantId={variant?.id} available={mode === "affiliate" ? true : Boolean(variant?.availableForSale)} />
            <p className="tinyDisclosure">{mode === "affiliate" ? "Fort Crazypants may earn a commission if you purchase through this retailer link. Pricing and availability can change at the retailer." : "Checkout is securely handled by Shopify. Fulfillment for eligible products may be handled by our fulfillment partners."}</p>
          </div>
        </section>
      </main>
      <footer><a href="/" className="footerLogo" aria-label="Fort Crazypants home"><img src="/fort-crazypants-logo.png" alt="Fort Crazypants — Find Your Next Favorite Thing" /></a><p>© Fort Crazypants · Crazy good finds for real family life.</p></footer>
    </>
  );
}
