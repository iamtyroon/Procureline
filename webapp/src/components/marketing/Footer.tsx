import Link from "next/link";
import { MARKETING_ACCESS_CTA } from "@/lib/auth/public-entry";

interface FooterLink {
    label: string;
    href: string;
}

interface FooterColumn {
    title: string;
    links: FooterLink[];
}

const columns: FooterColumn[] = [
    {
        title: "Product",
        links: [
            { label: "Features", href: "/#features" },
            { label: "How It Works", href: "/#how-it-works" },
            { label: "Pricing", href: "/#pricing" },
            { label: "Compliance", href: "/#compliance" },
        ],
    },
    {
        title: "Company",
        links: [
            { label: "About Us", href: "#" },
            { label: "Careers", href: "#" },
            { label: "Contact", href: "mailto:support@procureline.co.ke" },
            { label: "Blog", href: "#" },
        ],
    },
    {
        title: "Resources",
        links: [
            { label: "Documentation", href: "#" },
            { label: "API Reference", href: "#" },
            { label: "GOK Templates", href: "#" },
            { label: "Help Center", href: "#" },
        ],
    },
    {
        title: "Legal",
        links: [
            { label: "Privacy Policy", href: "#" },
            { label: "Terms of Service", href: "#" },
            { label: "Data Processing", href: "#" },
            { label: "Cookie Policy", href: "#" },
        ],
    },
];

export function Footer(): JSX.Element {
    return (
        <footer
            aria-label="Site footer"
            className="border-t border-gray-200 bg-white px-6 py-16 text-gray-500 dark:bg-black dark:text-gray-400"
        >
            <div className="mx-auto max-w-7xl">
                {/* Top section */}
                <div className="mb-12 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-6">
                    {/* Brand */}
                    <div className="lg:col-span-2">
                        <div className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
                            Procure<span className="text-primary">line</span>
                        </div>
                        <p className="mb-6 max-w-xs text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                            Streamline university procurement planning with visual block-based
                            tools. GOK compliant. Excel-ready. Free forever tier available.
                        </p>
                        <Link href={MARKETING_ACCESS_CTA.href}>
                            <span className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-emerald-600">
                                {MARKETING_ACCESS_CTA.label} →
                            </span>
                        </Link>
                    </div>

                    {/* Link columns */}
                    {columns.map((column) => (
                        <div key={column.title}>
                            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-900 dark:text-gray-300">
                                {column.title}
                            </h4>
                            <ul className="space-y-3">
                                {column.links.map((link) => (
                                    <li key={link.label}>
                                        <a
                                            href={link.href}
                                            className="text-sm transition-colors hover:text-primary"
                                        >
                                            {link.label}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* Bottom section */}
                <div className="flex flex-col items-center justify-between gap-4 border-t border-gray-200 pt-8 dark:border-gray-800 md:flex-row">
                    <p className="text-sm text-gray-500">
                        © {new Date().getFullYear()} Procureline. All rights reserved.
                    </p>
                    <div className="flex items-center gap-6">
                        <a
                            href="#"
                            aria-label="Twitter"
                            className="text-gray-500 transition-colors hover:text-primary"
                        >
                            𝕏
                        </a>
                        <a
                            href="#"
                            aria-label="LinkedIn"
                            className="text-gray-500 transition-colors hover:text-primary"
                        >
                            in
                        </a>
                        <a
                            href="mailto:support@procureline.co.ke"
                            aria-label="Email"
                            className="text-gray-500 transition-colors hover:text-primary"
                        >
                            ✉
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
