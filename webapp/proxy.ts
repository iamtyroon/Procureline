import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { PUBLIC_ROUTES } from "@/lib/auth/public-routes";

const isPublicRoute = createRouteMatcher([...PUBLIC_ROUTES]);

const proxy = convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    if (isPublicRoute(request)) {
      return;
    }

    if (!(await convexAuth.isAuthenticated())) {
      return nextjsMiddlewareRedirect(request, "/login?reason=session_expired");
    }
  },
);

export default proxy;
export { proxy };
export { isPublicRoute };

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
