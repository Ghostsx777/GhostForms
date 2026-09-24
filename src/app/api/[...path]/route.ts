import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import sharp from "sharp";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  COOKIE,
  createSession,
  digest,
  getUser,
  HttpError,
  requireForm,
  requireUser,
  userSelect,
  canManage,
} from "@/lib/auth";
import {
  checkOrigin,
  clientKey,
  jsonBody,
  rateLimit,
  readBody,
} from "@/lib/http";
import {
  formSchema,
  loginSchema,
  registerSchema,
  submissionSchema,
  validateAnswers,
  type QuestionInput,
} from "@/lib/validation";
import { hashPassword, verifyPassword } from "@/lib/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
const ok = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
const statusSchema = z
  .object({ status: z.enum(["PENDING", "APPROVED", "REJECTED"]) })
  .strict();
const audit = (actorId: string, action: string, targetId: string) => ({
  actorId,
  action,
  targetId,
});
const pageSize = 20;
function page(request: NextRequest) {
  return (
    Math.max(
      0,
      Math.min(100000, Number(request.nextUrl.searchParams.get("page")) || 0),
    ) | 0
  );
}
function paginated<T>(rows: T[]) {
  return { items: rows.slice(0, pageSize), hasMore: rows.length > pageSize };
}
async function assertTransactionAccess(
  tx: Prisma.TransactionClient,
  userId: string,
  formId: string,
) {
  const [user, form] = await Promise.all([
    tx.user.findUnique({ where: { id: userId } }),
    tx.form.findUnique({ where: { id: formId } }),
  ]);
  if (
    !user ||
    user.mustChangePassword ||
    !form ||
    !canManage(user, form.ownerId)
  )
    throw new HttpError(403, "Acesso não autorizado.");
}
async function publicForm(slug: string) {
  const form = await db.form.findFirst({
    where: { slug, published: true, owner: { status: "APPROVED" } },
    select: {
      owner: { select: { name: true } },
      title: true,
      description: true,
      slug: true,
      version: true,
      background: true,
      cardColor: true,
      buttonColor: true,
      questions: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          type: true,
          required: true,
          options: true,
          color: true,
        },
      },
      cover: { select: { formId: true } },
    },
  });
  if (!form) throw new HttpError(404, "Este formulário não está disponível.");
  const { owner, cover, ...data } = form;
  return { ...data, ownerName: owner.name, hasCover: !!cover };
}
async function handler(request: NextRequest, context: Context) {
  try {
    const { path: parts } = await context.params;
    const path = parts.join("/");
    const method = request.method;
    if (method !== "GET") checkOrigin(request);

    if (path === "auth/session" && method === "GET")
      return ok({ user: await getUser() });
    if (
      path === "settings/registration" &&
      (method === "GET" || method === "PATCH")
    ) {
      const master = await requireUser(true);
      if (method === "GET") {
        const settings = await db.appSettings.findUnique({
          where: { id: "global" },
        });
        return ok({
          autoApproveAccounts: settings?.autoApproveAccounts ?? false,
        });
      }
      const input = z
        .object({ autoApproveAccounts: z.boolean() })
        .strict()
        .parse(await jsonBody(request));
      const settings = await db.$transaction(async (tx) => {
        const result = await tx.appSettings.upsert({
          where: { id: "global" },
          create: { id: "global", ...input },
          update: input,
        });
        await tx.auditLog.create({
          data: audit(
            master.id,
            input.autoApproveAccounts
              ? "AUTO_APPROVAL_ENABLED"
              : "AUTO_APPROVAL_DISABLED",
            "global",
          ),
        });
        return result;
      });
      return ok({ autoApproveAccounts: settings.autoApproveAccounts });
    }
    if (path === "auth/register" && method === "POST") {
      await rateLimit(`register:${clientKey(request)}`, 15);
      const input = registerSchema.parse(await jsonBody(request));
      const passwordHash = await hashPassword(input.password);
      // A mesma resposta para um e-mail novo ou já cadastrado evita enumeração.
      try {
        await db.$transaction(async (tx) => {
          const settings = await tx.appSettings.findUnique({
            where: { id: "global" },
          });
          await tx.user.create({
            data: {
              name: input.name,
              email: input.email,
              passwordHash,
              role: "CREATOR",
              status: settings?.autoApproveAccounts ? "APPROVED" : "PENDING",
            },
          });
        });
      } catch (e) {
        if (!(
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ))
          throw e;
      }
      return ok(
        {
          message:
            "Se o e-mail ainda não estava cadastrado, sua conta foi registrada. Entre para acessar seu espaço ou consultar a aprovação.",
        },
        201,
      );
    }
    if (path === "auth/login" && method === "POST") {
      await rateLimit(`login:${clientKey(request)}`, 60);
      const input = loginSchema.parse(await jsonBody(request));
      await rateLimit(`login-email:${input.email}`, 10);
      const user = await db.user.findUnique({ where: { email: input.email } });
      const dummy =
        "scrypt:00000000000000000000000000000000:" + "00".repeat(64);
      const valid = await verifyPassword(
        input.password,
        user?.passwordHash ?? dummy,
      );
      if (
        !user ||
        !valid ||
        (input.master && user.role !== "MASTER") ||
        (user.mustChangePassword &&
          (!user.temporaryPasswordExpiresAt ||
            user.temporaryPasswordExpiresAt <= new Date()))
      )
        throw new HttpError(401, "E-mail ou senha inválidos.");
      await createSession(user.id);
      await db.$transaction([
        db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        }),
        db.auditLog.create({ data: audit(user.id, "LOGIN", user.id) }),
      ]);
      return ok({
        role: user.role,
        status: user.status,
        mustChangePassword: user.mustChangePassword,
      });
    }
    if (path === "auth/change-password" && method === "POST") {
      const user = await getUser();
      if (!user) throw new HttpError(401, "Entre na sua conta.");
      await rateLimit(`change-password:${user.id}`, 10);
      const input = z
        .object({
          currentPassword: z.string().min(1).max(128),
          password: registerSchema.shape.password,
        })
        .strict()
        .parse(await jsonBody(request));
      if (input.currentPassword === input.password)
        throw new HttpError(400, "Escolha uma senha diferente da temporária.");
      const current = await db.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      if (
        !current.mustChangePassword ||
        !(await verifyPassword(input.currentPassword, current.passwordHash))
      )
        throw new HttpError(400, "Senha temporária inválida.");
      const passwordHash = await hashPassword(input.password);
      await db.$transaction(async (tx) => {
        const result = await tx.user.updateMany({
          where: {
            id: user.id,
            passwordHash: current.passwordHash,
            mustChangePassword: true,
            temporaryPasswordExpiresAt: { gt: new Date() },
          },
          data: {
            passwordHash,
            mustChangePassword: false,
            temporaryPasswordExpiresAt: null,
          },
        });
        if (!result.count)
          throw new HttpError(409, "O acesso mudou. Entre novamente.");
        await tx.session.deleteMany({ where: { userId: user.id } });
        await tx.auditLog.create({
          data: audit(user.id, "PASSWORD_CHANGED", user.id),
        });
      });
      await createSession(user.id);
      return ok({ success: true });
    }
    if (path === "auth/logout" && method === "POST") {
      const jar = await cookies();
      const token = jar.get(COOKIE)?.value;
      if (token)
        await db.session.deleteMany({ where: { tokenHash: digest(token) } });
      jar.delete(COOKIE);
      return ok({ success: true });
    }
    if (parts[0] === "public" && parts.length === 2 && method === "GET")
      return ok(await publicForm(parts[1]));
    if (
      parts[0] === "public" &&
      parts.length === 3 &&
      parts[2] === "cover" &&
      method === "GET"
    ) {
      const cover = await db.cover.findFirst({
        where: {
          form: {
            slug: parts[1],
            published: true,
            owner: { status: "APPROVED" },
          },
        },
      });
      if (!cover) throw new HttpError(404, "Capa não encontrada.");
      return new NextResponse(new Uint8Array(cover.data), {
        headers: { "Content-Type": "image/webp", "Cache-Control": "no-store" },
      });
    }
    if (parts[0] === "public" && parts.length === 2 && method === "POST") {
      await rateLimit(`submit:${clientKey(request)}:${parts[1]}`, 40);
      const input = submissionSchema.parse(await jsonBody(request));
      await db.$transaction(async (tx) => {
        const form = await tx.form.findFirst({
          where: {
            slug: parts[1],
            published: true,
            owner: { status: "APPROVED" },
          },
          include: { questions: { orderBy: { position: "asc" } } },
        });
        if (!form)
          throw new HttpError(404, "Este formulário não está disponível.");
        if (input.version !== form.version)
          throw new HttpError(
            409,
            "O formulário foi atualizado. Recarregue a página antes de responder.",
          );
        let answers;
        try {
          answers = validateAnswers(
            form.questions as unknown as QuestionInput[],
            input.answers,
          );
        } catch (e) {
          throw new HttpError(400, (e as Error).message);
        }
        await tx.submission.create({
          data: {
            formId: form.id,
            formVersion: form.version,
            answers: { create: answers },
          },
        });
      });
      return ok({ success: true }, 201);
    }

    if (path === "forms" && method === "GET") {
      const user = await requireUser();
      const forms = await db.form.findMany({
        where: { ownerId: user.id },
        orderBy: { updatedAt: "desc" },
        skip: page(request) * pageSize,
        take: pageSize + 1,
        select: {
          id: true,
          title: true,
          slug: true,
          published: true,
          updatedAt: true,
          _count: { select: { submissions: true, questions: true } },
        },
      });
      return ok(paginated(forms));
    }
    if (path === "forms" && method === "POST") {
      const user = await requireUser();
      await rateLimit(`create:${user.id}`, 30);
      const form = await db.form.create({
        data: {
          ownerId: user.id,
          questions: {
            create: {
              id: randomUUID(),
              title: "Como podemos ajudar?",
              type: "SHORT",
              position: 0,
              options: [],
            },
          },
        },
        select: { id: true },
      });
      return ok(form, 201);
    }
    if (parts[0] === "forms" && parts.length === 2) {
      const { user, form } = await requireForm(parts[1]);
      if (method === "GET")
        return ok({ ...form, hasCover: !!form.cover, cover: undefined });
      if (method === "PATCH") {
        const { questions, version, ...data } = formSchema.parse(
          await jsonBody(request),
        );
        const updated = await db.$transaction(async (tx) => {
          await assertTransactionAccess(tx, user.id, form.id);
          const result = await tx.form.updateMany({
            where: { id: form.id, version },
            data: { ...data, version: { increment: 1 } },
          });
          if (!result.count)
            throw new HttpError(
              409,
              "Outra edição foi salva. Recarregue antes de editar novamente.",
            );
          // Respostas antigas preservam título, tipo e valor mesmo após remover perguntas.
          await tx.question.deleteMany({ where: { formId: form.id } });
          await tx.question.createMany({
            data: questions.map((q, position) => ({
              ...q,
              position,
              formId: form.id,
            })),
          });
          await tx.auditLog.create({
            data: audit(user.id, "FORM_EDIT", form.id),
          });
          return tx.form.findUniqueOrThrow({
            where: { id: form.id },
            select: { version: true },
          });
        });
        return ok(updated);
      }
      if (method === "DELETE") {
        await db.$transaction(async (tx) => {
          await assertTransactionAccess(tx, user.id, form.id);
          await tx.auditLog.create({
            data: audit(user.id, "FORM_DELETE", form.id),
          });
          await tx.form.delete({ where: { id: form.id } });
        });
        return ok({ success: true });
      }
    }
    if (parts[0] === "forms" && parts.length === 3 && parts[2] === "cover") {
      const { user, form } = await requireForm(parts[1]);
      if (method === "GET") {
        const cover = await db.cover.findUnique({ where: { formId: form.id } });
        if (!cover) throw new HttpError(404, "Capa não encontrada.");
        return new NextResponse(new Uint8Array(cover.data), {
          headers: {
            "Content-Type": "image/webp",
            "Cache-Control": "no-store",
          },
        });
      }
      if (method === "POST") {
        await rateLimit(`upload:${user.id}`, 30);
        const bytes = await readBody(request, 4 * 1024 * 1024);
        let data: Buffer;
        try {
          const image = sharp(bytes, {
            limitInputPixels: 20_000_000,
            animated: false,
          });
          const meta = await image.metadata();
          if (!["jpeg", "png", "webp"].includes(meta.format ?? ""))
            throw new Error();
          data = await image
            .rotate()
            .resize({
              width: 1600,
              height: 1600,
              fit: "inside",
              withoutEnlargement: true,
            })
            .webp({ quality: 82 })
            .toBuffer();
        } catch {
          throw new HttpError(
            400,
            "Envie uma imagem JPG, PNG ou WebP válida, de até 4 MB e 20 megapixels.",
          );
        }
        await db.$transaction(async (tx) => {
          await assertTransactionAccess(tx, user.id, form.id);
          await tx.cover.upsert({
            where: { formId: form.id },
            create: { formId: form.id, data: new Uint8Array(data) },
            update: { data: new Uint8Array(data) },
          });
          await tx.auditLog.create({
            data: audit(user.id, "COVER_UPDATE", form.id),
          });
        });
        return ok({ success: true });
      }
    }
    if (
      parts[0] === "forms" &&
      parts.length === 3 &&
      parts[2] === "responses" &&
      method === "GET"
    ) {
      const { form } = await requireForm(parts[1]);
      const filter = z
        .enum(["ALL", "PENDING", "APPROVED", "REJECTED"])
        .parse(request.nextUrl.searchParams.get("status") || "ALL");
      const rows = await db.submission.findMany({
        where: {
          formId: form.id,
          ...(filter === "ALL" ? {} : { status: filter }),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: page(request) * pageSize,
        take: pageSize + 1,
        include: { answers: { orderBy: { position: "asc" } } },
      });
      const counts = await db.submission.groupBy({
        by: ["status"],
        where: { formId: form.id },
        _count: true,
      });
      return ok({ ...paginated(rows), counts });
    }
    if (parts[0] === "responses" && parts.length === 2 && method === "PATCH") {
      const user = await requireUser();
      const { status } = statusSchema.parse(await jsonBody(request));
      await db.$transaction(async (tx) => {
        const row = await tx.submission.findUnique({ where: { id: parts[1] } });
        if (!row) throw new HttpError(404, "Resposta não encontrada.");
        await assertTransactionAccess(tx, user.id, row.formId);
        await tx.submission.update({
          where: { id: row.id },
          data: {
            status,
            moderatedAt: status === "PENDING" ? null : new Date(),
          },
        });
        await tx.auditLog.create({
          data: audit(user.id, `RESPONSE_${status}`, row.id),
        });
      });
      return ok({ success: true });
    }
    if (path === "users" && method === "GET") {
      await requireUser(true);
      const rows = await db.user.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: page(request) * pageSize,
        take: pageSize + 1,
        select: { ...userSelect, _count: { select: { forms: true } } },
      });
      return ok(paginated(rows));
    }
    if (
      parts[0] === "users" &&
      parts.length === 3 &&
      parts[2] === "forms" &&
      method === "GET"
    ) {
      await requireUser(true);
      const forms = await db.form.findMany({
        where: { ownerId: parts[1] },
        orderBy: { updatedAt: "desc" },
        skip: page(request) * pageSize,
        take: pageSize + 1,
        select: {
          id: true,
          title: true,
          published: true,
          _count: { select: { submissions: true } },
        },
      });
      return ok(paginated(forms));
    }
    if (
      parts[0] === "users" &&
      parts.length === 3 &&
      parts[2] === "forms" &&
      method === "POST"
    ) {
      const master = await requireUser(true);
      await rateLimit(`create:${master.id}`, 30);
      const form = await db.$transaction(async (tx) => {
        const actor = await tx.user.findUnique({ where: { id: master.id } });
        if (
          actor?.role !== "MASTER" ||
          actor.status !== "APPROVED" ||
          actor.mustChangePassword
        )
          throw new HttpError(403, "Acesso não autorizado.");
        const owner = await tx.user.findUnique({ where: { id: parts[1] } });
        if (!owner) throw new HttpError(404, "Conta não encontrada.");
        const result = await tx.form.create({
          data: {
            ownerId: owner.id,
            questions: {
              create: {
                id: randomUUID(),
                title: "Como podemos ajudar?",
                type: "SHORT",
                position: 0,
                options: [],
              },
            },
          },
          select: { id: true },
        });
        await tx.auditLog.create({
          data: audit(master.id, "FORM_CREATE_FOR_USER", result.id),
        });
        return result;
      });
      return ok(form, 201);
    }
    if (
      parts[0] === "users" &&
      parts.length === 3 &&
      parts[2] === "temporary-password" &&
      method === "POST"
    ) {
      const master = await requireUser(true);
      await rateLimit(`recover:${master.id}`, 10);
      const { masterPassword } = z
        .object({ masterPassword: z.string().min(1).max(128) })
        .strict()
        .parse(await jsonBody(request));
      const actor = await db.user.findUniqueOrThrow({
        where: { id: master.id },
      });
      if (!(await verifyPassword(masterPassword, actor.passwordHash)))
        throw new HttpError(403, "Senha do administrador incorreta.");
      const temporaryPassword = randomBytes(18).toString("base64url");
      const passwordHash = await hashPassword(temporaryPassword);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await db.$transaction(async (tx) => {
        const current = await tx.user.findUnique({ where: { id: master.id } });
        if (
          current?.role !== "MASTER" ||
          current.status !== "APPROVED" ||
          current.mustChangePassword ||
          current.passwordHash !== actor.passwordHash
        )
          throw new HttpError(403, "Acesso não autorizado.");
        const target = await tx.user.findUnique({ where: { id: parts[1] } });
        if (!target) throw new HttpError(404, "Conta não encontrada.");
        if (target.role === "MASTER")
          throw new HttpError(403, "Contas master são protegidas.");
        await tx.user.update({
          where: { id: target.id },
          data: {
            passwordHash,
            mustChangePassword: true,
            temporaryPasswordExpiresAt: expiresAt,
          },
        });
        await tx.session.deleteMany({ where: { userId: target.id } });
        await tx.auditLog.create({
          data: audit(master.id, "TEMPORARY_PASSWORD_ISSUED", target.id),
        });
      });
      return ok({ temporaryPassword, expiresAt });
    }
    if (parts[0] === "users" && parts.length === 2 && method === "DELETE") {
      const master = await requireUser(true);
      const { email } = z
        .object({ email: z.email() })
        .strict()
        .parse(await jsonBody(request));
      await db.$transaction(async (tx) => {
        const actor = await tx.user.findUnique({ where: { id: master.id } });
        if (actor?.role !== "MASTER" || actor.status !== "APPROVED")
          throw new HttpError(403, "Acesso não autorizado.");
        const target = await tx.user.findUnique({ where: { id: parts[1] } });
        if (!target) throw new HttpError(404, "Conta não encontrada.");
        if (target.role === "MASTER" || target.id === master.id)
          throw new HttpError(
            403,
            "Contas master são protegidas contra exclusão.",
          );
        if (email.toLowerCase() !== target.email)
          throw new HttpError(
            400,
            "Digite o e-mail da conta para confirmar a exclusão.",
          );
        await tx.auditLog.create({
          data: audit(master.id, "ACCOUNT_DELETE", target.id),
        });
        await tx.user.delete({ where: { id: target.id } });
      });
      return ok({ success: true });
    }
    if (parts[0] === "users" && parts.length === 2 && method === "PATCH") {
      const master = await requireUser(true);
      const { status } = statusSchema.parse(await jsonBody(request));
      await db.$transaction(async (tx) => {
        const actor = await tx.user.findUnique({ where: { id: master.id } });
        if (actor?.role !== "MASTER" || actor.status !== "APPROVED")
          throw new HttpError(403, "Acesso não autorizado.");
        const result = await tx.user.updateMany({
          where: { id: parts[1], role: "CREATOR" },
          data: { status },
        });
        if (!result.count)
          throw new HttpError(400, "Conta não encontrada ou protegida.");
        if (status !== "APPROVED")
          await tx.session.deleteMany({ where: { userId: parts[1] } });
        await tx.auditLog.create({
          data: audit(master.id, `ACCOUNT_${status}`, parts[1]),
        });
      });
      return ok({ success: true });
    }
    if (path === "audit" && method === "GET") {
      await requireUser(true);
      return ok(
        paginated(
          await db.auditLog.findMany({
            orderBy: { createdAt: "desc" },
            skip: page(request) * pageSize,
            take: pageSize + 1,
            include: { actor: { select: { name: true, email: true } } },
          }),
        ),
      );
    }
    throw new HttpError(404, "Recurso não encontrado.");
  } catch (e) {
    if (e instanceof HttpError) return ok({ error: e.message }, e.status);
    if (e instanceof z.ZodError)
      return ok(
        {
          error: e.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        },
        400,
      );
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2002", "P2025", "P2034"].includes(e.code)
    )
      return ok(
        { error: "Conflito de dados. Recarregue a página e tente novamente." },
        409,
      );
    console.error(
      "GhostForms request failed:",
      e instanceof Error ? e.name : "UnknownError",
    );
    return ok(
      { error: "Não foi possível concluir a operação. Tente novamente." },
      500,
    );
  }
}
export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };
