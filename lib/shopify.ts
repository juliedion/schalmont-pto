export type ShopifyMetafield = { value: string; type: string } | null;

export type ShopifyVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  quantityAvailable?: number | null;
  price: { amount: string; currencyCode: string };
};

export type ShopifyProduct = {
  id: string;
  handle: string;
  title: string;
  description: string;
  productType: string;
  vendor: string;
  tags: string[];
  availableForSale: boolean;
  featuredImage?: { url: string; altText?: string | null; width?: number; height?: number } | null;
  priceRange: { minVariantPrice: { amount: string; currencyCode: string } };
  variants: { nodes: ShopifyVariant[] };
  onlineStoreUrl?: string | null;
  isAffiliate?: ShopifyMetafield;
  affiliateUrl?: ShopifyMetafield;
  affiliateNetwork?: ShopifyMetafield;
  merchant?: ShopifyMetafield;
  productSource?: ShopifyMetafield;
  fcpVerdict?: ShopifyMetafield;
  quickTake?: ShopifyMetafield;
  whyWePickedIt?: ShopifyMetafield;
  badge?: ShopifyMetafield;
  ctaText?: ShopifyMetafield;
};

export type ShopifyCollection = { id: string; handle: string; title: string };
export type CommerceMode = "affiliate" | "shopify" | "zendrop";

const domain = process.env.SHOPIFY_STORE_DOMAIN?.replace(/^https?:\/\//, "").replace(/\/$/, "");
const token = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
const version = process.env.SHOPIFY_API_VERSION || "2026-04";

async function shopifyFetch<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  if (!domain || !token) throw new Error("Shopify Storefront API environment variables are missing.");
  const response = await fetch(`https://${domain}/api/${version}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": token },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  const json = await response.json();
  if (!response.ok || json.errors) throw new Error(json.errors?.map((e: {message:string}) => e.message).join("; ") || `Shopify API error ${response.status}`);
  return json.data as T;
}

const productFields = `
  id handle title description productType vendor tags availableForSale onlineStoreUrl
  featuredImage { url altText width height }
  priceRange { minVariantPrice { amount currencyCode } }
  variants(first: 20) { nodes { id title availableForSale quantityAvailable price { amount currencyCode } } }
  isAffiliate: metafield(namespace: "custom", key: "is_affiliate") { value type }
  affiliateUrl: metafield(namespace: "custom", key: "affiliate_url") { value type }
  affiliateNetwork: metafield(namespace: "custom", key: "affiliate_network") { value type }
  merchant: metafield(namespace: "custom", key: "merchant") { value type }
  productSource: metafield(namespace: "custom", key: "product_source") { value type }
  fcpVerdict: metafield(namespace: "custom", key: "fcp_verdict") { value type }
  quickTake: metafield(namespace: "custom", key: "quick_take") { value type }
  whyWePickedIt: metafield(namespace: "custom", key: "why_we_picked_it") { value type }
  badge: metafield(namespace: "custom", key: "badge") { value type }
  ctaText: metafield(namespace: "custom", key: "cta_text") { value type }
`;

export async function getProducts(first = 12): Promise<ShopifyProduct[]> {
  const data = await shopifyFetch<{ products: { nodes: ShopifyProduct[] } }>(`query Products($first: Int!) { products(first: $first, sortKey: UPDATED_AT, reverse: true) { nodes { ${productFields} } } }`, { first });
  return data.products.nodes;
}

export async function getProduct(handle: string): Promise<ShopifyProduct | null> {
  const data = await shopifyFetch<{ product: ShopifyProduct | null }>(`query Product($handle: String!) { product(handle: $handle) { ${productFields} } }`, { handle });
  return data.product;
}

export async function getCollections(first = 8): Promise<ShopifyCollection[]> {
  const data = await shopifyFetch<{ collections: { nodes: ShopifyCollection[] } }>(`query Collections($first: Int!) { collections(first: $first, sortKey: UPDATED_AT, reverse: true) { nodes { id handle title } } }`, { first });
  return data.collections.nodes;
}

export function formatMoney(amount: string, currencyCode: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode }).format(Number(amount));
}

export function metaValue(field?: ShopifyMetafield) {
  return field?.value?.trim() || "";
}

export function metafieldBoolean(field?: ShopifyMetafield) {
  return ["true", "1", "yes"].includes(metaValue(field).toLowerCase());
}

export function commerceMode(product: ShopifyProduct): CommerceMode {
  const source = metaValue(product.productSource).toLowerCase();
  const tags = product.tags.map((t) => t.toLowerCase());
  if (metaValue(product.affiliateUrl) || metafieldBoolean(product.isAffiliate) || source === "affiliate" || tags.some((t) => ["affiliate", "amazon", "mavely", "target affiliate"].includes(t))) return "affiliate";
  if (source === "zendrop" || tags.some((t) => t.includes("zendrop"))) return "zendrop";
  return "shopify";
}

export function productRetailer(product: ShopifyProduct) {
  const mode = commerceMode(product);
  if (mode === "affiliate") return metaValue(product.merchant) || metaValue(product.affiliateNetwork) || "Retailer";
  if (mode === "zendrop") return "Fort Crazypants";
  return product.vendor || "Fort Crazypants";
}

export function productCategory(product: ShopifyProduct) {
  return product.productType || product.tags.find((tag) => !["affiliate", "zendrop"].includes(tag.toLowerCase())) || "Crazy-Good Find";
}

export function productBadge(product: ShopifyProduct) {
  return metaValue(product.badge) || (commerceMode(product) === "affiliate" ? "Crazy Good Find" : commerceMode(product) === "zendrop" ? "Ships from the Fort" : "Fort Favorite");
}

export function productSummary(product: ShopifyProduct) {
  return metaValue(product.quickTake) || product.description || "A fresh find from the Fort.";
}

export function primaryVariant(product: ShopifyProduct) {
  return product.variants.nodes.find((variant) => variant.availableForSale) || product.variants.nodes[0] || null;
}

export async function createCart(merchandiseId: string, quantity = 1) {
  const data = await shopifyFetch<{
    cartCreate: {
      cart: { id: string; checkoutUrl: string } | null;
      userErrors: { field?: string[] | null; message: string }[];
    };
  }>(`mutation CreateCart($input: CartInput!) {
    cartCreate(input: $input) {
      cart { id checkoutUrl }
      userErrors { field message }
    }
  }`, { input: { lines: [{ merchandiseId, quantity }] } });
  if (!data.cartCreate.cart || data.cartCreate.userErrors.length) {
    throw new Error(data.cartCreate.userErrors.map((e) => e.message).join("; ") || "Unable to create Shopify cart.");
  }
  return data.cartCreate.cart;
}
