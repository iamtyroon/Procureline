"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MARKETING_ACCESS_CTA } from "@/lib/auth/public-entry";
import { cn } from "@/lib/utils";
import { ModeToggle } from "@/src/components/mode-toggle";

const navLinks = [
    { href: "/#features", label: "Features" },
    { href: "/#how-it-works", label: "How It Works" },
    { href: "/#pricing", label: "Pricing" },
    { href: "/#compliance", label: "Compliance" },
];

export function Navbar(): JSX.Element {
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);

    // Handle scroll-driven background change
    useEffect(() => {
        const handleScroll = (): void => {
            setIsScrolled(window.scrollY > 10);
        };
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // Close mobile menu when a link is clicked
    const handleNavClick = (): void => {
        setIsMobileOpen(false);
    };

    return (
        <nav
            aria-label="Main navigation"
            className={cn(
                "fixed left-0 right-0 top-0 z-50 transition-all duration-300",
                isScrolled
                    ? "bg-white/95 shadow-sm backdrop-blur-sm dark:border-b dark:border-border dark:bg-gray-900/95"
                    : "bg-transparent",
            )}
        >
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
                {/* Brand */}
                <Link
                    href="/"
                    className="text-2xl font-bold text-foreground transition-colors hover:text-primary"
                >
                    Procure<span className="text-primary">line</span>
                </Link>

                {/* Desktop nav links */}
                <ul className="hidden items-center gap-8 md:flex">
                    {navLinks.map((link) => (
                        <li key={link.href}>
                            <a
                                href={link.href}
                                className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                            >
                                {link.label}
                            </a>
                        </li>
                    ))}
                </ul>

                {/* Desktop actions */}
                <div className="hidden items-center gap-3 md:flex">
                    <Button asChild variant="ghost" size="sm" className="text-sm">
                        <Link href={MARKETING_ACCESS_CTA.href}>
                            {MARKETING_ACCESS_CTA.label}
                        </Link>
                    </Button>
                    <Button
                        asChild
                        size="sm"
                        className="bg-primary text-sm text-primary-foreground shadow-md hover:bg-primary/90"
                    >
                        <Link href="/signup">Register University</Link>
                    </Button>
                    <ModeToggle />
                </div>

                {/* Mobile menu button */}
                <button
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted md:hidden"
                    onClick={() => setIsMobileOpen(!isMobileOpen)}
                    aria-label={isMobileOpen ? "Close navigation menu" : "Open navigation menu"}
                    aria-expanded={isMobileOpen}
                >
                    <span className="text-xl">{isMobileOpen ? "x" : "="}</span>
                </button>
            </div>

            {/* Mobile navigation */}
            {isMobileOpen && (
                <div className="border-b border-gray-200 bg-white px-6 py-6 shadow-lg dark:border-border dark:bg-background md:hidden">
                    <ul className="mb-6 space-y-2">
                        {navLinks.map((link) => (
                            <li key={link.href}>
                                <a
                                    href={link.href}
                                    onClick={handleNavClick}
                                    className="block rounded-lg px-4 py-3 text-base font-medium text-foreground transition-colors hover:bg-muted hover:text-primary"
                                >
                                    {link.label}
                                </a>
                            </li>
                        ))}
                    </ul>
                    <div className="flex flex-col gap-3">
                        <Button asChild variant="outline" className="w-full">
                            <Link
                                href={MARKETING_ACCESS_CTA.href}
                                onClick={handleNavClick}
                            >
                                {MARKETING_ACCESS_CTA.label}
                            </Link>
                        </Button>
                        <Button
                            asChild
                            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            <Link href="/signup" onClick={handleNavClick}>
                                Register University
                            </Link>
                        </Button>
                        <div className="flex justify-center pt-2">
                            <ModeToggle />
                        </div>
                    </div>
                </div>
            )}
        </nav>
    );
}
