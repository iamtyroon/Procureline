"use client";

interface RoleDashboardPlaceholderProps {
    title: string;
    description: string;
}

export function RoleDashboardPlaceholder({
    title,
    description,
}: RoleDashboardPlaceholderProps) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="inline-flex items-center rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
                Procureline Workspace
            </div>
            <h1 className="text-3xl font-bold text-primary">{title}</h1>
            <p className="max-w-xl text-sm text-muted-foreground">{description}</p>
        </div>
    );
}
