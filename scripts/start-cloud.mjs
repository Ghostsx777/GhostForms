import { spawn } from "node:child_process";

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
function run(file, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file, ...args], {
      stdio: "inherit",
      env: process.env,
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
await run("node_modules/prisma/build/index.js", [
  "migrate",
  "deploy",
  "--schema",
  "prisma/postgresql/schema.prisma",
]);
await run("node_modules/next/dist/bin/next", [
  "start",
  "--hostname",
  "0.0.0.0",
  "--port",
  port,
]);
