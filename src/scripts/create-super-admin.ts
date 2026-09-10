/**
 * Crea el primer usuario SUPER_ADMIN. Nadie puede crearlo vía API (todas las
 * rutas de gestion de tenants ya exigen ser SUPER_ADMIN) — este script es el
 * unico punto de entrada para arrancar una instalacion nueva de Parko.
 *
 * Uso (dev):  SUPER_ADMIN_EMAIL=... SUPER_ADMIN_PASSWORD=... npm run create-super-admin
 * Uso (prod): SUPER_ADMIN_EMAIL=... SUPER_ADMIN_PASSWORD=... node dist/scripts/create-super-admin.js
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error("Faltan SUPER_ADMIN_EMAIL y/o SUPER_ADMIN_PASSWORD en el entorno.");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("SUPER_ADMIN_PASSWORD debe tener al menos 8 caracteres.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.error(`Ya existe un usuario con el correo "${email}".`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, role: "SUPER_ADMIN", tenantId: null },
  });

  console.log(`SUPER_ADMIN creado: ${user.email} (id: ${user.id})`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
