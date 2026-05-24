import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";

function getConvexHttpClient(): ConvexHttpClient {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
        throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured");
    }

    return new ConvexHttpClient(convexUrl);
}

export async function GET(
    _request: Request,
    context: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
    const { token } = await context.params;
    try {
        const result = await getConvexHttpClient().mutation(
            api.functions.tenantAdminReports.resolveTenantAdminReportShareLink,
            { token },
        );

        return NextResponse.redirect(result.downloadUrl, { status: 302 });
    } catch {
        return new NextResponse("This report link is expired or unavailable.", {
            status: 410,
        });
    }
}
