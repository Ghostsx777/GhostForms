// Migrações precisam manter a mesma sessão para o advisory lock do PostgreSQL.
export function migrationUrl(databaseUrl, directUrl) {
  const url = new URL(directUrl || databaseUrl);
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error("Conexão PostgreSQL inválida.");
  if (!directUrl && url.hostname.endsWith(".neon.tech"))
    url.hostname = url.hostname.replace("-pooler.", ".");
  if (!url.searchParams.has("connect_timeout"))
    url.searchParams.set("connect_timeout", "30");
  return url.toString();
}
