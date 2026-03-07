import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { ThemeProvider } from "@/src/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Prevent static prerendering — ConvexAuthNextjsProvider needs runtime client
export const dynamic = "force-dynamic";

const inter = Inter({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-inter",
});

export const metadata: Metadata = {
    title: "Procureline",
    description: "University Procurement Management Platform",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className={inter.variable} suppressHydrationWarning>
            <body className="font-sans antialiased">
                <ConvexAuthNextjsServerProvider>
                    <ConvexClientProvider>
                        <ThemeProvider
                            attribute="class"
                            defaultTheme="system"
                            enableSystem
                            disableTransitionOnChange
                        >
                            {children}
                        </ThemeProvider>
                    </ConvexClientProvider>
                </ConvexAuthNextjsServerProvider>
                <Toaster richColors position="top-right" />
            </body>
        </html>
    );
}
