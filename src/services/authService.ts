import { prisma } from "../lib/prisma";
import { verifyPassword } from "../lib/password";
import { signAuthToken } from "../lib/jwt";
import { UnauthorizedError } from "../errors/AppError";

/**
 * Nunca distingue "correo no existe" de "contraseña incorrecta" en el
 * mensaje de error: revelarlo permitiria enumerar correos registrados.
 */
export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new UnauthorizedError("Correo o contraseña incorrectos");
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError("Correo o contraseña incorrectos");
  }

  const token = signAuthToken({ sub: user.id, role: user.role, tenantId: user.tenantId });

  return {
    token,
    user: { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId },
  };
}
