"use client";
import type { CSSProperties } from "react";
import type { QuestionInput, Values } from "@/lib/validation";
import { BoldText } from "./ui";
export function ink(hex: string) {
  const values = [1, 3, 5]
    .map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722 > 0.179
    ? "#10131a"
    : "#f5f7fa";
}
export type PublicFormDTO = {
  ownerName: string;
  title: string;
  description: string;
  slug: string;
  version: number;
  background: string;
  cardColor: string;
  buttonColor: string;
  hasCover: boolean;
  questions: QuestionInput[];
};
export function FormFields({
  form,
  values,
  onChange,
  coverUrl,
}: {
  form: PublicFormDTO;
  values: Values;
  onChange: (values: Values) => void;
  coverUrl?: string;
}) {
  const theme = (color: string): CSSProperties =>
    ({
      backgroundColor: color,
      color: ink(color),
      "--field-ink": ink(color),
    }) as CSSProperties;
  return (
    <>
      <header
        className="public-card public-title"
        style={theme(form.cardColor)}
      >
        <span className="eyebrow">GHOSTFORMS / FORMULÁRIO</span>
        <h1>
          <BoldText text={form.title} />
        </h1>
        {form.description && (
          <p className="preserve">
            <BoldText text={form.description} />
          </p>
        )}
        <p className="form-author">
          Por <strong>{form.ownerName}</strong>
        </p>
        {coverUrl && (
          <img className="public-cover" src={coverUrl} alt="Imagem do formulário" />
        )}
        <small>* indica uma pergunta obrigatória</small>
      </header>
      {form.questions.map((q, index) => (
        <fieldset
          className="public-card question-field"
          style={theme(q.color)}
          key={q.id}
        >
          <legend className="sr-only">{q.title}</legend>
          <label className="question-label" htmlFor={`answer-${q.id}`}>
            <span className="question-index">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span>
              <BoldText text={q.title} />
              {q.required && <span aria-hidden="true"> *</span>}
            </span>
          </label>
          {q.description && (
            <p className="question-description preserve">
              <BoldText text={q.description} />
            </p>
          )}
          {q.type === "SHORT" && (
            <input
              id={`answer-${q.id}`}
              className="answer-input"
              required={q.required}
              maxLength={500}
              placeholder="Sua resposta"
              value={String(values[q.id] ?? "")}
              onChange={(e) => onChange({ ...values, [q.id]: e.target.value })}
            />
          )}
          {q.type === "LONG" && (
            <textarea
              id={`answer-${q.id}`}
              className="answer-input"
              rows={4}
              required={q.required}
              maxLength={10000}
              placeholder="Escreva sua resposta aqui…"
              value={String(values[q.id] ?? "")}
              onChange={(e) => onChange({ ...values, [q.id]: e.target.value })}
            />
          )}
          {["SINGLE", "MULTIPLE"].includes(q.type) && (
            <div className="choices">
              {q.type === "MULTIPLE" && q.required && (
                <small>Escolha pelo menos uma opção.</small>
              )}
              {q.options.map((option, i) => (
                <label className="choice" key={i}>
                  <input
                    type={q.type === "SINGLE" ? "radio" : "checkbox"}
                    name={q.id}
                    required={q.type === "SINGLE" && q.required}
                    checked={
                      q.type === "SINGLE"
                        ? values[q.id] === option
                        : (Array.isArray(values[q.id]) &&
                            (values[q.id] as string[]).includes(option)) ||
                          false
                    }
                    onChange={(e) => {
                      if (q.type === "SINGLE")
                        onChange({ ...values, [q.id]: option });
                      else {
                        const list = Array.isArray(values[q.id])
                          ? (values[q.id] as string[])
                          : [];
                        onChange({
                          ...values,
                          [q.id]: e.target.checked
                            ? [...list, option]
                            : list.filter((v) => v !== option),
                        });
                      }
                    }}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
      ))}
    </>
  );
}
