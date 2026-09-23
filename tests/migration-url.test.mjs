import { test } from "node:test";
import assert from "node:assert/strict";
import { migrationUrl } from "../scripts/migration-url.mjs";
test("migração Neon usa endpoint direto mantendo autenticação e TLS", () => {
  const source =
    "postgresql://user:dummy@ep-example-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require";
  const result = new URL(migrationUrl(source));
  assert.equal(result.hostname, "ep-example.c-6.us-east-2.aws.neon.tech");
  assert.equal(result.password, "dummy");
  assert.equal(result.pathname, "/neondb");
  assert.equal(result.searchParams.get("sslmode"), "require");
  assert.equal(new URL(source).hostname.includes("-pooler."), true);
});
test("respeita conexão explícita e não altera hosts de outros provedores", () => {
  assert.equal(
    new URL(migrationUrl("postgresql://u:p@other-pooler.example/db")).hostname,
    "other-pooler.example",
  );
  assert.equal(
    new URL(
      migrationUrl(
        "postgresql://u:p@unused/db",
        "postgresql://u:p@direct.example/db",
      ),
    ).hostname,
    "direct.example",
  );
  assert.throws(() => migrationUrl("https://example.com"));
});
