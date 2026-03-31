import { Elysia } from "elysia";
import { cookie } from "@elysiajs/cookie";
import { jwt } from "@elysiajs/jwt";
import { UnauthorizedError } from "@ain-rider/error-handling";

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

export const authGuard = new Elysia({ name: "Auth.Guard" })
  .use(
    jwt({
      name: "jwt",
      secret: process.env.JWT_SECRET || "change-me-in-production",
    }),
  )
  .use(cookie())
  .derive({ as: "scoped" }, async (ctx) => {
    const { cookie: cookies, jwt, request } = ctx;

    // Resolve token: Bearer header first, then cookie fallback
    const authHeader = request.headers.get("authorization");
    let token: string | undefined;
    let tokenSource = "none";

    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
      tokenSource = "bearer";
    } else if (cookies.accessToken?.value) {
      token = cookies.accessToken.value as string;
      tokenSource = "cookie";
    }

    console.log("[AuthGuard] Token resolution:", {
      source: tokenSource,
      hasToken: !!token,
      tokenPreview: token ? token.substring(0, 20) + "..." : "none",
    });

    if (!token) {
      throw new UnauthorizedError("Not authenticated - no access token");
    }

    try {
      const payload = (await jwt.verify(
        token as string,
      )) as unknown as JwtPayload | false;

      if (!payload) {
        console.error("[AuthGuard] JWT verification failed (signature or expiry)");
        throw new UnauthorizedError("Invalid or expired access token");
      }

      return {
        accessToken: token,
        user: {
          id: payload.sub,
          email: payload.email,
          role: payload.role,
        },
      };
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
      console.error("[AuthGuard] Unexpected error during verification:", err);
      throw new UnauthorizedError("Authentication failed");
    }
  });
