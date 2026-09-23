import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { Shell } from "@/components/ui";
import { AuthScreen } from "@/components/auth-screen";
import { Admin } from "@/components/admin";
export default async function MasterPage() {
  const user = await getUser();
  if (!user) return <AuthScreen master />;
  if (user.mustChangePassword) redirect("/change-password");
  if (user.status !== "APPROVED") redirect("/pending");
  if (user.role !== "MASTER") redirect("/dashboard");
  return (
    <Shell
      user={{
        ...user,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      }}
      active="admin"
    >
      <Admin />
    </Shell>
  );
}
