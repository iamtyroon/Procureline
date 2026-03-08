import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
} from "@convex-dev/auth/nextjs/server";
import { PUBLIC_ROUTES } from "@/lib/auth/public-routes";
import {
  PROTECTED_ROUTE_CACHE_HEADERS,
  SESSION_EXPIRED_REDIRECT_PATH,
} from "@/lib/auth/proxy";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([...PUBLIC_ROUTES]);

const proxy = convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    if (isPublicRoute(request)) {
      return;
    }

    if (!(await convexAuth.isAuthenticated())) {
      return NextResponse.redirect(
        new URL(SESSION_EXPIRED_REDIRECT_PATH, request.url),
      );
    }

    const response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    for (const [headerName, headerValue] of Object.entries(
      PROTECTED_ROUTE_CACHE_HEADERS,
    )) {
      response.headers.set(headerName, headerValue);
    }

    return response;
  },
);

export default proxy;
export { proxy };
export { isPublicRoute };

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
