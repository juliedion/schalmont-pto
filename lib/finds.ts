export type Find = {
  slug: string;
  title: string;
  eyebrow: string;
  category: string;
  retailer: string;
  affiliateUrl: string;
  price?: string;
  verdict: string;
  quickTake: string;
  why: string[];
  badge?: string;
  emoji: string;
  tone: string;
};

export const finds: Find[] = [
  {
    slug: "shark-chillpill",
    title: "Shark ChillPill 3-in-1",
    eyebrow: "Tiny fan. Serious chill.",
    category: "Travel",
    retailer: "Amazon",
    affiliateUrl: "#",
    price: "$—",
    verdict: "Road-trip lifesaver.",
    quickTake: "Portable cooling that earns its space in the car, beach bag or sidelines tote.",
    why: ["Portable and rechargeable", "Family-trip friendly", "Easy impulse-buy price point", "Actually useful after vacation"],
    badge: "Crazy Good Find",
    emoji: "❄️",
    tone: "cool"
  },
  {
    slug: "road-trip-coloring-blanket",
    title: "DIY Coloring Blanket",
    eyebrow: "Part activity. Part blanket.",
    category: "Road Trip Rescues",
    retailer: "Amazon",
    affiliateUrl: "#",
    price: "$—",
    verdict: "A screen-free sanity saver.",
    quickTake: "Something kids can actually do in the backseat—and use again when the trip is over.",
    why: ["Screen-free", "Travel-friendly", "Reusable", "Kid-approved energy"],
    badge: "Kid Approved",
    emoji: "🎨",
    tone: "play"
  },
  {
    slug: "interactive-dog-football",
    title: "Interactive Dog Football",
    eyebrow: "For dogs with main-character energy.",
    category: "Dog Stuff",
    retailer: "Amazon",
    affiliateUrl: "#",
    price: "$—",
    verdict: "Ridiculous enough to be perfect.",
    quickTake: "A goofy, high-energy toy that looks great on social and keeps active dogs busy.",
    why: ["High demo factor", "Funny gift potential", "Great social content", "Active-dog friendly"],
    badge: "Otis Would Approve",
    emoji: "🐶",
    tone: "dog"
  },
  {
    slug: "backseat-organizer",
    title: "Backseat Organizer",
    eyebrow: "Less chaos behind the driver's seat.",
    category: "Road Trip Rescues",
    retailer: "Target",
    affiliateUrl: "#",
    price: "$—",
    verdict: "Boring product. Excellent life upgrade.",
    quickTake: "The kind of practical find you don't appreciate until snacks, chargers and markers stop living on the floor.",
    why: ["Solves a real mess", "Easy family fit", "Travel staple", "Giftable for parents"],
    badge: "Problem Solved",
    emoji: "🚗",
    tone: "road"
  },
  {
    slug: "rolling-cart",
    title: "3-Tier Rolling Cart",
    eyebrow: "Tiny command center on wheels.",
    category: "Home Hacks",
    retailer: "Walmart",
    affiliateUrl: "#",
    price: "$—",
    verdict: "Organizing without committing to furniture.",
    quickTake: "Crafts, snacks, homework, bathroom stuff—this is one of those products with way too many jobs.",
    why: ["Multi-use", "Small-space friendly", "Easy before/after content", "Home organization win"],
    badge: "Why Didn't I Think of That?",
    emoji: "🛒",
    tone: "home"
  },
  {
    slug: "summer-backyard-find",
    title: "Backyard Summer Find",
    eyebrow: "Home, but make it vacation.",
    category: "Backyard Fun",
    retailer: "Mavely",
    affiliateUrl: "#",
    price: "$—",
    verdict: "Summer energy without packing the car.",
    quickTake: "An easy way to make an ordinary afternoon feel like somebody planned something.",
    why: ["Family fun", "Seasonal content", "High visual appeal", "Weekend impulse buy"],
    badge: "Backyard Win",
    emoji: "☀️",
    tone: "sun"
  }
];

export const categories = [
  "Trending Finds", "Road Trip Rescues", "Kid Approved", "Dog Stuff",
  "Backyard Fun", "Home Hacks", "Under $25", "Gifts"
];

export function getFind(slug: string) {
  return finds.find((item) => item.slug === slug);
}
