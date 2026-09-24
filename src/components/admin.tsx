"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AccountAccess } from "./account-access";
import { useCallback, useEffect, useState } from "react";
import {
  Check,
  X,
  FolderOpen,
  ArrowUpRight,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { api, date, message, type UserDTO } from "@/lib/client";
import { Notice, Pager, Status, PreviewModal } from "./ui";
type Account = UserDTO & { _count: { forms: number } };
export function Admin() {
  const router = useRouter();
  const [recovering, setRecovering] = useState<Account | null>(null);
  async function createFor(user: Account) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const form = await api(`users/${user.id}/forms`, "POST");
      router.push(`/forms/${form.id}`);
    } catch (e) {
      setError(message(e));
      setBusy(false);
    }
  }
  const [tab, setTab] = useState("users");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Account[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [autoApprove, setAutoApprove] = useState<boolean | null>(null);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [policyNotice, setPolicyNotice] = useState("");
  useEffect(() => {
    api("settings/registration")
      .then((data) => setAutoApprove(data.autoApproveAccounts))
      .catch((e) => setError(message(e)));
  }, []);
  async function toggleApproval() {
    if (autoApprove === null || savingPolicy) return;
    setSavingPolicy(true);
    setPolicyNotice("");
    setError("");
    try {
      const result = await api("settings/registration", "PATCH", {
        autoApproveAccounts: !autoApprove,
      });
      setAutoApprove(result.autoApproveAccounts);
      setPolicyNotice(
        result.autoApproveAccounts
          ? "Aprovação automática ativada para novos cadastros."
          : "Novos cadastros agora precisam de aprovação manual.",
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setSavingPolicy(false);
    }
  }
  const [deleting, setDeleting] = useState<Account | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [selected, setSelected] = useState<Account | null>(null);
  const [forms, setForms] = useState<any[]>([]);
  const [formPage, setFormPage] = useState(0);
  const [moreForms, setMoreForms] = useState(false);
  const [formsLoading, setFormsLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api(`${tab}?page=${page}`);
      if (tab === "users") setRows(result.items);
      else setLogs(result.items);
      setHasMore(result.hasMore);
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }, [tab, page]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    let ignore = false;
    if (!selected) return;
    setFormsLoading(true);
    api(`users/${selected.id}/forms?page=${formPage}`)
      .then((data) => {
        if (!ignore) {
          setForms(data.items);
          setMoreForms(data.hasMore);
        }
      })
      .catch((e) => {
        if (!ignore) setError(message(e));
      })
      .finally(() => {
        if (!ignore) setFormsLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [selected, formPage]);
  async function change(user: Account, status: string) {
    setBusy(true);
    setError("");
    try {
      await api(`users/${user.id}`, "PATCH", { status });
      await load();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function removeAccount(event: React.FormEvent) {
    event.preventDefault();
    if (!deleting || busy) return;
    setBusy(true);
    setDeleteError("");
    try {
      await api(`users/${deleting.id}`, "DELETE", {
        email: confirmation.trim(),
      });
      if (selected?.id === deleting.id) setSelected(null);
      setDeleting(null);
      setConfirmation("");
      if (rows.length === 1 && page > 0) setPage(page - 1);
      else await load();
    } catch (e) {
      setDeleteError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ÁREA MASTER</span>
          <h1>
            Nos bastidores<span className="accent">.</span>
          </h1>
          <p className="muted">
            Gerencie quem cria e acompanhe o que acontece.
          </p>
        </div>
        <span className="master-mark">
          <ShieldCheck size={20} />
          Admin Master
        </span>
      </div>
      <div className="tabs">
        <button
          className={tab === "users" ? "selected" : ""}
          onClick={() => {
            setTab("users");
            setPage(0);
          }}
        >
          Contas e formulários
        </button>
        <button
          className={tab === "audit" ? "selected" : ""}
          onClick={() => {
            setTab("audit");
            setPage(0);
          }}
        >
          Registro de atividades
        </button>
      </div>
      <Notice text={error} />
      {tab === "users" && (
        <section
          className="registration-policy"
          aria-labelledby="registration-policy-title"
        >
          <div>
            <h2 id="registration-policy-title">
              Aprovar novas contas automaticamente
            </h2>
            <p className="muted">
              Enquanto ativa, novos cadastros já podem criar formulários. Contas
              pendentes ou reprovadas não são alteradas.
            </p>
            <p className="muted" role="status">
              {policyNotice ||
                (autoApprove === null
                  ? "Carregando configuração…"
                  : autoApprove
                    ? "Ativada — novos cadastros são aprovados automaticamente."
                    : "Desativada — aprovação manual pelo master.")}
            </p>
          </div>
          <button
            type="button"
            className={`button ${autoApprove ? "primary" : "subtle"}`}
            role="switch"
            aria-checked={autoApprove ?? false}
            aria-labelledby="registration-policy-title"
            disabled={autoApprove === null || savingPolicy}
            onClick={toggleApproval}
          >
            {savingPolicy
              ? "Salvando…"
              : autoApprove
                ? "Ativada"
                : "Desativada"}
          </button>
        </section>
      )}
      {loading ? (
        <p role="status">Carregando…</p>
      ) : tab === "users" ? (
        <div className="account-list">
          {rows.map((user) => (
            <article className="account-card" key={user.id}>
              <header>
                <span className="avatar">
                  {user.name.slice(0, 2).toUpperCase()}
                </span>
                <div className="account-identity">
                  <h3>{user.name}</h3>
                  <span>{user.email}</span>
                </div>
                <Status value={user.status} />
              </header>
              <div className="account-metadata">
                <span>
                  Cadastro<strong>{date(user.createdAt)}</strong>
                </span>
                <span>
                  Último login
                  <strong>
                    {user.lastLoginAt
                      ? date(user.lastLoginAt)
                      : "Ainda não entrou"}
                  </strong>
                </span>
                <span>
                  Perfil
                  <strong>
                    {user.role === "MASTER" ? "Master" : "Criador"}
                  </strong>
                </span>
              </div>
              <footer>
                <button
                  className="button subtle small"
                  onClick={() => {
                    setSelected(user);
                    setFormPage(0);
                  }}
                >
                  <FolderOpen size={16} />
                  {user._count.forms} formulários
                </button>
                {user.role !== "MASTER" && (
                  <div className="button-row">
                    <button
                      className="button subtle small"
                      disabled={busy}
                      onClick={() => createFor(user)}
                    >
                      Criar formulário
                    </button>
                    <button
                      className="button subtle small"
                      disabled={busy}
                      onClick={() => setRecovering(user)}
                    >
                      Recuperar acesso
                    </button>
                    <button
                      className="button approve small"
                      disabled={busy || user.status === "APPROVED"}
                      onClick={() => change(user, "APPROVED")}
                    >
                      <Check size={16} />
                      Aprovar
                    </button>
                    <button
                      className="button subtle small"
                      disabled={busy || user.status === "REJECTED"}
                      onClick={() => change(user, "REJECTED")}
                    >
                      <X size={16} />
                      Rejeitar
                    </button>
                    <button
                      className="button danger-button small"
                      disabled={busy}
                      onClick={() => {
                        setDeleting(user);
                        setConfirmation("");
                        setDeleteError("");
                      }}
                      aria-label={`Excluir conta de ${user.name}`}
                    >
                      <Trash2 size={15} />
                      Excluir
                    </button>
                  </div>
                )}
              </footer>
            </article>
          ))}
        </div>
      ) : (
        <div className="audit-list">
          {logs.length === 0 && (
            <p className="muted">Nenhuma atividade registrada.</p>
          )}
          {logs.map((log) => (
            <article key={log.id}>
              <div>
                <strong>{log.actor.name}</strong>
                <span>{log.actor.email}</span>
              </div>
              <div>
                <code>{log.action}</code>
                <small>Referência: {log.targetId}</small>
              </div>
              <time>{date(log.createdAt)}</time>
            </article>
          ))}
        </div>
      )}
      <Pager page={page} hasMore={hasMore} onChange={setPage} />
      {recovering && (
        <AccountAccess user={recovering} onClose={() => setRecovering(null)} />
      )}
      {deleting && (
        <PreviewModal
          labelledBy="delete-account-title"
          className="confirm-dialog"
          onClose={() => {
            if (!busy) setDeleting(null);
          }}
        >
          <form onSubmit={removeAccount} className="stack">
            <span className="delete-symbol">
              <Trash2 size={25} />
            </span>
            <h2 id="delete-account-title">
              Excluir a conta de {deleting.name}?
            </h2>
            <p className="muted">
              Esta ação apaga permanentemente a conta, seus{" "}
              {deleting._count.forms} formulário(s), imagens e todas as
              respostas recebidas. Não pode ser desfeita.
            </p>
            <label>
              Para confirmar, digite <strong>{deleting.email}</strong>
              <input
                autoFocus
                type="email"
                autoComplete="off"
                required
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                disabled={busy}
              />
            </label>
            <Notice text={deleteError} />
            <div className="button-row">
              <button
                type="button"
                className="button subtle"
                disabled={busy}
                onClick={() => setDeleting(null)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="button danger-button"
                disabled={
                  busy || confirmation.trim().toLowerCase() !== deleting.email
                }
              >
                {busy ? "Excluindo…" : "Excluir conta definitivamente"}
              </button>
            </div>
          </form>
        </PreviewModal>
      )}
      {selected && (
        <section className="panel account-forms">
          <div className="section-line">
            <h2>Formulários de {selected.name}</h2>
            <button
              className="icon-button"
              aria-label="Fechar formulários da conta"
              onClick={() => setSelected(null)}
            >
              <X size={18} />
            </button>
          </div>
          {formsLoading ? (
            <p role="status">Carregando formulários…</p>
          ) : forms.length === 0 ? (
            <p className="muted">Esta conta ainda não criou formulários.</p>
          ) : (
            forms.map((form) => (
              <Link
                key={form.id}
                href={`/forms/${form.id}`}
                className="admin-form-link"
              >
                <div>
                  <strong>{form.title}</strong>
                  <small>
                    {form.published ? "Publicado" : "Rascunho"} ·{" "}
                    {form._count.submissions} respostas
                  </small>
                </div>
                <span>
                  Editar
                  <ArrowUpRight size={17} />
                </span>
              </Link>
            ))
          )}
          <Pager page={formPage} hasMore={moreForms} onChange={setFormPage} />
        </section>
      )}
    </>
  );
}
