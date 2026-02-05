import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Convex Auth handles authentication automatically via ConvexAuthNextjsProvider
  // Route protection will be added in Story 1.2-1.8 based on role requirements
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
