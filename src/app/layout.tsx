import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "X Content Delivery Automation Engine",
  description: "Automated content delivery engine for tech, SaaS, startups, and AI topics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
