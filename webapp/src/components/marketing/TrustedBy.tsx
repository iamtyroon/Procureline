import type { LucideIcon } from "lucide-react";
import { Building2, GraduationCap, Landmark } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const institutions: Array<{
    icon: LucideIcon;
    name: string;
}> = [
    { icon: Landmark, name: "University of Nairobi" },
    { icon: GraduationCap, name: "Kenyatta University" },
    { icon: Building2, name: "JKUAT" },
    { icon: Landmark, name: "Moi University" },
    { icon: GraduationCap, name: "Pwani University" },
];

export function TrustedBy(): JSX.Element {
    return (
        <section
            aria-label="Trusted by leading institutions"
            className="border-y border-border/60 bg-muted/30 px-6 py-12"
        >
            <div className="mx-auto max-w-7xl">
                <div className="mb-6 flex justify-center">
                    <Badge
                        variant="outline"
                        className="rounded-full border-border/70 bg-background/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground"
                    >
                        Trusted by leading Kenyan institutions
                    </Badge>
                </div>

                <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
                    {institutions.map((institution) => {
                        const Icon = institution.icon;

                        return (
                            <Card
                                key={institution.name}
                                className="border-border/60 bg-card/80 shadow-sm"
                            >
                                <CardContent className="flex items-center gap-3 p-4">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <span className="text-sm font-medium text-foreground">
                                        {institution.name}
                                    </span>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
