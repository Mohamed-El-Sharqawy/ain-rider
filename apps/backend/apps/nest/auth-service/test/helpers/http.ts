import type { NestFastifyApplication } from "@nestjs/platform-fastify";

/**
 * Injects a multipart/form-data request. Serializes the FormData via the
 * web Response/Blob APIs so each file part keeps its mimetype.
 */
export async function injectForm(
  app: NestFastifyApplication,
  method: string,
  url: string,
  form: FormData,
  headers: Record<string, string> = {},
) {
  const response = new Response(form);
  const body = Buffer.from(await response.arrayBuffer());
  return app.inject({
    method: method as any,
    url,
    payload: body,
    headers: {
      "content-type": response.headers.get("content-type")!,
      ...headers,
    },
  });
}

export function jpegBlob(size = 16): Blob {
  return new Blob([Buffer.alloc(size)], { type: "image/jpeg" });
}

let counter = 0;

/**
 * E.164 Egyptian mobile (+20 1X XXXXXXXX) satisfying the
 * ^\+20(1[0125]\d{8})$ OTP validation regex and the 8-15 length
 * constraint on RegisterDto. Suffix digits come from a random UUID so
 * parallel tests never collide.
 */
export function uniquePhone(secondDigit = "0"): string {
  counter += 1;
  const digits = (crypto.randomUUID().match(/\d/g) ?? []).join("");
  const tail = (digits + "00000000").slice(0, 8);
  return `+201${secondDigit}${tail}`;
}

export function uniqueEmail(prefix = "user"): string {
  counter += 1;
  return `${prefix}-${crypto.randomUUID()}@test.ainrider`;
}
