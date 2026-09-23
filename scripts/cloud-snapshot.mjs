import { gzipSync, gunzipSync } from "node:zlib";

export const tables = [
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

export function readSnapshot(sqlite) {
  sqlite.exec("BEGIN");
  try {
    return tables.map(([table, model]) => ({
      model,
      rows: sqlite
        .prepare(`SELECT * FROM "${table}"`)
        .all()
        .map((row) =>
          Object.fromEntries(
            Object.entries(row).map(([key, value]) => {
              if (value === null) return [key, null];
              if (dates.has(key)) return [key, new Date(value).toISOString()];
              if (booleans.has(key)) return [key, Boolean(value)];
              if (key === "options" || key === "value")
                return [key, JSON.parse(value)];
              if (key === "data")
                return [key, Buffer.from(value).toString("base64")];
              return [key, value];
            }),
          ),
        ),
    }));
  } finally {
    sqlite.exec("ROLLBACK");
  }
}

export function encodeSnapshot(snapshot) {
  return gzipSync(JSON.stringify(snapshot)).toString("base64");
}

export function decodeSnapshot(encoded) {
  const snapshot = JSON.parse(
    gunzipSync(Buffer.from(encoded, "base64"), {
      maxOutputLength: 100 * 1024 * 1024,
    }).toString("utf8"),
  );
  if (
    !Array.isArray(snapshot) ||
    snapshot.length !== tables.length ||
    snapshot.some(
      (item, i) => item.model !== tables[i][1] || !Array.isArray(item.rows),
    )
  )
    throw new Error("Snapshot inválido.");
  return snapshot.map(({ model, rows }) => ({
    model,
    rows: rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
          key,
          value === null
            ? null
            : dates.has(key)
              ? new Date(value)
              : key === "data"
                ? Buffer.from(value, "base64")
                : value,
        ]),
      ),
    ),
  }));
}
