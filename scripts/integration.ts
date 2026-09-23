import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { hashPassword } from "../src/lib/password";
const db = new PrismaClient();
const origin = process.env.TEST_URL || "http://127.0.0.1:3000";
const trustedOrigin = process.env.TEST_REQUEST_ORIGIN || origin;
if (!["localhost", "127.0.0.1"].includes(new URL(origin).hostname))
  throw new Error("Execute os testes somente em uma instância local.");
const suffix = randomUUID();
const ids: string[] = [];
const password = randomBytes(24).toString("base64url");
let checks = 0;
type Session = { cookie: string };
async function call(
  path: string,
  method = "GET",
  body?: unknown,
  session?: Session,
  expected = 200,
  requestOrigin = trustedOrigin,
) {
  const response = await fetch(`${origin}/api/${path}`, {
    method,
    headers: {
      Origin: requestOrigin,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(session ? { Cookie: session.cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: ${JSON.stringify(data)}`,
  );
  checks++;
  return {
    data,
    cookie: response.headers.get("set-cookie")?.split(";")[0] || "",
  };
}
async function run() {
  const masterEmail = `master-${suffix}@example.test`;
  const masterUser = await db.user.create({
    data: {
      name: "Master integração",
      email: masterEmail,
      passwordHash: await hashPassword(password),
      role: "MASTER",
      status: "APPROVED",
    },
  });
  ids.push(masterUser.id);
  const master = await call("auth/login", "POST", {
    email: masterEmail,
    password,
    master: true,
  });
  const email = `creator-${suffix}@example.test`;
  await call(
    "auth/register",
    "POST",
    { name: "Criador integração", email, password },
    undefined,
    201,
  );
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  ids.push(user.id);
  const creator = await call("auth/login", "POST", { email, password });
  await call("forms", "POST", undefined, creator, 403);
  await call("users", "GET", undefined, creator, 403);
  await call(`users/${user.id}`, "PATCH", { status: "APPROVED" }, master);
  const { data: created } = await call(
    "forms",
    "POST",
    undefined,
    creator,
    201,
  );
  const { data: form } = await call(
    `forms/${created.id}`,
    "GET",
    undefined,
    creator,
  );
  await call(`public/${form.slug}`, "GET", undefined, undefined, 404);
  await call(`forms/${created.id}`, "GET", undefined, undefined, 401);
  const otherUser = await db.user.create({
    data: {
      name: "Outro criador",
      email: `other-${suffix}@example.test`,
      passwordHash: await hashPassword(password),
      status: "APPROVED",
    },
  });
  ids.push(otherUser.id);
  const other = await call("auth/login", "POST", {
    email: otherUser.email,
    password,
  });
  await call(`forms/${created.id}`, "GET", undefined, other, 404);
  await call(`forms/${created.id}`, "DELETE", undefined, other, 404);
  await call("users", "GET", undefined, other, 403);
  await call(`forms/${created.id}/responses`, "GET", undefined, other, 404);
  const { data: privateSession } = await call(
    "auth/session",
    "GET",
    undefined,
    creator,
  );
  assert.equal("passwordHash" in privateSession.user, false);
  await call(
    "forms",
    "POST",
    undefined,
    creator,
    403,
    "https://untrusted.test",
  );
  const q1 = {
    id: randomUUID(),
    title: "**Seu nome?**",
    description: "",
    type: "SHORT",
    required: true,
    color: "#161922",
    options: [],
  };
  const q2 = {
    ...q1,
    id: randomUUID(),
    title: "Selecione",
    type: "MULTIPLE",
    options: ["A", "B"],
  };
  const input = {
    title: "Pesquisa de integração",
    description: "<script>alert(1)</script>",
    background: "#0b0d12",
    cardColor: "#161922",
    buttonColor: "#b5f5c6",
    published: true,
    version: 1,
    questions: [q1, q2],
  };
  await call(`forms/${created.id}`, "PATCH", input, creator);
  await call(`forms/${created.id}`, "PATCH", input, creator, 409);
  const { data: publicData } = await call(`public/${form.slug}`);
  assert.equal(publicData.ownerName, user.name);
  for (const forbidden of [
    "ownerId",
    "owner",
    "submissions",
    "passwordHash",
    "id",
  ])
    assert.equal(forbidden in publicData, false);
  await call(
    `public/${form.slug}`,
    "POST",
    { version: 2, answers: {} },
    undefined,
    400,
  );
  await call(
    `public/${form.slug}`,
    "POST",
    { version: 2, answers: { [q1.id]: "Oi", [q2.id]: ["C"] } },
    undefined,
    400,
  );
  await call(
    `public/${form.slug}`,
    "POST",
    { version: 1, answers: { [q1.id]: "Oi", [q2.id]: ["A"] } },
    undefined,
    409,
  );
  await call(
    `public/${form.slug}`,
    "POST",
    {
      version: 2,
      answers: { [q1.id]: "<script>unsafe()</script>", [q2.id]: ["A", "B"] },
    },
    undefined,
    201,
  );
  const { data: responses } = await call(
    `forms/${created.id}/responses`,
    "GET",
    undefined,
    creator,
  );
  const responseId = responses.items[0].id;
  await call(
    `responses/${responseId}`,
    "PATCH",
    { status: "APPROVED" },
    other,
    403,
  );
  await call(
    `responses/${responseId}`,
    "PATCH",
    { status: "APPROVED" },
    creator,
  );
  assert.equal(
    (
      await call(
        `forms/${created.id}/responses?status=APPROVED`,
        "GET",
        undefined,
        creator,
      )
    ).data.items.length,
    1,
  );
  assert.equal(
    (
      await call(
        `forms/${created.id}/responses?status=PENDING`,
        "GET",
        undefined,
        creator,
      )
    ).data.items.length,
    0,
  );
  await call(
    `responses/${responseId}`,
    "PATCH",
    { status: "REJECTED" },
    creator,
  );
  assert.equal(
    (
      await call(
        `forms/${created.id}/responses?status=REJECTED`,
        "GET",
        undefined,
        creator,
      )
    ).data.items.length,
    1,
  );
  // O master edita; as respostas antigas mantêm o snapshot da pergunta removida.
  await call(
    `forms/${created.id}`,
    "PATCH",
    { ...input, version: 2, questions: [q2] },
    master,
  );
  const saved = await db.answer.findFirstOrThrow({
    where: { submissionId: responseId, questionTitle: q1.title },
  });
  assert.equal(saved.value, "<script>unsafe()</script>");
  assert.equal(saved.questionId, null);
  const png = await sharp({
    create: { width: 100, height: 60, channels: 3, background: "#b5f5c6" },
  })
    .png()
    .toBuffer();
  const upload = await fetch(`${origin}/api/forms/${created.id}/cover`, {
    method: "POST",
    headers: {
      Origin: trustedOrigin,
      Cookie: creator.cookie,
      "Content-Type": "image/png",
    },
    body: new Uint8Array(png),
  });
  assert.equal(upload.status, 200);
  checks++;
  const cover = await fetch(`${origin}/api/public/${form.slug}/cover`);
  assert.equal(cover.headers.get("content-type"), "image/webp");
  const landscape = await sharp(
    Buffer.from(await cover.arrayBuffer()),
  ).metadata();
  assert.equal(landscape.width, 100);
  assert.equal(landscape.height, 60);
  checks++;
  // Quadrada, retrato e banner devem manter proporção, sem recorte.
  for (const [width, height] of [
    [500, 500],
    [600, 1200],
    [2400, 600],
  ]) {
    const image = await sharp({
      create: { width, height, channels: 3, background: "#82d6a0" },
    })
      .png()
      .toBuffer();
    const result = await fetch(`${origin}/api/forms/${created.id}/cover`, {
      method: "POST",
      headers: {
        Origin: trustedOrigin,
        Cookie: creator.cookie,
        "Content-Type": "image/png",
      },
      body: new Uint8Array(image),
    });
    assert.equal(result.status, 200);
    checks++;
    const download = await fetch(`${origin}/api/public/${form.slug}/cover`);
    assert.equal(download.status, 200);
    checks++;
    const meta = await sharp(
      Buffer.from(await download.arrayBuffer()),
    ).metadata();
    assert.equal(meta.width! / meta.height!, width / height);
    assert.ok(meta.width! <= 1600 && meta.height! <= 1600);
  }
  const invalidUpload = await fetch(`${origin}/api/forms/${created.id}/cover`, {
    method: "POST",
    headers: { Origin: trustedOrigin, Cookie: creator.cookie },
    body: '<svg onload="alert(1)"></svg>',
  });
  assert.equal(invalidUpload.status, 400);
  checks++;
  await call(`users/${user.id}/forms`, "GET", undefined, master);
  const { data: accounts } = await call("users", "GET", undefined, master);
  assert.ok(
    accounts.items.every(
      (u: Record<string, unknown>) => !("passwordHash" in u),
    ),
  );
  await call("audit", "GET", undefined, master);
  await call(`users/${user.id}`, "PATCH", { status: "REJECTED" }, master);
  await call("forms", "GET", undefined, creator, 401);
  await call(`public/${form.slug}`, "GET", undefined, undefined, 404);
  await call(
    `public/${form.slug}`,
    "POST",
    { version: 3, answers: { [q2.id]: ["A"] } },
    undefined,
    404,
  );
  await call(
    `users/${masterUser.id}`,
    "PATCH",
    { status: "REJECTED" },
    master,
    400,
  );
  // Criação delegada mantém proprietário e permissões.
  await call("users/" + user.id + "/forms", "POST", undefined, undefined, 401);
  await call("users/" + user.id + "/forms", "POST", undefined, other, 403);
  await call("users/missing/forms", "POST", undefined, master, 404);
  const delegated = await call(
    "users/" + user.id + "/forms",
    "POST",
    undefined,
    master,
    201,
  );
  const delegatedForm = await db.form.findUniqueOrThrow({
    where: { id: delegated.data.id },
  });
  assert.equal(delegatedForm.ownerId, user.id);
  assert.equal(delegatedForm.published, false);
  await call("public/" + delegatedForm.slug, "GET", undefined, undefined, 404);
  await call("forms/" + delegatedForm.id, "GET", undefined, other, 404);
  // Exclusão é exclusiva do master e exige confirmação do e-mail correto.
  await call(`users/${user.id}`, "DELETE", { email }, undefined, 401);
  await call(`users/${user.id}`, "DELETE", { email }, other, 403);
  await call(
    `users/${user.id}`,
    "DELETE",
    { email },
    master,
    403,
    "https://untrusted.test",
  );
  await call(
    `users/${user.id}`,
    "DELETE",
    { email: "errado@example.test" },
    master,
    400,
  );
  await call(
    `users/${masterUser.id}`,
    "DELETE",
    { email: masterEmail },
    master,
    403,
  );
  assert.ok(await db.user.findUnique({ where: { id: user.id } }));
  await call(`users/${user.id}`, "PATCH", { status: "APPROVED" }, master);
  const liveCreator = await call("auth/login", "POST", { email, password });
  await call(`users/${user.id}`, "DELETE", { email }, master);
  assert.equal(await db.user.count({ where: { id: user.id } }), 0);
  assert.equal(await db.form.count({ where: { id: created.id } }), 0);
  assert.equal(await db.question.count({ where: { formId: created.id } }), 0);
  assert.equal(await db.cover.count({ where: { formId: created.id } }), 0);
  assert.equal(await db.submission.count({ where: { formId: created.id } }), 0);
  assert.equal(
    await db.answer.count({ where: { submissionId: responseId } }),
    0,
  );
  assert.equal(await db.session.count({ where: { userId: user.id } }), 0);
  assert.equal(
    await db.auditLog.count({
      where: {
        actorId: masterUser.id,
        targetId: user.id,
        action: "ACCOUNT_DELETE",
      },
    }),
    1,
  );
  await call("forms", "GET", undefined, liveCreator, 401);
  await call(`public/${form.slug}`, "GET", undefined, undefined, 404);
  await call(`users/${user.id}`, "DELETE", { email }, master, 404);
  // Preserva também o teste de exclusão individual de formulário.
  const extra = await call("forms", "POST", undefined, other, 201);
  await call(`forms/${extra.data.id}`, "DELETE", undefined, master);
  const recoveryPath = "users/" + otherUser.id + "/temporary-password";
  await call(
    recoveryPath,
    "POST",
    { masterPassword: password },
    undefined,
    401,
  );
  await call(recoveryPath, "POST", { masterPassword: password }, other, 403);
  await call(
    recoveryPath,
    "POST",
    { masterPassword: "incorreta" },
    master,
    403,
  );
  await call(
    "users/" + masterUser.id + "/temporary-password",
    "POST",
    { masterPassword: password },
    master,
    403,
  );
  const recovered = await call(
    recoveryPath,
    "POST",
    { masterPassword: password },
    master,
  );
  assert.equal(recovered.data.temporaryPassword.length, 24);
  await call("forms", "GET", undefined, other, 401);
  await call(
    "auth/login",
    "POST",
    { email: otherUser.email, password },
    undefined,
    401,
  );
  const temporary = await call("auth/login", "POST", {
    email: otherUser.email,
    password: recovered.data.temporaryPassword,
  });
  assert.equal(temporary.data.mustChangePassword, true);
  await call("forms", "POST", undefined, temporary, 403);
  const redirectCheck = await fetch(origin + "/dashboard", {
    headers: { Cookie: temporary.cookie },
    redirect: "manual",
  });
  assert.ok(
    redirectCheck.headers.get("location") === "/change-password" ||
      (await redirectCheck.text()).includes("/change-password"),
  );
  await call(
    "auth/change-password",
    "POST",
    { currentPassword: "incorrect", password },
    temporary,
    400,
  );
  await call(
    "auth/change-password",
    "POST",
    { currentPassword: recovered.data.temporaryPassword, password: "short" },
    temporary,
    400,
  );
  const changed = await call(
    "auth/change-password",
    "POST",
    { currentPassword: recovered.data.temporaryPassword, password },
    temporary,
  );
  await call("forms", "GET", undefined, temporary, 401);
  await call("forms", "GET", undefined, changed);
  await call(
    "auth/login",
    "POST",
    { email: otherUser.email, password: recovered.data.temporaryPassword },
    undefined,
    401,
  );
  const normalLogin = await call("auth/login", "POST", {
    email: otherUser.email,
    password,
  });
  assert.equal(normalLogin.data.mustChangePassword, false);
  const safeAccounts = await call("users", "GET", undefined, master);
  assert.ok(
    safeAccounts.data.items.every(
      (u: Record<string, unknown>) =>
        !("passwordHash" in u) && !("temporaryPassword" in u),
    ),
  );
  await call("users/" + otherUser.id, "PATCH", { status: "PENDING" }, master);
  const pendingRecovery = await call(
    recoveryPath,
    "POST",
    { masterPassword: password },
    master,
  );
  const pendingLogin = await call("auth/login", "POST", {
    email: otherUser.email,
    password: pendingRecovery.data.temporaryPassword,
  });
  const pendingChanged = await call(
    "auth/change-password",
    "POST",
    { currentPassword: pendingRecovery.data.temporaryPassword, password },
    pendingLogin,
  );
  await call("forms", "GET", undefined, pendingChanged, 403);
  assert.equal(
    (await db.user.findUniqueOrThrow({ where: { id: otherUser.id } })).status,
    "PENDING",
  );
  const expiring = await call(
    recoveryPath,
    "POST",
    { masterPassword: password },
    master,
  );
  await db.user.update({
    where: { id: otherUser.id },
    data: { temporaryPasswordExpiresAt: new Date(Date.now() - 1000) },
  });
  await call(
    "auth/login",
    "POST",
    { email: otherUser.email, password: expiring.data.temporaryPassword },
    undefined,
    401,
  );
  await call("auth/logout", "POST", undefined, master);
  await call("users", "GET", undefined, master, 401);
  console.log(
    `OK: ${checks} verificações HTTP, além de asserts de privacidade e preservação de respostas.`,
  );
}
run()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    // Remove exclusivamente contas criadas nesta execução, por IDs retornados pelo banco.
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  });
