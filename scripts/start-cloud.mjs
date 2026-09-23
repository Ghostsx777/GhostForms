import { spawn } from "node:child_process";
import { migrationUrl } from "./migration-url.mjs";

const origin = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL;
if (!origin || new URL(origin).protocol !== "https:") {
  throw new Error("Configure APP_URL com a URL pública HTTPS do site.");
}
if (!/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL || "")) {
  throw new Error("Configure DATABASE_URL com o banco PostgreSQL online.");
}
process.env.APP_URL = new URL(origin).origin;
const port = process.env.PORT || "10000";
if (!/^\d+$/.test(port)) throw new Error("PORT inválida.");
function run(file, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file, ...args], {
      stdio: "inherit",
      env,
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Processo encerrado (${code}).`)),
    );
    for (const signal of ["SIGTERM", "SIGINT"])
      process.once(signal, () => child.kill(signal));
  });
}
await run(
  "node_modules/prisma/build/index.js",
  ["migrate", "deploy", "--schema", "prisma/postgresql/schema.prisma"],
  {
    ...process.env,
    DATABASE_URL: migrationUrl(
      process.env.DATABASE_URL,
      process.env.DIRECT_URL,
    ),
  },
);
if (process.env.GHOSTFORMS_IMPORT_DATA)
  await run("scripts/import-cloud.mjs", []);
delete process.env.GHOSTFORMS_IMPORT_DATA;
const verify = process.env.GHOSTFORMS_VERIFY_DEPLOY === "1";
delete process.env.GHOSTFORMS_VERIFY_DEPLOY;
const server = run("node_modules/next/dist/bin/next", [
  "start",
  "--hostname",
  "0.0.0.0",
  "--port",
  port,
]);
if (verify) {
  const localUrl = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      ready = (await fetch(`${localUrl}/api/health`)).ok;
    } catch {}
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (!ready) throw new Error("Servidor não ficou pronto para validação.");
  await run("node_modules/tsx/dist/cli.mjs", ["scripts/integration.ts"], {
    ...process.env,
    TEST_URL: localUrl,
    TEST_REQUEST_ORIGIN: process.env.APP_URL,
  });
  console.log("Validação HTTP do PostgreSQL concluída com sucesso.");
}
await server;
