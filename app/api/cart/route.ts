import { NextResponse } from "next/server";
import { createCart } from "@/lib/shopify";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const merchandiseId = typeof body.merchandiseId === "string" ? body.merchandiseId : "";
    const quantity = Number.isFinite(body.quantity) ? Math.max(1, Math.floor(body.quantity)) : 1;
    if (!merchandiseId.startsWith("gid://shopify/ProductVariant/")) {
      return NextResponse.json({ error: "Invalid product variant." }, { status: 400 });
    }
    const cart = await createCart(merchandiseId, quantity);
    return NextResponse.json({ checkoutUrl: cart.checkoutUrl });
  } catch (error) {
    console.error("Shopify cart error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create cart." }, { status: 500 });
  }
}
