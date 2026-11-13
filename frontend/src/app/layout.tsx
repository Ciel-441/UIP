import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Unified Intelligence Platform",
  description: "Enterprise knowledge graph and intelligence platform connecting agriculture, medicine, environment, and science.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans bg-[#0a0a0f] text-white antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
