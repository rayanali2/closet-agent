import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Closet Agent — Dress around your day",
  description: "Your plans. Your closet. One less decision. A personal wardrobe demo powered by Magic Hour.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
