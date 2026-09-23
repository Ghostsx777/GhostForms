// Execute com Node 24, cliente Prisma PostgreSQL e DATABASE_URL do destino.
// Copia apenas para um destino vazio; não exporta senhas ou dados em arquivos.
import { DatabaseSync } from "node:sqlite";
import { PrismaClient } from "@prisma/client";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  tables,
  readSnapshot,
  encodeSnapshot,
  decodeSnapshot,
} from "./cloud-snapshot.mjs";

if (!/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL || "")) {
  throw new Error("DATABASE_URL deve apontar para o PostgreSQL de destino.");
}
const source = resolve(process.env.SOURCE_SQLITE || "prisma/dev.db");
if (!process.env.GHOSTFORMS_IMPORT_DATA && !existsSync(source))
  throw new Error("Banco SQLite de origem não encontrado.");
const sqlite = process.env.GHOSTFORMS_IMPORT_DATA
  ? null
  : new DatabaseSync(source, { readOnly: true });
const db = new PrismaClient();
try {
  const encoded =
    process.env.GHOSTFORMS_IMPORT_DATA || encodeSnapshot(readSnapshot(sqlite));
  const snapshot = decodeSnapshot(encoded);
  const receiptId =
    "cloud-import-" + createHash("sha256").update(encoded).digest("hex");
  if (await db.auditLog.findUnique({ where: { id: receiptId } })) {
    console.log(
      "Migração já concluída anteriormente; nenhum registro foi alterado.",
    );
  } else {
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
        const master = snapshot
          .find((item) => item.model === "user")
          .rows.find(
            (user) => user.role === "MASTER" && user.status === "APPROVED",
          );
        if (!master) throw new Error("Snapshot sem administrador aprovado.");
        await tx.auditLog.create({
          data: {
            id: receiptId,
            actorId: master.id,
            action: "CLOUD_DATA_IMPORTED",
            targetId: receiptId,
          },
        });
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
  }
} catch (error) {
  // Não imprimir mensagens do driver que possam incluir valores dos registros.
  console.error(
    error.message?.startsWith("O destino contém dados")
      ? error.message
      : "Importação não concluída. Nenhum dado parcial foi mantido no destino.",
  );
  process.exitCode = 1;
} finally {
  sqlite?.close();
  await db.$disconnect();
}
