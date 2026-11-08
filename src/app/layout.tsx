import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { DemoBanner } from "@/components/layout/DemoBanner";
import { AgeGate } from "@/components/layout/AgeGate";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "HonshuWheel", template: "%s · HonshuWheel" },
  description: "Spin prize wheels to win sealed trading card products. 18+ only.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-bg">
          Skip to content
        </a>
        <AgeGate />
        <DemoBanner />
        <Header />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 focus:outline-none">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
