import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { AuthScreen } from "@/components/auth-screen";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const user = await getUser();
  if (user)
    redirect(
      user.mustChangePassword
        ? "/change-password"
        : user.status !== "APPROVED"
          ? "/pending"
          : user.role === "MASTER"
            ? "/master-admin"
            : "/dashboard",
    );
  return (
    <AuthScreen initialRegister={(await searchParams).mode === "register"} />
  );
}
