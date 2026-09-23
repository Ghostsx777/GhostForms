export async function api<T = any>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Não foi possível concluir.");
  return result as T;
}
export function date(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
export function message(e: unknown) {
  return e instanceof Error ? e.message : "Ocorreu um erro. Tente novamente.";
}
export const statusLabels: Record<string, string> = {
  PENDING: "Pendente",
  APPROVED: "Aprovada",
  REJECTED: "Reprovada",
};
export type UserDTO = {
  id: string;
  name: string;
  email: string;
  role: "MASTER" | "CREATOR";
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  lastLoginAt: string | null;
};
