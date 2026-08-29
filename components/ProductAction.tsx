"use client";

import { useState } from "react";

type Props = {
  mode: "affiliate" | "shopify" | "zendrop";
  affiliateUrl?: string;
  retailer?: string;
  ctaText?: string;
  variantId?: string;
  available: boolean;
};

export default function ProductAction({ mode, affiliateUrl, retailer = "Retailer", ctaText, variantId, available }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (mode === "affiliate") {
    if (!affiliateUrl) return <p className="productActionNotice">Affiliate link coming soon.</p>;
    return (
      <a href={affiliateUrl} target="_blank" rel="sponsored nofollow noopener" className="primaryBtn retailerBtn">
        {ctaText || `See it at ${retailer} →`}
      </a>
    );
  }

  if (!variantId || !available) {
    return <button className="primaryBtn retailerBtn" type="button" disabled>Currently unavailable</button>;
  }

  async function checkout() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchandiseId: variantId, quantity: 1 }),
      });
      const data = await response.json();
      if (!response.ok || !data.checkoutUrl) throw new Error(data.error || "Could not start checkout.");
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout.");
      setLoading(false);
    }
  }

  return (
    <div className="productActionWrap">
      <button className="primaryBtn retailerBtn" type="button" onClick={checkout} disabled={loading}>
        {loading ? "Opening checkout…" : mode === "zendrop" ? "Buy from Fort Crazypants →" : "Buy now →"}
      </button>
      {error && <p className="productActionError">{error}</p>}
    </div>
  );
}
