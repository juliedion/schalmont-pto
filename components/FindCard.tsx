import Link from "next/link";
import { commerceMode, formatMoney, productBadge, productCategory, productRetailer, productSummary, type ShopifyProduct } from "@/lib/shopify";

export default function FindCard({ item }: { item: ShopifyProduct }) {
  const price = formatMoney(item.priceRange.minVariantPrice.amount, item.priceRange.minVariantPrice.currencyCode);
  const mode = commerceMode(item);
  const soldOut = mode !== "affiliate" && !item.availableForSale;
  const summary = productSummary(item);
  return (
    <article className="findCard">
      <Link href={`/find/${item.handle}`} className="findVisual productVisual">
        {item.featuredImage ? (
          <img src={item.featuredImage.url} alt={item.featuredImage.altText || item.title} loading="lazy" />
        ) : <span className="findEmoji">🎁</span>}
        <span className="badge">{soldOut ? "Sold Out" : productBadge(item)}</span>
      </Link>
      <div className="findBody">
        <p className="micro">{productCategory(item)} · {productRetailer(item)}</p>
        <h3><Link href={`/find/${item.handle}`}>{item.title}</Link></h3>
        <p>{summary.slice(0, 125) + (summary.length > 125 ? "…" : "")}</p>
        <div className="cardBottom">
          <strong>{price}</strong>
          <Link href={`/find/${item.handle}`} className="textLink">See the Find →</Link>
        </div>
      </div>
    </article>
  );
}
