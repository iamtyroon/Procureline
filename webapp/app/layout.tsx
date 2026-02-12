import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Procureline - Procurement Planning Platform",
  description: "Streamline your procurement planning with visual tools and real-time collaboration",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html lang="en">
        <body className={inter.className}>{children}</body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
