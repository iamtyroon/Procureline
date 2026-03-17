"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Landmark, Menu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { MARKETING_ACCESS_CTA } from "@/lib/auth/public-entry";
import { cn } from "@/lib/utils";
import { ModeToggle } from "@/src/components/mode-toggle";

const navLinks = [
    { href: "/#features", label: "Features" },
    { href: "/#how-it-works", label: "How It Works" },
    { href: "/#pricing", label: "Pricing" },
    { href: "/#compliance", label: "Compliance" },
] as const;

export function Navbar(): JSX.Element {
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = (): void => {
            setIsScrolled(window.scrollY > 10);
        };

        handleScroll();
        window.addEventListener("scroll", handleScroll, { passive: true });

        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <nav
            aria-label="Main navigation"
            className={cn(
                "fixed inset-x-0 top-0 z-50 transition-all duration-300",
                isScrolled
                    ? "border-b border-border/60 bg-background/88 shadow-sm backdrop-blur-xl"
                    : "bg-transparent",
            )}
        >
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
                <div className="flex items-center gap-4">
                    <Link
                        href="/"
                        className="text-2xl font-semibold tracking-tight text-foreground transition-colors hover:text-primary"
                    >
                        Procure<span className="text-primary">line</span>
                    </Link>
                    <Badge
                        variant="outline"
                        className="hidden gap-2 rounded-full border-primary/15 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground lg:inline-flex"
                    >
                        <Landmark className="h-3.5 w-3.5 text-primary" />
                        University procurement OS
                    </Badge>
                </div>

                <ul className="hidden items-center gap-8 md:flex">
                    {navLinks.map((link) => (
                        <li key={link.href}>
                            <a
                                href={link.href}
                                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                            >
                                {link.label}
                            </a>
                        </li>
                    ))}
                </ul>

                <div className="hidden items-center gap-3 md:flex">
                    <Button asChild variant="ghost" size="sm">
                        <Link href={MARKETING_ACCESS_CTA.href}>
                            {MARKETING_ACCESS_CTA.label}
                        </Link>
                    </Button>
                    <Button asChild size="sm" className="gap-2">
                        <Link href="/signup">
                            Register university
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </Button>
                    <ModeToggle />
                </div>

                <div className="flex items-center gap-2 md:hidden">
                    <ModeToggle />
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="outline" size="icon" aria-label="Open navigation menu">
                                <Menu className="h-5 w-5" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent
                            side="right"
                            className="w-full max-w-xs border-l border-border/60 bg-background/95"
                        >
                            <SheetHeader className="border-b border-border/60 pb-4 text-left">
                                <SheetTitle className="text-left">
                                    Procure<span className="text-primary">line</span>
                                </SheetTitle>
                            </SheetHeader>

                            <div className="mt-8 flex flex-col gap-6">
                                <div className="space-y-2">
                                    {navLinks.map((link) => (
                                        <SheetClose asChild key={link.href}>
                                            <a
                                                href={link.href}
                                                className="flex items-center justify-between rounded-xl border border-border/60 bg-card px-4 py-3 text-sm font-medium text-foreground transition-colors hover:border-primary/30 hover:text-primary"
                                            >
                                                {link.label}
                                                <ArrowRight className="h-4 w-4" />
                                            </a>
                                        </SheetClose>
                                    ))}
                                </div>

                                <div className="space-y-3">
                                    <SheetClose asChild>
                                        <Button asChild variant="outline" className="w-full justify-between">
                                            <Link href={MARKETING_ACCESS_CTA.href}>
                                                {MARKETING_ACCESS_CTA.label}
                                                <ArrowRight className="h-4 w-4" />
                                            </Link>
                                        </Button>
                                    </SheetClose>
                                    <SheetClose asChild>
                                        <Button asChild className="w-full justify-between">
                                            <Link href="/signup">
                                                Register university
                                                <ArrowRight className="h-4 w-4" />
                                            </Link>
                                        </Button>
                                    </SheetClose>
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </nav>
    );
}
