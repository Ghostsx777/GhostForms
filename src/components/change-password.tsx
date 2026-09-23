"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, message } from "@/lib/client";
import { Brand, Notice } from "./ui";
export function ChangePassword() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const values = new FormData(event.currentTarget);
    setError("");
    if (values.get("password") !== values.get("confirm")) {
      setError("As novas senhas precisam ser iguais.");
      return;
    }
    setBusy(true);
    try {
      await api("auth/change-password", "POST", {
        currentPassword: values.get("currentPassword"),
        password: values.get("password"),
      });
      router.replace("/");
      router.refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="password-page">
      <section className="panel stack">
        <Brand />
        <h1>Um novo acesso.</h1>
        <p className="muted">Escolha sua senha pessoal antes de continuar.</p>
        <form onSubmit={submit} className="stack">
          <label>
            Senha temporária
            <input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
            />
          </label>
          <label>
            Nova senha
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
              placeholder="Pelo menos 12 caracteres"
            />
          </label>
          <label>
            Confirme a nova senha
            <input
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
            />
          </label>
          <Notice text={error} />
          <button className="button primary" disabled={busy}>
            {busy ? "Salvando…" : "Salvar minha senha"}
          </button>
        </form>
        <button
          className="text-button"
          disabled={busy}
          onClick={async () => {
            try {
              await api("auth/logout", "POST");
              router.replace("/");
              router.refresh();
            } catch (e) {
              setError(message(e));
            }
          }}
        >
          Sair da conta
        </button>
      </section>
    </main>
  );
}
