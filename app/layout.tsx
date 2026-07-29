import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const host = h.get("host") || "localhost";
  const protocol = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og.png`;
  return {
    title: "BOW — Weekly Cash Planner",
    description: "Plan bills, purchases, and savings against the cash you actually have each week.",
    icons: { icon: "/favicon.svg" },
    openGraph: { title: "BOW — Weekly Cash Planner", description: "Know what’s safe to spend.", images: [image] },
    twitter: { card: "summary_large_image", title: "BOW — Weekly Cash Planner", description: "Know what’s safe to spend.", images: [image] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
