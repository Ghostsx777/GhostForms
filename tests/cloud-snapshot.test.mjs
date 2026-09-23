import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  tables,
  readSnapshot,
  encodeSnapshot,
  decodeSnapshot,
} from "../scripts/cloud-snapshot.mjs";

test("snapshot preserva datas, JSON, bytes e booleanos sem copiar sessões", () => {
  const sqlite = new DatabaseSync(":memory:");
  try {
    for (const [table] of tables)
      sqlite.exec(`CREATE TABLE "${table}" (id TEXT)`);
    sqlite.exec(
      'DROP TABLE "Question"; CREATE TABLE "Question" (id TEXT, options TEXT, required INTEGER, createdAt INTEGER)',
    );
    sqlite
      .prepare('INSERT INTO "Question" VALUES (?, ?, ?, ?)')
      .run("q1", '["A","B"]', 0, 1700000000000);
    sqlite.exec(
      'DROP TABLE "Cover"; CREATE TABLE "Cover" (formId TEXT, data BLOB)',
    );
    sqlite
      .prepare('INSERT INTO "Cover" VALUES (?, ?)')
      .run("f1", Buffer.from([0, 255, 128, 7]));
    sqlite.exec(
      'CREATE TABLE "Session" (token TEXT); INSERT INTO "Session" VALUES (\'não-copiar\')',
    );
    const result = decodeSnapshot(encodeSnapshot(readSnapshot(sqlite)));
    assert.equal(result.length, 7);
    const question = result.find((t) => t.model === "question").rows[0];
    assert.deepEqual(question.options, ["A", "B"]);
    assert.equal(question.required, false);
    assert.equal(question.createdAt.getTime(), 1700000000000);
    assert.deepEqual(
      result.find((t) => t.model === "cover").rows[0].data,
      Buffer.from([0, 255, 128, 7]),
    );
    assert.equal(JSON.stringify(result).includes("não-copiar"), false);
  } finally {
    sqlite.close();
  }
});
test("snapshot rejeita modelos arbitrários e payload corrompido", () => {
  assert.throws(() =>
    decodeSnapshot(encodeSnapshot([{ model: "session", rows: [] }])),
  );
  assert.throws(() => decodeSnapshot("inválido"));
});
