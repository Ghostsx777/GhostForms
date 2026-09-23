import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import { canManage } from "./permissions";
export { canManage } from "./permissions";
export const COOKIE = "gf_session";
export const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  lastLoginAt: true,
  mustChangePassword: true,
} as const;
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export async function getUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: digest(token) },
    include: {
      user: { select: { ...userSelect, temporaryPasswordExpiresAt: true } },
    },
  });
  if (!session || session.expiresAt <= new Date()) return null;
  const { temporaryPasswordExpiresAt, ...user } = session.user;
  if (
    user.mustChangePassword &&
    (!temporaryPasswordExpiresAt || temporaryPasswordExpiresAt <= new Date())
  )
    return null;
  return user;
}
export async function requireUser(master = false) {
  const user = await getUser();
  if (!user) throw new HttpError(401, "Entre na sua conta.");
  if (user.mustChangePassword)
    throw new HttpError(403, "Troque sua senha temporária antes de continuar.");
  if (user.status !== "APPROVED")
    throw new HttpError(403, "Sua conta ainda não está aprovada.");
  if (master && user.role !== "MASTER")
    throw new HttpError(403, "Acesso exclusivo do administrador master.");
  return user;
}
export async function requireForm(id: string) {
  const user = await requireUser();
  const form = await db.form.findUnique({
    where: { id },
    include: {
      owner: { select: { name: true } },
      questions: { orderBy: { position: "asc" } },
      cover: { select: { formId: true } },
    },
  });
  if (!form || !canManage(user, form.ownerId))
    throw new HttpError(404, "Formulário não encontrado.");
  return { user, form };
}
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  const jar = await cookies();
  const previous = jar.get(COOKIE)?.value;
  if (previous)
    await db.session.deleteMany({ where: { tokenHash: digest(previous) } });
  await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await db.session.create({
    data: { tokenHash: digest(token), userId, expiresAt: expires },
  });
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}
