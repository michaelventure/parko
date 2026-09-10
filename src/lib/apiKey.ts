import crypto from "crypto";

const PREFIX_BYTES = 6; // 12 caracteres hex, visible/indexado en DB
const SECRET_BYTES = 24; // 48 caracteres hex, nunca se guarda en claro

/**
 * Genera una nueva API key con el formato pk_<prefix>_<secret>. El prefix
 * es de alta entropia pero se guarda en claro para poder buscar la fila en
 * DB; el secret solo se guarda hasheado (SHA-256 — a diferencia de una
 * contraseña humana, un secreto de 192 bits ya es imposible de fuerza
 * bruta sin necesitar un hash lento tipo bcrypt).
 */
export function generateApiKey() {
  const prefix = crypto.randomBytes(PREFIX_BYTES).toString("hex");
  const secret = crypto.randomBytes(SECRET_BYTES).toString("hex");
  const fullKey = `pk_${prefix}_${secret}`;
  const keyHash = hashSecret(secret);
  return { fullKey, prefix, keyHash };
}

export function hashSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

/** Parsea "pk_<prefix>_<secret>"; null si el formato no coincide. */
export function parseApiKey(fullKey: string): { prefix: string; secret: string } | null {
  const match = /^pk_([0-9a-f]{12})_([0-9a-f]{48})$/.exec(fullKey);
  if (!match) {
    return null;
  }
  return { prefix: match[1], secret: match[2] };
}

/** Comparacion en tiempo constante para no filtrar el hash por timing. */
export function secretMatchesHash(secret: string, keyHash: string): boolean {
  const computed = Buffer.from(hashSecret(secret), "hex");
  const stored = Buffer.from(keyHash, "hex");
  if (computed.length !== stored.length) {
    return false;
  }
  return crypto.timingSafeEqual(computed, stored);
}
