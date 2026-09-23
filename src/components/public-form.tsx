"use client";
import Link from "next/link";
import { useState } from "react";
import { Check, Ghost, ArrowRight } from "lucide-react";
import { api, message } from "@/lib/client";
import { validateAnswers, type Values } from "@/lib/validation";
import { FormFields, ink, type PublicFormDTO } from "./form-fields";
import { Notice } from "./ui";
export function PublicForm({ form }: { form: PublicFormDTO }) {
  const [values, setValues] = useState<Values>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      validateAnswers(form.questions, values);
      await api(`public/${form.slug}`, "POST", {
        version: form.version,
        answers: values,
      });
      setDone(true);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main
      className="public-page"
      style={{ backgroundColor: form.background, color: ink(form.background) }}
    >
      <div className="public-container">
        {done ? (
          <div
            className="confirmation"
            style={{ background: form.cardColor, color: ink(form.cardColor) }}
          >
            <span className="confirmation-icon">
              <Check size={30} />
            </span>
            <span className="eyebrow">MENSAGEM RECEBIDA</span>
            <h1>Obrigado por compartilhar.</h1>
            <p>Sua resposta foi enviada com sucesso.</p>
            <Ghost size={25} />
          </div>
        ) : (
          <form onSubmit={submit}>
            <FormFields
              form={form}
              values={values}
              onChange={setValues}
              coverUrl={
                form.hasCover ? `/api/public/${form.slug}/cover` : undefined
              }
            />
            <Notice text={error} />
            <button
              className="button primary full submit-answer"
              disabled={busy}
              style={{
                background: form.buttonColor,
                color: ink(form.buttonColor),
              }}
            >
              {busy ? "Enviando…" : "Enviar resposta"}
              <ArrowRight size={18} />
            </button>
          </form>
        )}
        <div className="public-invitation">
          <span>Suas perguntas também merecem um espaço.</span>
          <Link href="/?mode=register">
            Criar conta no GhostForms <ArrowRight size={14} />
          </Link>
        </div>
        <footer className="public-footer">
          <img
            className="public-footer-logo"
            src="/brand/ghost.png"
            alt=""
            width={28}
            height={28}
          />
          <span>Criado com GhostForms</span>
        </footer>
      </div>
    </main>
  );
}
