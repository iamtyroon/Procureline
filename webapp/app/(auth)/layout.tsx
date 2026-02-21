import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Sign Up — Procureline",
    description:
        "Create your free Procureline account to start managing university procurement planning.",
};

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
            <div className="w-full max-w-md">{children}</div>
        </div>
    );
}
