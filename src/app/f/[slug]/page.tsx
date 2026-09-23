import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PublicForm } from "@/components/public-form";
export const dynamic = "force-dynamic";
export default async function PublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const form = await db.form.findFirst({
    where: { slug, published: true, owner: { status: "APPROVED" } },
    select: {
      owner: { select: { name: true } },
      title: true,
      description: true,
      slug: true,
      version: true,
      background: true,
      cardColor: true,
      buttonColor: true,
      cover: { select: { formId: true } },
      questions: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          type: true,
          required: true,
          color: true,
          options: true,
        },
      },
    },
  });
  if (!form) notFound();
  const { cover, questions, owner, ...publicData } = form;
  return (
    <PublicForm
      form={{
        ...publicData,
        ownerName: owner.name,
        hasCover: !!cover,
        questions: questions.map((q) => ({
          ...q,
          options: q.options as string[],
        })),
      }}
    />
  );
}
