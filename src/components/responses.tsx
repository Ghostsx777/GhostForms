"use client";
import { useCallback, useEffect, useState } from "react";
import { Check, X, Clock3, MessageSquare } from "lucide-react";
import { api, date, message, statusLabels } from "@/lib/client";
import { BoldText, Notice, Pager, Status } from "./ui";
type Submission = {
  id: string;
  status: string;
  createdAt: string;
  formVersion: number;
  moderatedAt: string | null;
  answers: { id: string; questionTitle: string; value: string | string[] }[];
};
export function Responses({ formId }: { formId: string }) {
  const [filter, setFilter] = useState("ALL");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Submission[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api(
        `forms/${formId}/responses?status=${filter}&page=${page}`,
      );
      setRows(result.items);
      setHasMore(result.hasMore);
      const counts: Record<string, number> = { ALL: 0 };
      for (const row of result.counts) {
        counts[row.status] = row._count;
        counts.ALL += row._count;
      }
      setCounts(counts);
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }, [filter, page, formId]);
  useEffect(() => {
    void load();
  }, [load]);
  async function moderate(id: string, status: string) {
    setBusy(id);
    setError("");
    try {
      await api(`responses/${id}`, "PATCH", { status });
      await load();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  }
  return (
    <section>
      <div className="responses-heading">
        <div>
          <h2>O outro lado da conversa.</h2>
          <p className="muted">Leia e organize as respostas recebidas.</p>
        </div>
        <span className="response-total">
          {counts.ALL ?? 0}
          <small>respostas</small>
        </span>
      </div>
      <div className="tabs filter-tabs" aria-label="Filtrar respostas">
        {[
          ["ALL", "Todas"],
          ["PENDING", "Pendentes"],
          ["APPROVED", "Aprovadas"],
          ["REJECTED", "Reprovadas"],
        ].map(([key, label]) => (
          <button
            aria-pressed={filter === key}
            className={filter === key ? "selected" : ""}
            key={key}
            onClick={() => {
              setFilter(key);
              setPage(0);
            }}
          >
            {label}
            <span>{counts[key] ?? 0}</span>
          </button>
        ))}
      </div>
      <Notice text={error} />
      {loading ? (
        <p role="status" className="muted">
          Carregando respostas…
        </p>
      ) : rows.length === 0 ? (
        <div className="empty-state compact">
          <MessageSquare size={35} />
          <h3>Nenhuma resposta por aqui.</h3>
          <p className="muted">
            As respostas desta categoria aparecerão neste espaço.
          </p>
        </div>
      ) : (
        <div className="response-list">
          {rows.map((row, i) => (
            <article className="response-card" key={row.id}>
              <header>
                <div>
                  <strong>Resposta {page * 20 + i + 1}</strong>
                  <small>
                    {date(row.createdAt)} · versão {row.formVersion}
                  </small>
                </div>
                <Status value={row.status} />
              </header>
              <dl>
                {row.answers.map((answer) => (
                  <div className="answer-row" key={answer.id}>
                    <dt>
                      <BoldText text={answer.questionTitle} />
                    </dt>
                    <dd className="preserve">
                      {Array.isArray(answer.value)
                        ? answer.value.join(", ") || "Sem resposta"
                        : answer.value || "Sem resposta"}
                    </dd>
                  </div>
                ))}
              </dl>
              <footer>
                <small className="muted">
                  {row.moderatedAt
                    ? `Moderada em ${date(row.moderatedAt)}`
                    : "Aguardando moderação"}
                </small>
                <div className="button-row">
                  {[
                    ["APPROVED", Check, "Aprovar"],
                    ["REJECTED", X, "Reprovar"],
                    ["PENDING", Clock3, "Pendente"],
                  ].map(([status, Icon, label]) => {
                    const Mark = Icon as typeof Check;
                    return (
                      <button
                        key={String(status)}
                        className={`button small ${status === "APPROVED" ? "approve" : "subtle"}`}
                        disabled={busy !== null || row.status === status}
                        onClick={() => moderate(row.id, String(status))}
                        aria-label={`${String(label)} resposta ${i + 1}`}
                      >
                        <Mark size={15} />
                        {String(label)}
                      </button>
                    );
                  })}
                </div>
              </footer>
            </article>
          ))}
        </div>
      )}
      <Pager page={page} hasMore={hasMore} onChange={setPage} />
    </section>
  );
}
