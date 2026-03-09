import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();

// Story 1.9 scope note: the current password-based auth setup only exposes
// Convex's well-known metadata routes here. Shared origin policy logic lives in
// `lib/security/origins.ts` for app-owned HTTP surfaces that require it.
auth.addHttpRoutes(http);

export default http;
