import { notFound } from "next/navigation";
import Header from "@/components/Header";
import { formatMoney, getProduct, productCategory } from "@/lib/shopify";

export const dynamic = "force-dynamic";

export default async function FindPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = await getProduct(slug);
  if (!item) notFound();
  const price = formatMoney(item.priceRange.minVariantPrice.amount, item.priceRange.minVariantPrice.currencyCode);
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN?.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const productUrl = item.onlineStoreUrl || (storeDomain ? `https://${storeDomain}/products/${item.handle}` : "#");

  return (
    <>
      <Header />
      <main className="findPage">
        <a href="/" className="backLink">← Back to all Finds</a>
        <section className="findDetail">
          <div className="detailVisual productDetailVisual">
            {item.featuredImage ? <img src={item.featuredImage.url} alt={item.featuredImage.altText || item.title} /> : <span>🎁</span>}
            {!item.availableForSale && <b>Sold Out</b>}
          </div>
          <div className="detailCopy">
            <p className="kicker">{productCategory(item)}{item.vendor ? ` · ${item.vendor}` : ""}</p>
            <h1>{item.title}</h1>
            <div className="verdict"><small>PRICE</small><strong>{price}</strong></div>
            <p className="detailLead">{item.description || "A fresh crazy-good find from Fort Crazypants."}</p>
            {item.tags.length > 0 && <><h2>Why it made the list</h2><ul>{item.tags.slice(0,6).map((tag) => <li key={tag}>✓ {tag}</li>)}</ul></>}
            <a href={productUrl} className="primaryBtn retailerBtn">{item.availableForSale ? "Shop this find →" : "View product →"}</a>
            <p className="tinyDisclosure">Product details, pricing and availability are pulled from the Fort Crazypants Shopify catalog.</p>
          </div>
        </section>
      </main>
      <footer><a href="/" className="footerLogo" aria-label="Fort Crazypants home"><img src="/fort-crazypants-logo.png" alt="Fort Crazypants — Find Your Next Favorite Thing" /></a><p>© Fort Crazypants · Crazy good finds for real family life.</p></footer>
    </>
  );
}
