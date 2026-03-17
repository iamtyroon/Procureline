import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpinnerProps {
    className?: string;
}

export function Spinner({ className = "h-8 w-8" }: SpinnerProps) {
    return <LoaderCircle className={cn("animate-spin text-primary", className)} />;
}
