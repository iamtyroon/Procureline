import { notFound } from "next/navigation";
import { resolveEmailTransportMode } from "@/lib/email/transport";
import { DevEmailInbox } from "@/src/components/dev/DevEmailInbox";

export default function DevEmailInboxPage(): JSX.Element {
    const transportMode = resolveEmailTransportMode(process.env.AUTH_EMAIL_TRANSPORT);
    const isDevViewerEnabled =
        process.env.NODE_ENV !== "production" && transportMode === "dev_inbox";

    if (!isDevViewerEnabled) {
        notFound();
    }

    return <DevEmailInbox />;
}
