import Link from "next/link";
import { formatMoney, productCategory, type ShopifyProduct } from "@/lib/shopify";

export default function FindCard({ item }: { item: ShopifyProduct }) {
  const price = formatMoney(item.priceRange.minVariantPrice.amount, item.priceRange.minVariantPrice.currencyCode);
  return (
    <article className="findCard">
      <Link href={`/find/${item.handle}`} className="findVisual productVisual">
        {item.featuredImage ? (
          <img src={item.featuredImage.url} alt={item.featuredImage.altText || item.title} loading="lazy" />
        ) : <span className="findEmoji">🎁</span>}
        {!item.availableForSale && <span className="badge">Sold Out</span>}
      </Link>
      <div className="findBody">
        <p className="micro">{productCategory(item)}{item.vendor ? ` · ${item.vendor}` : ""}</p>
        <h3><Link href={`/find/${item.handle}`}>{item.title}</Link></h3>
        <p>{item.description ? item.description.slice(0, 125) + (item.description.length > 125 ? "…" : "") : "A fresh find from the Fort."}</p>
        <div className="cardBottom">
          <strong>{price}</strong>
          <Link href={`/find/${item.handle}`} className="textLink">See the Find →</Link>
        </div>
      </div>
    </article>
  );
}
