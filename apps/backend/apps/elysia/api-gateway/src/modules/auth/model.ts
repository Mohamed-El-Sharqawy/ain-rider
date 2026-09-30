import { t, type Static } from 'elysia';

/** Egyptian mobile in E.164 format: +20 followed by 10 digits starting with 010/011/012/015. */
const egyptPhone = t.RegExp(/^\+201[0125]\d{8}$/, {
  description: 'Egyptian mobile number in +20 format, e.g. +201001234567',
});

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
    phoneNumber: egyptPhone,
    role: t.Union([t.Literal('RIDER'), t.Literal('DRIVER')]),
  }),
  adminCreateUserBody: t.Object({
    email: t.String({ format: 'email' }),
    password: t.String({ minLength: 6 }),
    firstName: t.String(),
    lastName: t.String(),
    phoneNumber: egyptPhone,
    role: t.Union([t.Literal('RIDER'), t.Literal('DRIVER'), t.Literal('SUPPORT'), t.Literal('ADMIN')]),
  }),
  refreshBody: t.Object({
    refreshToken: t.String(),
  }),
  requestOtpBody: t.Object({
    phone: egyptPhone,
  }),
  verifyOtpBody: t.Object({
    phone: egyptPhone,
    code: t.String({ minLength: 6, maxLength: 6 }),
  }),
  tokenResponse: t.Object({
    accessToken: t.String(),
    refreshToken: t.String(),
    expiresIn: t.Number(),
  }),
} as const;

export type LoginBody = Static<typeof AuthModel.loginBody>;
export type RegisterBody = Static<typeof AuthModel.registerBody>;
