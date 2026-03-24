import { t, type Static } from 'elysia';

export const AuthModel = {
  loginBody: t.Object({
    email: t.String({ format: 'email' }),
    password: t.String({ minLength: 6 }),
  }),
  registerBody: t.Object({
    email: t.String({ format: 'email' }),
    password: t.String({ minLength: 6 }),
    firstName: t.String(),
    lastName: t.String(),
    phoneNumber: t.String(),
    role: t.Union([t.Literal('RIDER'), t.Literal('DRIVER'), t.Literal('ADMIN'), t.Literal('SUPPORT')]),
  }),
  refreshBody: t.Object({
    refreshToken: t.String(),
  }),
  tokenResponse: t.Object({
    accessToken: t.String(),
    refreshToken: t.String(),
    expiresIn: t.Number(),
  }),
} as const;

export type LoginBody = Static<typeof AuthModel.loginBody>;
export type RegisterBody = Static<typeof AuthModel.registerBody>;
