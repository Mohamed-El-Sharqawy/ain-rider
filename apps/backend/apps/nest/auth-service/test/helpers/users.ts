import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { uniqueEmail, uniquePhone } from "./http";

export interface TestUser {
  id?: string;
  email: string;
  phone: string;
  password: string;
  firstName: string;
  lastName: string;
  accessToken: string;
  refreshToken: string;
}

interface RegisterOverrides {
  email?: string;
  phone?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Registers a user via POST /auth/register with a unique email/phone and
 * returns the credentials plus both tokens.
 */
export async function registerUser(
  app: NestFastifyApplication,
  role: "RIDER" | "DRIVER",
  phone?: string,
  overrides: RegisterOverrides = {},
): Promise<TestUser> {
  const credentials = {
    email: overrides.email ?? uniqueEmail(role.toLowerCase()),
    phoneNumber: phone ?? overrides.phone ?? uniquePhone(),
    password: overrides.password ?? "S3cure-pass!",
    firstName: overrides.firstName ?? "Test",
    lastName: overrides.lastName ?? role.toLowerCase(),
    role,
  };

  const res = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: credentials,
  });
  if (res.statusCode !== 201) {
    throw new Error(`registerUser failed (${res.statusCode}): ${res.body}`);
  }

  const body = res.json();
  return {
    id: body.user.id,
    email: credentials.email,
    phone: credentials.phoneNumber,
    password: credentials.password,
    firstName: credentials.firstName,
    lastName: credentials.lastName,
    accessToken: body.accessToken,
    refreshToken: body.refreshToken,
  };
}
