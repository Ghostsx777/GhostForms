import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { registerSchema } from "../src/lib/validation";
const db = new PrismaClient();
async function main() {
  const input = registerSchema.parse({
    name: process.env.ADMIN_NAME || "Admin Master",
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });
  // Nunca promove uma conta pública existente por coincidência de e-mail.
  if (await db.user.findUnique({ where: { email: input.email } }))
    throw new Error(
      "E-mail já cadastrado. Use um e-mail exclusivo para o master.",
    );
  await db.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: "MASTER",
      status: "APPROVED",
    },
  });
  console.log(
    "Administrador master criado. Remova ADMIN_PASSWORD do ambiente.",
  );
}
main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : "Falha ao criar master.");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
