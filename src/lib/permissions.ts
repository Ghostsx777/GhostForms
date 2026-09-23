export function canManage(
  user: { id: string; role: string; status: string },
  ownerId: string,
) {
  return (
    user.status === "APPROVED" &&
    (user.id === ownerId || user.role === "MASTER")
  );
}
