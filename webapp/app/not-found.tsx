import Link from "next/link";

export default function NotFound(): JSX.Element {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
            <h1 className="mb-4 text-6xl font-bold text-gray-900">404</h1>
            <p className="mb-8 text-lg text-gray-600">
                The page you&apos;re looking for doesn&apos;t exist.
            </p>
            <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-emerald-600"
            >
                ← Back to Home
            </Link>
        </div>
    );
}
