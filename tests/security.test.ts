import { test } from "node:test";
import assert from "node:assert/strict";
import { canManage } from "../src/lib/permissions";
import { hashPassword, verifyPassword } from "../src/lib/password";
import {
  formSchema,
  registerSchema,
  validateAnswers,
  type QuestionInput,
} from "../src/lib/validation";
const question: QuestionInput = {
  id: "535dcfc7-66b4-4d38-96b4-a369126fcf6d",
  title: "Escolha",
  description: "",
  type: "MULTIPLE",
  required: true,
  color: "#161922",
  options: ["A", "B"],
};
test("isolamento por proprietário e revogação de conta", () => {
  assert.equal(
    canManage({ id: "a", role: "CREATOR", status: "APPROVED" }, "a"),
    true,
  );
  assert.equal(
    canManage({ id: "b", role: "CREATOR", status: "APPROVED" }, "a"),
    false,
  );
  assert.equal(
    canManage({ id: "b", role: "MASTER", status: "APPROVED" }, "a"),
    true,
  );
  for (const status of ["PENDING", "REJECTED"])
    for (const role of ["MASTER", "CREATOR"])
      assert.equal(canManage({ id: "a", role, status }, "a"), false);
});
test("hash salgado, senha correta e senha incorreta", async () => {
  const a = await hashPassword("uma-senha-longa!");
  const b = await hashPassword("uma-senha-longa!");
  assert.notEqual(a, b);
  assert.equal(await verifyPassword("uma-senha-longa!", a), true);
  assert.equal(await verifyPassword("senha-errada", a), false);
  assert.equal(await verifyPassword("qualquer", "malformado"), false);
});
test("cadastro não aceita elevação de privilégios", () => {
  assert.equal(
    registerSchema.safeParse({
      name: "Teste",
      email: "a@example.com",
      password: "senha-de-teste-123",
      role: "MASTER",
      status: "APPROVED",
    }).success,
    false,
  );
});
test("respostas obrigatórias e opções são verificadas no servidor", () => {
  assert.throws(() => validateAnswers([question], {}));
  assert.throws(() => validateAnswers([question], { [question.id]: "A" }));
  assert.throws(() =>
    validateAnswers([question], { [question.id]: ["intruso"] }),
  );
  assert.throws(() =>
    validateAnswers([question], { [question.id]: ["A", "A"] }),
  );
  assert.throws(() =>
    validateAnswers([question], { [question.id]: ["A"], intruso: "B" }),
  );
  assert.deepEqual(
    validateAnswers([question], { [question.id]: ["A", "B"] })[0].value,
    ["A", "B"],
  );
});
test("texto curto e escolha única possuem limites e tipos próprios", () => {
  const short = { ...question, type: "SHORT" as const };
  assert.throws(() =>
    validateAnswers([short], { [short.id]: "x".repeat(501) }),
  );
  assert.throws(() => validateAnswers([short], { [short.id]: "   " }));
  assert.throws(() =>
    validateAnswers([{ ...question, type: "SINGLE" }], { [question.id]: "C" }),
  );
});
test("schema impede cores arbitrárias e perguntas repetidas", () => {
  const input = {
    title: "Teste",
    description: "",
    background: "#000000",
    cardColor: "#161922",
    buttonColor: "#b5f5c6",
    published: true,
    version: 1,
    questions: [question],
  };
  assert.equal(formSchema.safeParse(input).success, true);
  assert.equal(
    formSchema.safeParse({ ...input, background: "url(https://evil.test)" })
      .success,
    false,
  );
  assert.equal(
    formSchema.safeParse({ ...input, questions: [question, question] }).success,
    false,
  );
});
