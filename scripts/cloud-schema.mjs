import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

// Um único modelo de dados, com histórico de migração próprio por banco.
const source = readFileSync("prisma/schema.prisma", "utf8");
if (!source.includes('provider = "sqlite"'))
  throw new Error("Schema local inesperado.");
mkdirSync("prisma/postgresql", { recursive: true });
writeFileSync(
  "prisma/postgresql/schema.prisma",
  source.replace('provider = "sqlite"', 'provider = "postgresql"'),
);
