import Link from "next/link";
import { ArrowLeft, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

interface TenantAdminRoutePlaceholderProps {
    description: string;
    eyebrow: string;
    title: string;
}

export function TenantAdminRoutePlaceholder({
    description,
    eyebrow,
    title,
}: TenantAdminRoutePlaceholderProps): JSX.Element {
    return (
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl items-center px-4 py-10 sm:px-6">
            <Card className="w-full rounded-[32px] border-border/70 bg-card/95 shadow-sm">
                <CardHeader className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <Badge
                            variant="outline"
                            className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200"
                        >
                            {eyebrow}
                        </Badge>
                        <Clock3 className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="space-y-2">
                        <CardTitle className="text-3xl tracking-tight text-foreground">
                            {title}
                        </CardTitle>
                        <CardDescription className="text-base leading-7 text-muted-foreground">
                            {description}
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="rounded-3xl bg-muted/40 p-6 text-sm leading-7 text-muted-foreground">
                    This route is intentionally stable under the `/tenant-admin/...` namespace so
                    follow-on stories can extend the same information architecture without
                    changing navigation or access-control behavior.
                </CardContent>
                <CardFooter className="pt-6">
                    <Button asChild variant="outline" className="rounded-full">
                        <Link href="/tenant-admin">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to dashboard
                        </Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
