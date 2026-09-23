import "server-only";
import { NextRequest } from "next/server";
import { db } from "./db";
import { digest, HttpError } from "./auth";
export function checkOrigin(request: NextRequest) {
  const expected = new URL(process.env.APP_URL || "http://127.0.0.1:3000")
    .origin;
  if (request.headers.get("origin") !== expected)
    throw new HttpError(403, "Origem da requisição não autorizada.");
}
export async function readBody(request: NextRequest, limit = 256_000) {
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Corpo vazio.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new HttpError(413, "Arquivo ou conteúdo muito grande.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export async function jsonBody(request: NextRequest) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "Envie JSON.");
  try {
    return JSON.parse((await readBody(request)).toString("utf8"));
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, "JSON inválido.");
  }
}
export function clientKey(request: NextRequest) {
  return process.env.TRUST_PROXY === "true"
    ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    : "local";
}
export async function rateLimit(
  key: string,
  max: number,
  windowMs = 15 * 60 * 1000,
) {
  const now = Date.now();
  const bucket = Math.floor(now / windowMs);
  const row = await db.rateLimit.upsert({
    where: { key: digest(`${key}:${bucket}`) },
    create: {
      key: digest(`${key}:${bucket}`),
      count: 1,
      expiresAt: new Date((bucket + 1) * windowMs),
    },
    update: { count: { increment: 1 } },
  });
  if (row.count > max)
    throw new HttpError(429, "Muitas tentativas. Aguarde alguns minutos.");
  if (row.count === 1)
    await db.rateLimit.deleteMany({
      where: { expiresAt: { lt: new Date(now) } },
    });
}
