import { notFound, redirect } from "next/navigation";
import { getUser, requireForm, HttpError } from "@/lib/auth";
import { Shell } from "@/components/ui";
import { Editor, type EditorForm } from "@/components/editor";
export default async function EditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/");
  if (user.mustChangePassword) redirect("/change-password");
  if (user.status !== "APPROVED") redirect("/pending");
  const { id } = await params;
  let form;
  try {
    form = (await requireForm(id)).form;
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
  const initial: EditorForm = {
    id: form.id,
    ownerName: form.owner.name,
    slug: form.slug,
    title: form.title,
    description: form.description,
    background: form.background,
    cardColor: form.cardColor,
    buttonColor: form.buttonColor,
    published: form.published,
    version: form.version,
    hasCover: !!form.cover,
    questions: form.questions.map((q) => ({
      id: q.id,
      title: q.title,
      description: q.description,
      type: q.type,
      required: q.required,
      color: q.color,
      options: q.options as string[],
    })),
  };
  return (
    <Shell
      user={{
        ...user,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      }}
      active="forms"
    >
      <Editor
        initial={initial}
        initialTab={
          (await searchParams).tab === "responses" ? "responses" : "edit"
        }
      />
    </Shell>
  );
}
