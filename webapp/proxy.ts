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

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
