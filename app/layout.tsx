import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fort Crazypants | Crazy Good Finds for Real Family Life",
  description: "Useful, fun and occasionally ridiculous finds for kids, dogs, road trips, home and family life."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><head><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/><link href="https://fonts.googleapis.com/css2?family=Luckiest+Guy&family=Nunito:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/></head><body>{children}</body></html>;
}
