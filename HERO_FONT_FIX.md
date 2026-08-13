# Hero typography fix

The previous transplant was being overridden by older `.hero h1` rules with higher CSS specificity. V2.2 adds higher-specificity selectors that match the current Shopify theme values and imports the same Google fonts used by the Shopify theme.

Desktop title: `clamp(2.7rem, 5.05vw, 5rem)`
Tablet <= 900px: `3.55rem`
Mobile <= 560px: `3.05rem`
Subtitle: `clamp(1rem, 1.25vw, 1.16rem)`, mobile `.98rem`
