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
  onlineStoreUrl?: string | null;
};

export type ShopifyCollection = { id: string; handle: string; title: string };

const domain = process.env.SHOPIFY_STORE_DOMAIN?.replace(/^https?:\/\//, "").replace(/\/$/, "");
const token = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
const version = process.env.SHOPIFY_API_VERSION || "2026-04";

async function shopifyFetch<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  if (!domain || !token) throw new Error("Shopify Storefront API environment variables are missing.");
  const response = await fetch(`https://${domain}/api/${version}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": token },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 300 },
  });
  const json = await response.json();
  if (!response.ok || json.errors) throw new Error(json.errors?.map((e: {message:string}) => e.message).join("; ") || `Shopify API error ${response.status}`);
  return json.data as T;
}

const productFields = `
  id handle title description productType vendor tags availableForSale onlineStoreUrl
  featuredImage { url altText width height }
  priceRange { minVariantPrice { amount currencyCode } }
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

export function productCategory(product: ShopifyProduct) {
  return product.productType || product.tags[0] || "Crazy-Good Find";
}
