import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { Pending } from "@/components/pending";
export default async function PendingPage() {
  const user = await getUser();
  if (!user) redirect("/");
  if (user.mustChangePassword) redirect("/change-password");
  if (user.status === "APPROVED") redirect("/dashboard");
  return <Pending rejected={user.status === "REJECTED"} />;
}
