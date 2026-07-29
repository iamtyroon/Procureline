import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { ThemeProvider } from "@/src/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Prevent static prerendering — ConvexAuthNextjsProvider needs runtime client
export const dynamic = "force-dynamic";

const inter = Inter({
    subsets: ["latin"],
    variable: "--font-inter",
    display: "swap",
});

const spaceGrotesk = Space_Grotesk({
    subsets: ["latin"],
    variable: "--font-display",
    display: "swap",
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
        <html
            lang="en"
            suppressHydrationWarning
            className={`${inter.variable} ${spaceGrotesk.variable}`}
        >
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
                <Toaster duration={5000} position="bottom-left" visibleToasts={3} />
            </body>
        </html>
    );
}
