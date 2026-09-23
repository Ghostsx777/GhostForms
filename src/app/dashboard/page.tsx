import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { Shell } from "@/components/ui";
import { Dashboard } from "@/components/dashboard";
export default async function DashboardPage() {
  const user = await getUser();
  if (!user) redirect("/");
  if (user.mustChangePassword) redirect("/change-password");
  if (user.status !== "APPROVED") redirect("/pending");
  return (
    <Shell
      user={{
        ...user,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      }}
      active="forms"
    >
      <Dashboard />
    </Shell>
  );
}
