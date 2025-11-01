import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { NextResponse } from "next/server";

// Create the next-intl middleware
const intlMiddleware = createMiddleware(routing);

export default function middleware(request) {
  const { pathname } = request.nextUrl;

  // Check if this is a protected route (verifiers page but not login)
  const isProtectedRoute =
    pathname.includes("/verifiers") && !pathname.includes("/verifiersLogin");

  if (isProtectedRoute) {
    // Check for Firebase auth state in localStorage (client-side only)
    // Since middleware runs server-side, we'll redirect and let client handle auth check

    // For now, let the request through and handle auth on client-side
    // The verifiers page will check auth and redirect if needed
    const response = intlMiddleware(request);
    return response;
  }

  // Apply internationalization middleware for all other routes
  return intlMiddleware(request);
}

export const config = {
  // Match all pathnames except for
  // - … if they start with `/api`, `/trpc`, `/_next` or `/_vercel`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
