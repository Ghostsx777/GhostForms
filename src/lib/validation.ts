import { z } from "zod";
export const colorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use uma cor hexadecimal válida.");
export const questionSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().trim().min(1).max(300),
    description: z.string().max(2000),
    type: z.enum(["SHORT", "LONG", "SINGLE", "MULTIPLE"]),
    required: z.boolean(),
    color: colorSchema,
    options: z.array(z.string().trim().min(1).max(200)).max(30),
  })
  .strict()
  .superRefine((q, ctx) => {
    if (
      ["SINGLE", "MULTIPLE"].includes(q.type) &&
      (q.options.length < 2 || new Set(q.options).size !== q.options.length)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Inclua de 2 a 30 opções diferentes.",
        path: ["options"],
      });
    }
  });
export const formSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().max(3000),
    background: colorSchema,
    cardColor: colorSchema,
    buttonColor: colorSchema,
    published: z.boolean(),
    version: z.number().int().positive(),
    questions: z.array(questionSchema).min(1).max(50),
  })
  .strict()
  .refine(
    (data) =>
      new Set(data.questions.map((q) => q.id)).size === data.questions.length,
    "Perguntas duplicadas.",
  );
export const credentialsSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(12).max(128),
});
export const registerSchema = credentialsSchema
  .extend({ name: z.string().trim().min(2).max(100) })
  .strict();
export const loginSchema = credentialsSchema
  .extend({ master: z.boolean().optional() })
  .strict();
export const submissionSchema = z
  .object({
    version: z.number().int().positive(),
    answers: z.record(
      z.string(),
      z.union([z.string().max(10000), z.array(z.string().max(200)).max(30)]),
    ),
  })
  .strict();
export type QuestionInput = z.infer<typeof questionSchema>;
export type FormInput = z.infer<typeof formSchema>;
export type Values = z.infer<typeof submissionSchema>["answers"];
export function validateAnswers(
  questions: Pick<
    QuestionInput,
    "id" | "title" | "type" | "required" | "options"
  >[],
  values: Values,
) {
  if (Object.keys(values).some((id) => !questions.some((q) => q.id === id)))
    throw new Error("Há respostas para perguntas desconhecidas.");
  return questions.map((q, position) => {
    const value = values[q.id] ?? (q.type === "MULTIPLE" ? [] : "");
    const multi = q.type === "MULTIPLE";
    if (multi !== Array.isArray(value))
      throw new Error(`Formato inválido: ${q.title}`);
    const empty = Array.isArray(value) ? value.length === 0 : !value.trim();
    if (q.required && empty) throw new Error(`Responda: ${q.title}`);
    if (Array.isArray(value)) {
      if (
        new Set(value).size !== value.length ||
        value.some((v) => !q.options.includes(v))
      )
        throw new Error("Opção inválida.");
    } else if (q.type === "SINGLE") {
      if (value && !q.options.includes(value))
        throw new Error("Opção inválida.");
    } else if (value.length > (q.type === "SHORT" ? 500 : 10000))
      throw new Error("Resposta muito longa.");
    return {
      questionId: q.id,
      questionTitle: q.title,
      questionType: q.type,
      position,
      value,
    };
  });
}
