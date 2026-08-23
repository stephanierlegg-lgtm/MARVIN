import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Deal Optimizer",
  description: "Grocery ad + coupon aggregator and multi-store cart optimizer",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        <header className="border-b bg-white">
          <nav className="max-w-5xl mx-auto flex items-center gap-6 px-6 py-4 text-sm font-medium">
            <span className="font-semibold text-base">Deal Optimizer</span>
            <Link href="/prices" className="hover:underline">Prices</Link>
            <Link href="/offers" className="hover:underline">Offers</Link>
            <Link href="/lists" className="hover:underline">Shopping Lists</Link>
          </nav>
        </header>
        <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
