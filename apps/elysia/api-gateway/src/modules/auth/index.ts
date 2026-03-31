import { Elysia, status, t } from "elysia";
import { rateLimit } from "elysia-rate-limit";
import { AuthProxyService } from "./service";
import { AuthModel } from "./model";

const isProduction = process.env.NODE_ENV === "production";
const ACCESS_TOKEN_MAX_AGE = 15 * 60;
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60;
const SAME_SITE = isProduction ? "strict" : "lax";

const isMobileClient = (headers: Headers): boolean => {
  return headers.get("x-client-type") === "mobile";
};

export const auth = new Elysia({ prefix: "/auth" })
  .onRequest(({ request }) => {
    console.log(`[Gateway] [${request.method}] ${request.url}`);
  })
  .post(
    "/login",
    async ({ body, set, request }) => {
      const res = await AuthProxyService.login(body);

      if (!res.ok) {
        try {
          const errorBody = await res.json();
          set.status = res.status;
          return errorBody;
        } catch {
          set.status = res.status;
          return {
            success: false,
            error: {
              code: "INTERNAL_ERROR",
              message: "Failed to parse error response",
            },
          };
        }
      }

      const data = (await res.json()) as {
        user: unknown;
        accessToken: string;
        refreshToken: string;
      };

      // ✅ THIS is the important fix
      set.cookie = {
        accessToken: {
          value: data.accessToken,
          httpOnly: true,
          secure: isProduction,
          sameSite: SAME_SITE, // "lax" in dev
          maxAge: ACCESS_TOKEN_MAX_AGE,
          path: "/",
        },
        refreshToken: {
          value: data.refreshToken,
          httpOnly: true,
          secure: isProduction,
          sameSite: SAME_SITE,
          maxAge: REFRESH_TOKEN_MAX_AGE,
          path: "/",
        },
      };

      const responseBody: Record<string, unknown> = {
        user: data.user,
        success: true,
      };

      // Mobile clients need tokens in body
      if (isMobileClient(request.headers)) {
        responseBody.accessToken = data.accessToken;
        responseBody.refreshToken = data.refreshToken;
      }

      return responseBody;
    },
    { body: AuthModel.loginBody },
  )
  .post(
    "/register",
    async ({ body, set, request }) => {
      const res = await AuthProxyService.register(body);

      if (!res.ok) {
        try {
          const errorBody = await res.json();
          set.status = res.status;
          return errorBody;
        } catch {
          set.status = res.status;
          return {
            success: false,
            error: {
              code: "INTERNAL_ERROR",
              message: "Failed to parse error response",
            },
          };
        }
      }

      const data = (await res.json()) as {
        user: unknown;
        accessToken: string;
        refreshToken: string;
      };

      // ✅ FIX: set cookies properly
      set.cookie = {
        accessToken: {
          value: data.accessToken,
          httpOnly: true,
          secure: isProduction,
          sameSite: SAME_SITE,
          maxAge: ACCESS_TOKEN_MAX_AGE,
          path: "/",
        },
        refreshToken: {
          value: data.refreshToken,
          httpOnly: true,
          secure: isProduction,
          sameSite: SAME_SITE,
          maxAge: REFRESH_TOKEN_MAX_AGE,
          path: "/",
        },
      };

      const responseBody: Record<string, unknown> = {
        user: data.user,
        success: true,
      };

      if (isMobileClient(request.headers)) {
        responseBody.accessToken = data.accessToken;
        responseBody.refreshToken = data.refreshToken;
      }

      return responseBody;
    },
    { body: AuthModel.registerBody },
  )
  .post(
    "/refresh",
    async ({ cookie, set, request }) => {
      const authHeader = request.headers.get("authorization");
      let token: string;

      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.slice(7);
      } else if (cookie.refreshToken?.value) {
        token = cookie.refreshToken.value as string;
      } else {
        throw status(401, "No refresh token");
      }

      const res = await AuthProxyService.refresh(token);

      if (!res.ok) {
        // ✅ Properly clear cookies
        set.cookie = {
          accessToken: {
            value: "",
            path: "/",
            maxAge: 0,
          },
          refreshToken: {
            value: "",
            path: "/",
            maxAge: 0,
          },
        };

        set.status = res.status;
        return await res.text();
      }

      const data = (await res.json()) as {
        accessToken: string;
        refreshToken?: string;
      };

      // ✅ FIX: use set.cookie
      set.cookie = {
        accessToken: {
          value: data.accessToken,
          httpOnly: true,
          secure: isProduction,
          sameSite: SAME_SITE, // ✅ FIXED (no more "strict")
          maxAge: ACCESS_TOKEN_MAX_AGE,
          path: "/",
        },
        ...(data.refreshToken && {
          refreshToken: {
            value: data.refreshToken,
            httpOnly: true,
            secure: isProduction,
            sameSite: SAME_SITE,
            maxAge: REFRESH_TOKEN_MAX_AGE,
            path: "/",
          },
        }),
      };

      const responseBody: Record<string, unknown> = {
        success: true,
      };

      if (isMobileClient(request.headers)) {
        responseBody.accessToken = data.accessToken;
        if (data.refreshToken) {
          responseBody.refreshToken = data.refreshToken;
        }
      }

      return responseBody;
    },
    {
      body: t.Optional(t.Any()),
    }
  )
  .post("/logout", async ({ set }) => {
    set.cookie = {
      accessToken: {
        value: "",
        path: "/",
        maxAge: 0,
      },
      refreshToken: {
        value: "",
        path: "/",
        maxAge: 0,
      },
    };

    return { success: true };
  })
  .get("/me", async ({ cookie: { accessToken }, request, set }) => {
    // Resolve token: Bearer header first, then cookie fallback
    const authHeader = request.headers.get("authorization");
    let token: string | undefined;

    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    } else if (accessToken?.value) {
      token = accessToken.value as string;
    }

    if (!token) {
      throw status(401, "Not authenticated");
    }

    const res = await AuthProxyService.getMe(token);
    if (!res.ok) {
      try {
        const errorBody = await res.json();
        set.status = res.status;
        return errorBody;
      } catch {
        set.status = res.status;
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to parse error response",
          },
        };
      }
    }

    return res.json();
  })
  .post(
    "/admin/create-user",
    async ({ body, cookie: { accessToken }, set }) => {
      if (!accessToken.value) {
        throw status(401, "Not authenticated");
      }

      const res = await AuthProxyService.adminCreateUser(
        accessToken.value as string,
        body,
      );
      if (!res.ok) {
        try {
          const errorBody = await res.json();
          set.status = res.status;
          return errorBody;
        } catch {
          set.status = res.status;
          return {
            success: false,
            error: {
              code: "INTERNAL_ERROR",
              message: "Failed to parse error response",
            },
          };
        }
      }

      return res.json();
    },
    { body: AuthModel.adminCreateUserBody },
  )
  // FIXED: Scoped OTP rate limit with an empty prefix group to keep the original endpoints /auth/request-otp, etc.
  .group("", (app) =>
    app
      .use(rateLimit({
        duration: 60_000,
        max: 15,
        generator: (req) =>
          req.headers.get("x-forwarded-for") ||
          req.headers.get("x-real-ip") ||
          "anonymous",
      }))
      .post(
        "/request-otp",
        async ({ body, set }) => {
          const res = await AuthProxyService.requestOtp(body);
          if (!res.ok) {
            try {
              const errorBody = await res.json();
              set.status = res.status;
              return errorBody;
            } catch {
              set.status = res.status;
              return {
                success: false,
                error: {
                  code: "INTERNAL_ERROR",
                  message: "Failed to parse error response",
                },
              };
            }
          }
          return res.json();
        },
        { body: AuthModel.requestOtpBody },
      )
      .post(
        "/verify-otp",
        async ({ body, set }) => {
          const res = await AuthProxyService.verifyOtp(body);
          if (!res.ok) {
            try {
              const errorBody = await res.json();
              set.status = res.status;
              return errorBody;
            } catch {
              set.status = res.status;
              return {
                success: false,
                error: {
                  code: "INTERNAL_ERROR",
                  message: "Failed to parse error response",
                },
              };
            }
          }

          return res.json();
        },
        { body: AuthModel.verifyOtpBody },
      )
  )
  .post(
    "/rider/documents/identity",
    async ({ request, set }) => {
      const authHeader = request.headers.get("authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        throw status(401, "Not authenticated");
      }
      const token = authHeader.slice(7);

      // Forward raw request with body
      const contentType = request.headers.get("content-type");
      const body = await request.arrayBuffer();
      
      console.log(`[Gateway] Forwarding identity upload, Content-Type: ${contentType}, Body size: ${body.byteLength}`);
      
      const res = await fetch(`${process.env.AUTH_SERVICE_URL || 'http://localhost:4000'}/auth/rider/documents/identity`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': contentType || 'multipart/form-data',
        },
        body: body,
      });
      
      console.log(`[Gateway] Auth service response: ${res.status}`);
      
      if (!res.ok) {
        try {
          const errorBody = await res.json();
          set.status = res.status;
          return errorBody;
        } catch {
          set.status = res.status;
          return {
            success: false,
            error: {
              code: "INTERNAL_ERROR",
              message: "Failed to parse error response",
            },
          };
        }
      }

      return res.json();
    }
  )
  .patch(
    "/rider/profile/image",
    async ({ request, set }) => {
      const authHeader = request.headers.get("authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        throw status(401, "Not authenticated");
      }
      const token = authHeader.slice(7);

      // Forward raw request with body
      const contentType = request.headers.get("content-type");
      const body = await request.arrayBuffer();
      
      console.log(`[Gateway] Forwarding profile image upload, Content-Type: ${contentType}, Body size: ${body.byteLength}`);
      
      const res = await fetch(`${process.env.AUTH_SERVICE_URL || 'http://localhost:4000'}/auth/rider/profile/image`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': contentType || 'multipart/form-data',
        },
        body: body,
      });
      
      console.log(`[Gateway] Auth service response: ${res.status}`);
      
      if (!res.ok) {
        try {
          const errorBody = await res.json();
          set.status = res.status;
          return errorBody;
        } catch {
          set.status = res.status;
          return {
            success: false,
            error: {
              code: "INTERNAL_ERROR",
              message: "Failed to parse error response",
            },
          };
        }
      }

      return res.json();
    }
  )
  // Driver routes
  .get(
    "/driver/onboarding-status",
    async ({ request, set }) => {
      const authHeader = request.headers.get("authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        throw status(401, "Not authenticated");
      }
      const token = authHeader.slice(7);

      const res = await AuthProxyService.proxyDriverGet(token, "onboarding-status");
      console.log('[Gateway] Driver onboarding-status proxy:', res.status);

      if (!res.ok) {
        try {
          const errorBody = await res.json();
          set.status = res.status;
          return errorBody;
        } catch {
          set.status = res.status;
          return {
            success: false,
            error: {
              code: "INTERNAL_ERROR",
              message: "Failed to parse error response",
            },
          };
        }
      }

      return res.json();
    }
  )
  .patch(
    "/driver/profile",
    async ({ request, set }) => {
      const authHeader = request.headers.get("authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        throw status(401, "Not authenticated");
      }
      const token = authHeader.slice(7);

      const body = await request.json();
      const res = await AuthProxyService.proxyDriverPatch(token, "profile", body);

      if (!res.ok) {
        try {
          const errorBody = await res.json();
          set.status = res.status;
          return errorBody;
        } catch {
          set.status = res.status;
          return {
            success: false,
            error: {
              code: "INTERNAL_ERROR",
              message: "Failed to parse error response",
            },
          };
        }
      }

      return res.json();
    }
  )
  .patch(
    "/driver/status",
    async ({ request, set }) => {
      const authHeader = request.headers.get("authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        throw status(401, "Not authenticated");
      }
      const token = authHeader.slice(7);

      const body = await request.json();
      const res = await AuthProxyService.proxyDriverPatch(token, "status", body);

      if (!res.ok) {
        try {
          const errorBody = await res.json();
          set.status = res.status;
          return errorBody;
        } catch {
          set.status = res.status;
          return {
            success: false,
            error: {
              code: "INTERNAL_ERROR",
              message: "Failed to parse error response",
            },
          };
        }
      }

      return res.json();
    }
  )
  .post(
    "/driver/documents/identity",
    async ({ request, set }) => {
      const authHeader = request.headers.get("authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        throw status(401, "Not authenticated");
      }
      const token = authHeader.slice(7);

      const contentLength = parseInt(request.headers.get("content-length") || "0");
      if (contentLength > 10 * 1024 * 1024) {
        throw status(413, "Request too large. Maximum total size is 10MB");
      }

      const rawBody = await request.arrayBuffer();
      const contentType = request.headers.get("content-type");

      console.log('[Gateway] Forwarding driver identity upload, Content-Type:', contentType, 'Body size:', rawBody.byteLength);

      const res = await AuthProxyService.proxyDriverMultipart(token, "documents/identity", contentType || 'multipart/form-data', rawBody);

      if (!res.ok) {
        try {
          const errorBody = await res.json();
          set.status = res.status;
          return errorBody;
        } catch {
          set.status = res.status;
          return {
            success: false,
            error: {
              code: "INTERNAL_ERROR",
              message: "Failed to parse error response",
            },
          };
        }
      }

      return res.json();
    }
  )
  .post(
    "/driver/documents/driving-license",
    async ({ request, set }) => {
      const authHeader = request.headers.get("authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        throw status(401, "Not authenticated");
      }
      const token = authHeader.slice(7);

      const contentLength = parseInt(request.headers.get("content-length") || "0");
      if (contentLength > 10 * 1024 * 1024) {
        throw status(413, "Request too large. Maximum total size is 10MB");
      }

      const rawBody = await request.arrayBuffer();
      const contentType = request.headers.get("content-type");

      console.log('[Gateway] Forwarding driver driving-license upload, Content-Type:', contentType, 'Body size:', rawBody.byteLength);

      const res = await AuthProxyService.proxyDriverMultipart(token, "documents/driving-license", contentType || 'multipart/form-data', rawBody);

      if (!res.ok) {
        try {
          const errorBody = await res.json();
          set.status = res.status;
          return errorBody;
        } catch {
          set.status = res.status;
          return {
            success: false,
            error: {
              code: "INTERNAL_ERROR",
              message: "Failed to parse error response",
            },
          };
        }
      }

      return res.json();
    }
  )
  .post(
    "/driver/vehicle",
    async ({ request, set }) => {
      const authHeader = request.headers.get("authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        throw status(401, "Not authenticated");
      }
      const token = authHeader.slice(7);

      const contentLength = parseInt(request.headers.get("content-length") || "0");
      if (contentLength > 10 * 1024 * 1024) {
        throw status(413, "Request too large. Maximum total size is 10MB");
      }

      const rawBody = await request.arrayBuffer();
      const contentType = request.headers.get("content-type");

      console.log('[Gateway] Forwarding driver vehicle registration, Content-Type:', contentType, 'Body size:', rawBody.byteLength);

      const res = await AuthProxyService.proxyDriverMultipart(token, "vehicle", contentType || 'multipart/form-data', rawBody);

      if (!res.ok) {
        try {
          const errorBody = await res.json();
          set.status = res.status;
          return errorBody;
        } catch {
          set.status = res.status;
          return {
            success: false,
            error: {
              code: "INTERNAL_ERROR",
              message: "Failed to parse error response",
            },
          };
        }
      }

      return res.json();
    }
  );
