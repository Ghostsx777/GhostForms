import "dotenv/config";
import { closeSync, existsSync, mkdirSync, openSync } from "node:fs";
import { dirname, resolve } from "node:path";
// Prisma resolve file: em relação a prisma/schema.prisma.
// Criar o arquivo vazio evita falha do schema-engine em alguns ambientes Windows.
const url = process.env.DATABASE_URL;
if (!url?.startsWith("file:"))
  throw new Error("Configure DATABASE_URL com um caminho SQLite file:.");
const path = resolve("prisma", url.slice(5));
mkdirSync(dirname(path), { recursive: true });
if (!existsSync(path)) closeSync(openSync(path, "wx"));
