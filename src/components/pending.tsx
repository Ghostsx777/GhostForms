"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3 } from "lucide-react";
import { api, message } from "@/lib/client";
import { Brand, Notice } from "./ui";
export function Pending({ rejected }: { rejected: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  async function logout() {
    try {
      await api("auth/logout", "POST");
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(message(e));
    }
  }
  return (
    <main className="status-page">
      <Brand />
      <section className="panel">
        <Clock3 size={36} />
        <h1>{rejected ? "Conta não autorizada." : "Quase do outro lado."}</h1>
        <p className="muted">
          {rejected
            ? "Sua conta foi rejeitada ou desativada pelo administrador."
            : "Sua solicitação está pendente. O administrador precisa aprovar seu acesso antes de você criar formulários."}
        </p>
        <Notice text={error} />
        <div className="button-row">
          <button className="button primary" onClick={() => router.refresh()}>
            Verificar status
          </button>
          <button className="button subtle" onClick={logout}>
            Sair da conta
          </button>
        </div>
      </section>
    </main>
  );
}
