"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  ArrowUpRight,
  FileText,
  MessageSquare,
  Trash2,
} from "lucide-react";
import { api, date, message } from "@/lib/client";
import { Notice, Pager } from "./ui";
type FormCard = {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  updatedAt: string;
  _count: { submissions: number; questions: number };
};
export function Dashboard() {
  const router = useRouter();
  const [forms, setForms] = useState<FormCard[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api(`forms?page=${page}`);
      setForms(data.items);
      setHasMore(data.hasMore);
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }, [page]);
  useEffect(() => {
    void load();
  }, [load]);
  async function create() {
    setBusy(true);
    setError("");
    try {
      const form = await api("forms", "POST");
      router.push(`/forms/${form.id}`);
    } catch (e) {
      setError(message(e));
      setBusy(false);
    }
  }
  async function remove(form: FormCard) {
    if (
      !confirm(
        `Apagar “${form.title}” e todas as suas respostas? Essa ação não pode ser desfeita.`,
      )
    )
      return;
    setBusy(true);
    try {
      await api(`forms/${form.id}`, "DELETE");
      await load();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">CRIE. COMPARTILHE. DESCUBRA.</span>
          <h1>
            Meus formulários<span className="accent">.</span>
          </h1>
          <p className="muted">Suas ideias ganham forma por aqui.</p>
        </div>
        <button className="button primary" onClick={create} disabled={busy}>
          <Plus size={19} />
          Criar formulário
        </button>
      </div>
      <div className="section-line">
        <span>
          <FileText size={17} />
          Sua coleção
        </span>
        <span>{forms.length} nesta página</span>
      </div>
      <Notice text={error} />
      {loading ? (
        <p className="muted" role="status">
          Carregando formulários…
        </p>
      ) : forms.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">
            <img
              src="/brand/ghost.png"
              alt=""
              width={48}
              height={56}
              className="empty-state-logo"
            />
          </span>
          <h2>Um espaço cheio de possibilidades.</h2>
          <p className="muted">
            Comece com uma pergunta. O resto vem com as respostas.
          </p>
          <button className="button primary" onClick={create} disabled={busy}>
            <Plus size={18} />
            Criar meu primeiro formulário
          </button>
        </div>
      ) : (
        <div className="form-grid">
          {forms.map((form, i) => (
            <article className="form-card" key={form.id}>
              <div className="form-card-top">
                <span className="form-number">
                  GF / {String(page * 20 + i + 1).padStart(2, "0")}
                </span>
                <span
                  className={`badge ${form.published ? "approved" : "draft"}`}
                >
                  {form.published ? "Publicado" : "Rascunho"}
                </span>
              </div>
              <Link href={`/forms/${form.id}`} className="form-card-title">
                <h2>{form.title}</h2>
                <ArrowUpRight size={22} />
              </Link>
              <p className="muted">
                {form._count.questions} pergunta
                {form._count.questions === 1 ? "" : "s"}
              </p>
              <div className="form-card-footer">
                <Link href={`/forms/${form.id}?tab=responses`}>
                  <MessageSquare size={16} />
                  {form._count.submissions} respostas
                </Link>
                <button
                  className="icon-button danger"
                  aria-label={`Apagar ${form.title}`}
                  disabled={busy}
                  onClick={() => remove(form)}
                >
                  <Trash2 size={17} />
                </button>
              </div>
              <small className="card-date">
                Editado em {date(form.updatedAt)}
              </small>
            </article>
          ))}
        </div>
      )}
      {(forms.length > 0 || page > 0) && (
        <Pager page={page} hasMore={hasMore} onChange={setPage} />
      )}
    </>
  );
}
