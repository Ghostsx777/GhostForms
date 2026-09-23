// O arquivo contém dados privados. Nunca o envie ao GitHub.
import { DatabaseSync } from "node:sqlite";
import { writeFileSync, mkdirSync } from "node:fs";
import { readSnapshot, encodeSnapshot } from "./cloud-snapshot.mjs";

const sqlite = new DatabaseSync(process.env.SOURCE_SQLITE || "prisma/dev.db", {
  readOnly: true,
});
try {
  const snapshot = readSnapshot(sqlite);
  mkdirSync("test-results", { recursive: true });
  writeFileSync(
    "test-results/.env.cloud-import",
    `GHOSTFORMS_IMPORT_DATA=${encodeSnapshot(snapshot)}\nGHOSTFORMS_VERIFY_DEPLOY=1\n`,
    { mode: 0o600 },
  );
  console.table(
    snapshot.map(({ model, rows }) => ({ table: model, count: rows.length })),
  );
  console.log(
    "Arquivo privado pronto em test-results/.env.cloud-import (ignorado pelo Git).",
  );
} finally {
  sqlite.close();
}
