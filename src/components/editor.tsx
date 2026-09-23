"use client";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Plus,
  Trash2,
  Save,
  Eye,
  Link2,
  Upload,
  Bold,
  X,
} from "lucide-react";
import { api, message } from "@/lib/client";
import {
  formSchema,
  type FormInput,
  type QuestionInput,
  type Values,
} from "@/lib/validation";
import { FormFields, ink } from "./form-fields";
import { Notice, PreviewModal } from "./ui";
import { Responses } from "./responses";
export type EditorForm = FormInput & {
  id: string;
  slug: string;
  hasCover: boolean;
  ownerName: string;
};
const kinds = {
  SHORT: "Texto curto",
  LONG: "Texto longo",
  SINGLE: "Escolha única",
  MULTIPLE: "Múltipla seleção",
};
function FormattedInput({
  label,
  value,
  onChange,
  maxLength,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  multiline?: boolean;
}) {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const id = useId();
  function bold() {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? value.length;
    onChange(
      value.slice(0, start) +
        "**" +
        (value.slice(start, end) || "texto") +
        "**" +
        value.slice(end),
    );
    el.focus();
  }
  return (
    <div>
      <div className="label-with-tool">
        <label htmlFor={id}>{label}</label>
        <button
          type="button"
          className="icon-button"
          aria-label={`Negrito em ${label}`}
          title="Selecione um trecho para aplicar negrito"
          onClick={bold}
        >
          <Bold size={15} />
        </button>
      </div>
      {multiline ? (
        <textarea
          id={id}
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={maxLength}
          rows={2}
        />
      ) : (
        <input
          id={id}
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={maxLength}
        />
      )}
    </div>
  );
}
export function Editor({
  initial,
  initialTab = "edit",
}: {
  initial: EditorForm;
  initialTab?: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [tab, setTab] = useState(initialTab);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [preview, setPreview] = useState(false);
  const [previewValues, setPreviewValues] = useState<Values>({});
  const [coverVersion, setCoverVersion] = useState(0);
  const [publicUrl, setPublicUrl] = useState("");
  useEffect(() => {
    setPublicUrl(`${window.location.origin}/f/${form.slug}`);
  }, [form.slug]);
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [dirty]);
  function update(values: Partial<EditorForm>) {
    setForm((f) => ({ ...f, ...values }));
    setDirty(true);
    setSuccess("");
  }
  function updateQuestion(index: number, values: Partial<QuestionInput>) {
    update({
      questions: form.questions.map((q, i) =>
        i === index ? { ...q, ...values } : q,
      ),
    });
  }
  function move(index: number, step: number) {
    const questions = [...form.questions];
    [questions[index], questions[index + step]] = [
      questions[index + step],
      questions[index],
    ];
    update({ questions });
  }
  async function save() {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const { id, slug, hasCover, ownerName, ...input } = form;
      const validated = formSchema.safeParse(input);
      if (!validated.success)
        throw new Error(
          validated.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        );
      const result = await api(`forms/${id}`, "PATCH", validated.data);
      setForm((f) => ({ ...f, version: result.version }));
      setDirty(false);
      setSuccess(
        form.published ? "Formulário salvo e publicado." : "Rascunho salvo.",
      );
      router.refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      if (file.size > 4 * 1024 * 1024)
        throw new Error("A capa deve ter até 4 MB.");
      const result = await fetch(`/api/forms/${form.id}/cover`, {
        method: "POST",
        body: file,
        headers: { "Content-Type": file.type },
      });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error);
      setForm((f) => ({ ...f, hasCover: true }));
      setCoverVersion((v) => v + 1);
      setSuccess("Capa atualizada.");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setSuccess("Link copiado.");
    } catch {
      setError(
        "Não foi possível copiar. Selecione o link abaixo e copie manualmente.",
      );
    }
  }
  return (
    <>
      <Link
        href="/dashboard"
        className="back-link"
        onClick={(e) => {
          if (dirty && !confirm("Há alterações não salvas. Deseja sair?"))
            e.preventDefault();
        }}
      >
        <ArrowLeft size={16} />
        Meus formulários
      </Link>
      <div className="page-heading editor-heading">
        <div>
          <span className="eyebrow">ESTÚDIO DE CRIAÇÃO</span>
          <h1>{form.title}</h1>
          <p className="muted">
            {dirty
              ? "Alterações ainda não salvas"
              : `Versão ${form.version} · Tudo salvo`}
          </p>
        </div>
        <div className="button-row">
          <button className="button subtle" onClick={() => setPreview(true)}>
            <Eye size={17} />
            Prévia
          </button>
          <button className="button primary" onClick={save} disabled={busy}>
            <Save size={17} />
            {busy ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
      <div className="tabs editor-tabs">
        <button
          className={tab === "edit" ? "selected" : ""}
          aria-pressed={tab === "edit"}
          onClick={() => setTab("edit")}
        >
          Perguntas
        </button>
        <button
          className={tab === "responses" ? "selected" : ""}
          aria-pressed={tab === "responses"}
          onClick={() => setTab("responses")}
        >
          Respostas
        </button>
        <span className={`badge ${form.published ? "approved" : "draft"}`}>
          {form.published ? "Publicado" : "Rascunho"}
        </span>
      </div>
      <Notice text={error} />
      <Notice text={success} success />
      {tab === "responses" ? (
        <Responses formId={form.id} />
      ) : (
        <fieldset disabled={busy} className="editor-layout">
          <div className="editor-content">
            <section className="panel form-settings">
              <h2>O começo da conversa</h2>
              <FormattedInput
                label="Título do formulário"
                value={form.title}
                maxLength={200}
                onChange={(title) => update({ title })}
              />
              <FormattedInput
                label="Descrição"
                value={form.description}
                maxLength={3000}
                onChange={(description) => update({ description })}
                multiline
              />
              {form.hasCover && (
                <img
                  className="editor-cover"
                  src={`/api/forms/${form.id}/cover?v=${coverVersion}`}
                  alt="Capa atual"
                />
              )}
              <label className="upload-zone">
                <Upload size={21} />
                <span>
                  {form.hasCover
                    ? "Trocar imagem de capa"
                    : "Adicionar imagem ou banner"}
                  <small>
                    Quadrada, vertical ou banner · JPG, PNG, WebP · até 4 MB
                  </small>
                </span>
                <input
                  className="sr-only"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    void upload(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            </section>
            {form.questions.map((q, index) => (
              <section className="panel question-editor" key={q.id}>
                <header>
                  <span className="question-number">
                    PERGUNTA {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="button-row">
                    <button
                      className="icon-button"
                      aria-label="Mover pergunta para cima"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Mover pergunta para baixo"
                      disabled={index === form.questions.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown size={16} />
                    </button>
                    <button
                      className="icon-button danger"
                      aria-label="Remover pergunta"
                      disabled={form.questions.length === 1}
                      onClick={() => {
                        if (
                          confirm(
                            "Remover esta pergunta? As respostas já enviadas serão preservadas.",
                          )
                        )
                          update({
                            questions: form.questions.filter(
                              (_, i) => index !== i,
                            ),
                          });
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </header>
                <FormattedInput
                  label="Pergunta"
                  value={q.title}
                  maxLength={300}
                  onChange={(title) => updateQuestion(index, { title })}
                />
                <FormattedInput
                  label="Descrição da pergunta"
                  value={q.description}
                  maxLength={2000}
                  onChange={(description) =>
                    updateQuestion(index, { description })
                  }
                  multiline
                />
                <label>
                  Tipo de resposta
                  <select
                    value={q.type}
                    onChange={(e) => {
                      const type = e.target.value as QuestionInput["type"];
                      updateQuestion(index, {
                        type,
                        options: ["SINGLE", "MULTIPLE"].includes(type)
                          ? q.options.length
                            ? q.options
                            : ["Opção 1", "Opção 2"]
                          : [],
                      });
                    }}
                  >
                    {Object.entries(kinds).map(([key, text]) => (
                      <option key={key} value={key}>
                        {text}
                      </option>
                    ))}
                  </select>
                </label>
                {["SINGLE", "MULTIPLE"].includes(q.type) && (
                  <div className="option-editor">
                    {q.options.map((option, i) => (
                      <div key={i}>
                        <span
                          className={
                            q.type === "SINGLE"
                              ? "option-circle"
                              : "option-square"
                          }
                        />
                        <input
                          aria-label={`Opção ${i + 1} da pergunta ${index + 1}`}
                          value={option}
                          maxLength={200}
                          onChange={(e) =>
                            updateQuestion(index, {
                              options: q.options.map((v, pos) =>
                                pos === i ? e.target.value : v,
                              ),
                            })
                          }
                        />
                        <button
                          className="icon-button"
                          disabled={q.options.length <= 2}
                          aria-label={`Remover opção ${i + 1}`}
                          onClick={() =>
                            updateQuestion(index, {
                              options: q.options.filter((_, pos) => pos !== i),
                            })
                          }
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    <button
                      className="text-button"
                      disabled={q.options.length >= 30}
                      onClick={() =>
                        updateQuestion(index, {
                          options: [
                            ...q.options,
                            `Opção ${q.options.length + 1}`,
                          ],
                        })
                      }
                    >
                      + Adicionar opção
                    </button>
                  </div>
                )}
                <footer>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={q.required}
                      onChange={(e) =>
                        updateQuestion(index, { required: e.target.checked })
                      }
                    />
                    Obrigatória
                  </label>
                  <label className="color-label">
                    Cor desta pergunta
                    <input
                      type="color"
                      value={q.color}
                      onChange={(e) =>
                        updateQuestion(index, { color: e.target.value })
                      }
                    />
                  </label>
                </footer>
              </section>
            ))}
            <button
              className="button add-question"
              disabled={form.questions.length >= 50}
              onClick={() =>
                update({
                  questions: [
                    ...form.questions,
                    {
                      id: crypto.randomUUID(),
                      title: "Nova pergunta",
                      description: "",
                      type: "SHORT",
                      required: false,
                      color: form.cardColor,
                      options: [],
                    },
                  ],
                })
              }
            >
              <Plus size={19} />
              Adicionar pergunta
            </button>
          </div>
          <aside className="editor-aside">
            <section className="panel">
              <span className="eyebrow">DO SEU JEITO</span>
              <h3>Aparência</h3>
              <p className="muted small-text">
                Escolha as cores do formulário.
              </p>
              {[
                ["background", "Fundo"],
                ["cardColor", "Cartão do título"],
                ["buttonColor", "Botão de envio"],
              ].map(([key, label]) => (
                <label className="palette-row" key={key}>
                  <span>{label}</span>
                  <input
                    type="color"
                    aria-label={label}
                    value={form[key as "background"]}
                    onChange={(e) => update({ [key]: e.target.value })}
                  />
                </label>
              ))}
              <p className="hint">
                O texto se adapta ao contraste da cor escolhida.
              </p>
            </section>
            <section className="panel">
              <span className="eyebrow">ABRA A CONVERSA</span>
              <h3>Compartilhamento</h3>
              <label className="checkbox-label publish-check">
                <input
                  type="checkbox"
                  checked={form.published}
                  onChange={(e) => update({ published: e.target.checked })}
                />
                Aceitar respostas
              </label>
              <p className="hint">
                Salve para aplicar. Qualquer pessoa com o link poderá responder,
                sem login.
              </p>
              <input
                className="share-input"
                aria-label="Link público"
                readOnly
                value={publicUrl}
                onFocus={(e) => e.target.select()}
              />
              <button className="button subtle full" onClick={copy}>
                <Link2 size={16} />
                Copiar link
              </button>
              {form.published && !dirty && (
                <a
                  href={`/f/${form.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-button public-link"
                >
                  Abrir formulário público ↗
                </a>
              )}
            </section>
          </aside>
        </fieldset>
      )}
      {preview && (
        <PreviewModal onClose={() => setPreview(false)}>
          <div className="preview-toolbar">
            <strong id="preview-title">
              Prévia · respostas não serão enviadas
            </strong>
            <button
              autoFocus
              className="button subtle"
              onClick={() => setPreview(false)}
            >
              <X size={17} />
              Fechar
            </button>
          </div>
          <div
            className="preview-scroll"
            style={{ background: form.background, color: ink(form.background) }}
          >
            <div className="public-container">
              <FormFields
                form={form}
                values={previewValues}
                onChange={setPreviewValues}
                coverUrl={
                  form.hasCover
                    ? `/api/forms/${form.id}/cover?v=${coverVersion}`
                    : undefined
                }
              />
            </div>
          </div>
        </PreviewModal>
      )}
    </>
  );
}
