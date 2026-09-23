// Execute com Node 24, cliente Prisma PostgreSQL e DATABASE_URL do destino.
// Copia apenas para um destino vazio; não exporta senhas ou dados em arquivos.
import { DatabaseSync } from "node:sqlite";
import { PrismaClient } from "@prisma/client";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

if (!/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL || "")) {
  throw new Error("DATABASE_URL deve apontar para o PostgreSQL de destino.");
}
const source = resolve(process.env.SOURCE_SQLITE || "prisma/dev.db");
if (!existsSync(source))
  throw new Error("Banco SQLite de origem não encontrado.");
const sqlite = new DatabaseSync(source, { readOnly: true });
const db = new PrismaClient();
const tables = [
  ["User", "user"],
  ["Form", "form"],
  ["Question", "question"],
  ["Submission", "submission"],
  ["Answer", "answer"],
  ["Cover", "cover"],
  ["AuditLog", "auditLog"],
];
const dates = new Set([
  "createdAt",
  "updatedAt",
  "lastLoginAt",
  "moderatedAt",
  "temporaryPasswordExpiresAt",
]);
const booleans = new Set(["mustChangePassword", "published", "required"]);
function convert(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      if (value === null) return [key, null];
      if (dates.has(key)) return [key, new Date(value)];
      if (booleans.has(key)) return [key, Boolean(value)];
      if (key === "options" || key === "value") return [key, JSON.parse(value)];
      return [key, value];
    }),
  );
}
try {
  sqlite.exec("BEGIN");
  const snapshot = tables.map(([table, model]) => ({
    model,
    rows: sqlite.prepare(`SELECT * FROM "${table}"`).all().map(convert),
  }));
  sqlite.exec("COMMIT");
  const counts = await db.$transaction(
    async (tx) => {
      for (const model of [
        ...tables.map(([, model]) => model),
        "session",
        "rateLimit",
      ]) {
        if (await tx[model].count())
          throw new Error(
            "O destino contém dados. Importação cancelada sem alterações.",
          );
      }
      for (const { model, rows } of snapshot) {
        // Lotes pequenos também acomodam capas sem exceder limites de parâmetros.
        for (let i = 0; i < rows.length; i += 20)
          await tx[model].createMany({ data: rows.slice(i, i + 20) });
        if ((await tx[model].count()) !== rows.length)
          throw new Error("Contagem divergente; importação revertida.");
      }
      return snapshot.map(({ model, rows }) => ({
        table: model,
        count: rows.length,
      }));
    },
    { maxWait: 15000, timeout: 120000 },
  );
  console.log(
    "Importação concluída. Sessões locais não foram copiadas; faça login no site online.",
  );
  console.table(counts);
} catch (error) {
  // Não imprimir mensagens do driver que possam incluir valores dos registros.
  console.error(
    error.message?.startsWith("O destino contém dados")
      ? error.message
      : "Importação não concluída. Nenhum dado parcial foi mantido no destino.",
  );
  process.exitCode = 1;
} finally {
  sqlite.close();
  await db.$disconnect();
}
