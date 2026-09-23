"use client";
import Link from "next/link";
import {
  LayoutGrid,
  ShieldCheck,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, message, statusLabels, type UserDTO } from "@/lib/client";
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-icon">
        <img src="/brand/ghost.png" alt="" width={46} height={54} />
      </span>
      GhostForms<span className="brand-dot">.</span>
    </span>
  );
}
export function Notice({
  text,
  success = false,
}: {
  text: string;
  success?: boolean;
}) {
  return text ? (
    <div
      className={`notice ${success ? "success" : ""}`}
      role={success ? "status" : "alert"}
    >
      {text}
    </div>
  ) : null;
}
export function Status({ value }: { value: string }) {
  return (
    <span className={`badge ${value.toLowerCase()}`}>
      {statusLabels[value] || value}
    </span>
  );
}
export function BoldText({ text }: { text: string }) {
  // Apenas **negrito**; React escapa todo o restante. Nunca injeta HTML.
  return (
    <>
      {text
        .split(/(\*\*[^*]+\*\*)/g)
        .map((part, i) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={i}>{part.slice(2, -2)}</strong>
          ) : (
            part
          ),
        )}
    </>
  );
}
export function PreviewModal({
  children,
  onClose,
  labelledBy = "preview-title",
  className = "preview-dialog",
}: {
  children: React.ReactNode;
  onClose: () => void;
  labelledBy?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [opener] = useState(() =>
    typeof document === "undefined" ? null : document.activeElement,
  );
  useEffect(() => {
    const dialog = ref.current;
    const rootOverflow = document.documentElement.style.overflow;
    const bodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    if (dialog && !dialog.open) dialog.showModal();
    // Fechar restaura o foco ao acionador. Não usamos o evento onClose:
    // ele também ocorre na limpeza do Strict Mode e cancelava a reabertura.
    return () => {
      dialog?.close();
      document.documentElement.style.overflow = rootOverflow;
      document.body.style.overflow = bodyOverflow;
      queueMicrotask(() => {
        if (
          !document.querySelector("dialog[open]") &&
          opener instanceof HTMLElement &&
          opener.isConnected
        )
          opener.focus();
      });
    };
  }, [opener]);
  return (
    <dialog
      ref={ref}
      className={className}
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {children}
    </dialog>
  );
}
export function Pager({
  page,
  hasMore,
  onChange,
}: {
  page: number;
  hasMore: boolean;
  onChange: (page: number) => void;
}) {
  return (
    <div className="pager">
      <button
        className="button subtle"
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft size={16} />
        Anterior
      </button>
      <span>Página {page + 1}</span>
      <button
        className="button subtle"
        disabled={!hasMore}
        onClick={() => onChange(page + 1)}
      >
        Próxima
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
export function Shell({
  user,
  active,
  children,
}: {
  user: UserDTO;
  active: "forms" | "admin";
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    try {
      await api("auth/logout", "POST");
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(message(e));
      setBusy(false);
    }
  }
  return (
    <div className="workspace">
      <aside className="sidebar">
        <Link href="/dashboard" className="brand-link">
          <Brand />
        </Link>
        <div className="nav-caption">SEU ESPAÇO</div>
        <nav>
          <Link
            className={active === "forms" ? "nav-link active" : "nav-link"}
            href="/dashboard"
          >
            <LayoutGrid size={19} />
            Meus formulários
          </Link>
          {user.role === "MASTER" && (
            <Link
              className={active === "admin" ? "nav-link active" : "nav-link"}
              href="/master-admin"
            >
              <ShieldCheck size={19} />
              Administração
            </Link>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="profile">
            <span className="avatar">
              {user.name.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <strong>{user.name}</strong>
              <small>
                {user.role === "MASTER"
                  ? "Administrador master"
                  : "Criador de formulários"}
              </small>
            </div>
          </div>
          <button
            className="button subtle logout"
            disabled={busy}
            onClick={logout}
          >
            <LogOut size={17} />
            Sair da conta
          </button>
          <Notice text={error} />
        </div>
      </aside>
      <main className="workspace-main">
        <div className="topbar">
          <span>
            GF /{" "}
            <span>{active === "admin" ? "Administração" : "Workspace"}</span>
          </span>
          <span className="topbar-note">Um espaço para boas perguntas.</span>
        </div>
        <div className="main-inner">{children}</div>
      </main>
    </div>
  );
}
