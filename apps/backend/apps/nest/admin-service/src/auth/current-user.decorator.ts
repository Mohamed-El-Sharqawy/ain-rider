// ─── Current User Decorator ──────────────────────────────────────────────────
// Extracts the authenticated user from the request object.
// Used after AdminGuard has verified the JWT and attached the payload.

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUserPayload {
  sub: string;
  email: string;
  role: string;
  type?: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
