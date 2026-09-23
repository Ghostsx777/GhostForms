import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { ChangePassword } from "@/components/change-password";
export default async function ChangePasswordPage() {
  const user = await getUser();
  if (!user) redirect("/");
  if (!user.mustChangePassword) redirect("/");
  return <ChangePassword />;
}
