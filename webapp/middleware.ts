import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/signup",
  "/login",
  "/pricing",
]);

export default convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    // Public routes are always accessible
    if (isPublicRoute(request)) {
      return;
    }

    // Protected routes require authentication
    if (!(await convexAuth.isAuthenticated())) {
      // Return them to login if session expires or they attempt to access protected route
      return nextjsMiddlewareRedirect(request, "/login?reason=session_expired");
    }
  },
);

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
