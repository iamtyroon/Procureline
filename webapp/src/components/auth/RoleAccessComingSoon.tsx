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

interface RoleAccessComingSoonProps {
    backHref: string;
    details: string;
    hint: string;
    title: string;
}

export function RoleAccessComingSoon({
    backHref,
    details,
    hint,
    title,
}: RoleAccessComingSoonProps): JSX.Element {
    return (
        <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-50 via-white to-gray-50 px-6 py-24 text-foreground dark:from-gray-950 dark:via-slate-950 dark:to-black">
            <div className="w-full max-w-xl">
                <Card className="border-border/60 shadow-xl">
                    <CardHeader className="space-y-4 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <Clock3 className="h-7 w-7" />
                        </div>
                        <div className="space-y-3">
                            <Badge
                                variant="outline"
                                className="rounded-full border-primary/25 text-primary"
                            >
                                Coming soon
                            </Badge>
                            <CardTitle className="text-3xl tracking-tight">
                                {title}
                            </CardTitle>
                            <CardDescription className="text-base leading-7">
                                This role-specific sign-in page is reserved now so we can slot in
                                the real authentication form here later without changing the public
                                access model.
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="rounded-2xl border border-border/60 bg-muted/30 p-5 text-sm leading-6 text-muted-foreground">
                            {details}
                        </div>
                        <div className="rounded-2xl border border-primary/15 bg-primary/5 p-5 text-sm leading-6 text-muted-foreground">
                            {hint}
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-3 sm:flex-row">
                        <Button disabled className="w-full sm:flex-1">
                            Sign in coming soon
                        </Button>
                        <Button asChild variant="outline" className="w-full sm:flex-1">
                            <Link href={backHref}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to access paths
                            </Link>
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </main>
    );
}
