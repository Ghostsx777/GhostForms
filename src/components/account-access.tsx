"use client";
import { useState } from "react";
import { api, date, message } from "@/lib/client";
import { Notice, PreviewModal } from "./ui";
export function AccountAccess({
  user,
  onClose,
}: {
  user: { id: string; name: string };
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    temporaryPassword: string;
    expiresAt: string;
  } | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const masterPassword = String(new FormData(form).get("masterPassword"));
    setBusy(true);
    setError("");
    try {
      setResult(
        await api(`users/${user.id}/temporary-password`, "POST", {
          masterPassword,
        }),
      );
      form.reset();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <PreviewModal
      labelledBy="recovery-title"
      className="confirm-dialog"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="stack">
        <span className="eyebrow">ACESSO ASSISTIDO</span>
        <h2 id="recovery-title">Recuperar acesso de {user.name}</h2>
        {result ? (
          <>
            <p>
              A senha abaixo aparece somente nesta janela. Entregue-a ao dono da
              conta. Ele deverá escolher uma nova senha ao entrar.
            </p>
            <label>
              Senha temporária
              <input
                className="recovery-secret"
                readOnly
                value={result.temporaryPassword}
                onFocus={(e) => e.target.select()}
              />
            </label>
            <small>
              Válida até {date(result.expiresAt)}. Ao fechar, ela não poderá ser
              consultada novamente.
            </small>
            <button className="button primary" onClick={onClose}>
              Concluir
            </button>
          </>
        ) : (
          <form className="stack" onSubmit={submit}>
            <p className="muted">
              As senhas atuais não podem ser consultadas. Gere uma senha
              temporária válida por 24 horas: ela substitui a anterior e encerra
              os acessos da conta. A aprovação da conta permanece como está.
            </p>
            <label>
              Sua senha de administrador
              <input
                name="masterPassword"
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
                disabled={busy}
                autoFocus
              />
            </label>
            <Notice text={error} />
            <div className="button-row">
              <button
                type="button"
                className="button subtle"
                onClick={onClose}
                disabled={busy}
              >
                Cancelar
              </button>
              <button className="button primary" disabled={busy}>
                {busy ? "Gerando…" : "Gerar senha temporária"}
              </button>
            </div>
          </form>
        )}
      </div>
    </PreviewModal>
  );
}
