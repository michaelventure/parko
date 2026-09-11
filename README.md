# Parko — Parqueo por Hora

Sistema de parqueo por hora **multi-tenant**: cada municipio o empresa
(tenant) gestiona su propia tarifa, capacidad y usuarios, sobre la misma
plataforma. El frontend público está pensado para que lo use cualquier
persona, sin importar su edad o nivel de manejo de tecnología. El usuario
indica cuantas horas quiere estacionar; el precio se calcula **siempre en el
servidor** (tarifa activa del tenant × horas, con tope diario) y el ticket
solo pasa a estado `PAID` despues de verificar el pago con Stripe.

## Garantías de diseño

1. **El precio no se puede manipular desde el cliente.** El body de
   `POST /api/tickets` solo acepta `tenantSlug`, `hours` y opcionalmente
   `plate`. El monto (`amountCents`) se calcula en
   [`src/services/pricing.ts`](src/services/pricing.ts) usando la tarifa
   activa **de ese tenant**, leída de la base de datos — nunca un precio
   enviado por el cliente.
2. **Un ticket solo queda `PAID` tras verificar la sesión con Stripe.**
   El webhook (`src/routes/webhooks.ts`) valida la firma HMAC del evento
   (`stripe.webhooks.constructEvent`) y, además, vuelve a consultar la
   sesión directamente contra la API de Stripe (`checkout.sessions.retrieve`)
   confiando solo en el `payment_status` de esa respuesta antes de marcar el
   ticket como pagado. Es idempotente ante reintentos del mismo evento.
3. **Nada está hardcodeado.** La tarifa (precio/hora, tope diario, moneda) y
   la capacidad (espacios totales) viven en la base de datos y se gestionan
   vía API — nunca en el código.
4. **Aislamiento entre tenants.** Toda fila de `Tariff`, `Capacity` y
   `Ticket` pertenece a un `tenantId`. Las rutas administrativas siempre
   derivan el tenant de la sesión autenticada (`req.auth.tenantId`), nunca de
   un valor enviado por el cliente — un Admin de Tenant no puede leer ni
   modificar datos de otro tenant, ni adivinando IDs.

## Modelo de roles

| Rol | Alcance | Puede |
|---|---|---|
| `SUPER_ADMIN` (Admin General) | Toda la plataforma, ningun tenant propio | Crear/suspender/reactivar tenants |
| `TENANT_ADMIN` (Admin de Tenant) | Su propio tenant | Gestionar tarifa, capacidad y usuarios de su tenant |
| `TENANT_USER` (Usuario) | Su propio tenant | Ver tickets/disponibilidad, crear tickets y cobros — no toca tarifa, capacidad ni usuarios |

Autenticación: correo + contraseña (`bcrypt`) para sesiones humanas, o una
**API key** (`pk_...`) para agentes/integraciones — ambas se mandan en el
mismo header `Authorization: Bearer <credencial>` y llevan el rol y el
`tenantId` codificados; nunca se confía en un tenant enviado por el cliente
para autorizar una accion administrativa.

### API keys (para agentes/integraciones, ej. un servidor MCP)

Un `TENANT_ADMIN` o `SUPER_ADMIN` crea las suyas — no hay login interactivo
para máquinas:

```bash
curl -X POST http://localhost:3000/api/api-keys -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" -d '{"name":"Servidor MCP"}'
# -> { "key": "pk_...", ... }  el valor completo solo se muestra esta vez
```

La key hereda el rol de quien la crea (nunca se puede pedir una de mayor
alcance) y se puede revocar en cualquier momento con
`DELETE /api/api-keys/:id`. Solo se guarda el hash del secreto — igual que
las contraseñas, no se puede recuperar el valor completo después de creada.

### Rate limiting

`express-rate-limit`, en memoria (sin infraestructura nueva):

- Login, crear ticket y crear sesión de checkout: **10/min por IP** (evita fuerza bruta y agentes en bucle).
- Resto de la API: **100/min** como red de seguridad general.
- Respuesta homologada: `429` con `{ "error": { "code": "RATE_LIMITED", ... } }`.

## Stack

- Node.js + Express + TypeScript
- PostgreSQL (Docker) + Prisma ORM
- `bcrypt` + `jsonwebtoken` (autenticación)
- Stripe Checkout (modo "payment")
- Zod (validación) · Pino (logging) · Swagger UI (`/docs`)
- Frontend: HTML + CSS + JavaScript plano (sin frameworks ni build step),
  servido como archivos estáticos por el mismo Express (carpeta [`public/`](public))

## Frontend público (`public/`)

Pantalla única pensada para uso masivo — desde un adolescente hasta una
persona mayor de 70 años, con o sin experiencia en tecnología:

- **Botones grandes tipo tarjeta** para elegir el tiempo (30 min a todo el
  día) en vez de escribir números — reduce errores y no requiere saber
  calcular precios.
- **Texto grande (mínimo 18px), alto contraste y foco muy visible**, siguiendo
  los mismos principios de accesibilidad que usan portales de gobierno
  (ej. GOV.UK Design System): esto es clave para que ayuntamientos y
  entidades públicas puedan adoptarlo.
- **Compatible con lector de pantalla y navegación por teclado** (roles ARIA,
  `aria-pressed`, `aria-live` en el resumen de precio y errores).
- **Responsive mobile-first** (la mayoría accederá desde el celular) y
  respeta modo oscuro/claro del sistema y "reducir movimiento".
- **Sin dependencias externas ni CDNs**: carga rápido incluso en conexiones
  lentas o celulares antiguos, y funciona igual en un kiosco público.
- Placa del vehículo es **opcional**: no bloquea a alguien que no la tenga a mano.
- Páginas de resultado (`/success.html`, `/cancel.html`) muestran el estado
  real del ticket consultando la API — nunca confían en la URL de retorno de
  Stripe como prueba de pago.

Este frontend es independiente de la API: cualquier empresa o municipio puede
integrar sus propios canales (app móvil, kiosco, sitio propio) contra la
misma API REST documentada en `/docs`.

## Requisitos

- Node.js 20+
- Docker y Docker Compose
- Una cuenta de Stripe en modo test y el [Stripe CLI](https://docs.stripe.com/stripe-cli) (para reenviar webhooks en local)

## Puesta en marcha (desarrollo local)

```bash
cp .env.example .env
# Edita .env: STRIPE_SECRET_KEY, JWT_SECRET (openssl rand -base64 32),
# y SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD para el paso 4.

# 1. Levantar solo la base de datos en Docker
docker compose up -d db

# 2. Instalar dependencias y generar el cliente de Prisma
npm install
npx prisma migrate dev --name init

# 3. En otra terminal, reenviar webhooks de Stripe a tu servidor local
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# Copia el whsec_... que imprime y colócalo en STRIPE_WEBHOOK_SECRET dentro de .env

# 4. Levantar la API
npm run dev

# 5. Crear el primer Admin General (una sola vez; nadie puede crearlo via API)
npm run create-super-admin
```

El **frontend público** queda en `http://localhost:3000/`, la API en
`http://localhost:3000/api`, y la documentación interactiva en
`http://localhost:3000/docs`.

## Puesta en marcha (todo en Docker)

```bash
cp .env.example .env
# Edita .env con tus claves de Stripe reales
docker compose up --build
```

`docker-compose.yml` levanta Postgres y la API, y corre las migraciones
(`prisma migrate deploy`) automáticamente al iniciar el contenedor `api`.

## Flujo de uso

### 1. Admin General: crear un tenant (una sola vez por cliente)

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$SUPER_ADMIN_EMAIL\",\"password\":\"$SUPER_ADMIN_PASSWORD\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

curl -X POST http://localhost:3000/api/tenants \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Ayuntamiento Demo","slug":"demo","adminEmail":"admin@demo.parko.dev","adminPassword":"una-contraseña-segura"}'
```

### 2. Admin de Tenant: configurar tarifa, capacidad y usuarios

```bash
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.parko.dev","password":"una-contraseña-segura"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

curl -X POST http://localhost:3000/api/tariffs -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Tarifa estandar","ratePerHourCents":100,"dailyMaxCents":800,"currency":"usd"}'

curl -X POST http://localhost:3000/api/capacity -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" -d '{"totalSpaces":40}'

curl -X POST http://localhost:3000/api/users -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"operador@demo.parko.dev","password":"otra-contraseña","role":"TENANT_USER"}'
```

### 3. Publico: elegir horas y pagar (sin sesion)

La forma más simple es abrir `http://localhost:3000/` (la meta tag
`parko-tenant` en `index.html` define a qué tenant apunta esa página) y
pagar — la interfaz hace exactamente estos mismos pasos:

```bash
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"tenantSlug":"demo","hours":3,"plate":"A123456"}'
# -> { "id": "...", "amountCents": 300, "status": "PENDING_PAYMENT", ... }

curl -X POST http://localhost:3000/api/tickets/<ticketId>/checkout-session
# -> { "checkoutUrl": "https://checkout.stripe.com/...", "sessionId": "cs_..." }
```

Abre `checkoutUrl` en el navegador y paga con una [tarjeta de prueba de Stripe](https://docs.stripe.com/testing) (ej. `4242 4242 4242 4242`). Con `stripe listen` corriendo, el webhook marca el ticket como `PAID` solo si Stripe confirma `payment_status: "paid"`, y ahí mismo se revisa si el tenant entró en sobrecupo.

```bash
curl http://localhost:3000/api/tickets/<ticketId>
# -> { "status": "PAID", "paidAt": "...", ... }
```

## Servidor MCP (`/mcp`)

Parko expone sus tools vía [MCP](https://modelcontextprotocol.io) en
`POST /mcp` (JSON-RPC sobre HTTP, sin estado — no requiere `stdio` ni correr
nada localmente). Una sola URL para todo el mundo; el rol de cada quien lo
decide **su propia API key**:

| Credencial | Tools que ve |
|---|---|
| Ninguna | Consulta (4) + Transaccional (2) — igual que el formulario público |
| API key de un `TENANT_ADMIN` | + tarifa, capacidad y usuarios de **su** tenant (7) |
| API key del `SUPER_ADMIN` | Solo gestión de tenants (4) |

```bash
# Conectar un cliente MCP (Claude Desktop, etc.) a:
https://parko-ge6k.onrender.com/mcp
# Header: Authorization: Bearer pk_...   (opcional — omitelo para acceso publico)
```

No hay tool de `login`, ni de crear/listar API keys — esas quedan como
acción humana directa contra la API (`POST /api-keys`), para que el secreto
nunca viaje dentro de la conversación de un agente. Ver
`src/mcp/` para la implementación (cada request crea un `McpServer` nuevo,
registra solo las tools que corresponden a la key presentada, y lo descarta
al terminar — así el contexto de un tenant nunca se filtra a otro).

> **Nota de compatibilidad:** `@modelcontextprotocol/sdk` está fijado en
> `1.22.0` (sin `^`) a propósito. Versiones `1.23.0+` agregan soporte dual
> zod v3/v4 que, combinado con `zod@3.25+`, dispara
> `TS2589: Type instantiation is excessively deep` de forma reproducible
> incluso en el ejemplo más mínimo. No actualizar sin verificar que ese bug
> ya se resolvió.

## Códigos de respuesta HTTP

| Código | Cuándo |
|---|---|
| 200 | Lectura u operación exitosa sobre un recurso existente |
| 201 | Recurso creado (ticket, tarifa, sesión de checkout, API key) |
| 204 | Eliminación/revocación exitosa, sin contenido (ej. revocar una API key) |
| 400 | Validación de entrada fallida (`VALIDATION_ERROR`) |
| 401 | No hay sesión válida: falta el token/API key, es inválido o expiró (`UNAUTHORIZED`) |
| 403 | Hay sesión válida, pero el rol o el tenant no tiene permiso (`FORBIDDEN`) — ej. un `TENANT_USER` intentando cambiar la tarifa, o un tenant tocando datos de otro |
| 404 | Recurso no encontrado (`NOT_FOUND`) — incluye "no hay tarifa activa" |
| 409 | Conflicto de estado, ej. intentar cobrar un ticket ya pagado (`CONFLICT`) |
| 429 | Demasiadas solicitudes en poco tiempo (`RATE_LIMITED`) |
| 500 | Error interno no controlado (`INTERNAL_ERROR`), sin exponer detalles internos |

Todos los errores usan el mismo formato:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": {} } }
```

## Datos sensibles

- El servidor **nunca** toca datos de tarjeta: Stripe Checkout es una página
  hospedada por Stripe (fuera del alcance PCI de esta API).
- Las contraseñas se guardan con `bcrypt` (nunca en texto plano); el login
  nunca revela si el correo existe o la contraseña es incorrecta (mismo
  mensaje genérico) para no permitir enumerar cuentas.
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `JWT_SECRET` y `DATABASE_URL`
  solo viven en variables de entorno (`.env`, ignorado por git).
- El logger (`pino`) redacta headers sensibles (`authorization`, `cookie`); el body de las peticiones (con contraseñas) no se registra en los logs.
- Los errores 500 no filtran stack traces ni mensajes internos al cliente.
- Todas las rutas administrativas derivan el `tenantId` de la sesión
  (`req.auth.tenantId`), nunca de un valor enviado por el cliente — evita que
  un tenant lea o modifique datos de otro adivinando IDs.

## Tests

```bash
npm test
```

Cubre la función pura de cálculo de precio (`calculateAmountCents`): tarifa ×
horas, aplicación del tope diario y consistencia del resultado.

## Fuera de alcance por ahora

- **Panel de administración (UI web)**: hoy la gestión de tenants, tarifa,
  capacidad y usuarios se hace por API/`curl`/Swagger. El próximo paso es un
  panel accesible (mismo estándar que el frontend público) para que un
  Admin de Tenant no técnico pueda operar sin la terminal.
- **Selector de tenant en el frontend público**: cada despliegue de
  `public/index.html` apunta a un tenant fijo (meta tag `parko-tenant`). Una
  página que liste/elija entre varios tenants (ej. un directorio de
  parqueos por ciudad) no está construida todavía.
- Ideas de la tesis PARKO que quedan para más adelante: sensores IoT de
  disponibilidad (hoy es una aproximación por tickets pagados, ver
  "Cómo se define ocupado" en el mapa de MCP), reservas anticipadas,
  suscripciones premium, app móvil nativa.
