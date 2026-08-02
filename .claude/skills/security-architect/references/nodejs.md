# Node.js Security Checklist

Apply these checks in addition to the OWASP Top 10 baseline when reviewing
Node.js code. Covers Express, Fastify, NestJS, plain Node HTTP, and common
ecosystem patterns (Prisma, Mongoose, Sequelize, Passport, jose/jsonwebtoken).

---

## A03 – Injection

### SQL / NoSQL Injection
- [ ] No string concatenation into SQL — use parameterized queries
      (`?` placeholders or named params via `pg`, `mysql2`, `knex`, etc.)
- [ ] MongoDB / Mongoose: user input not spread directly into query objects —
      `{ username: req.body.username }` is safe, but `req.body` spread into
      `find(req.body)` enables operator injection (`{ $gt: "" }`) → Sev 1
- [ ] Mongoose: `sanitize-mongo-query` or manual stripping of `$` prefixed keys
      from user input before query execution
- [ ] ORM raw queries: `sequelize.query(sql, { replacements })` or `prisma.$queryRaw`
      with tagged template literals — never `prisma.$queryRawUnsafe(userInput)`

**Sev 1 – Prisma raw query pattern:**
```typescript
// BAD
const result = await prisma.$queryRawUnsafe(
  `SELECT * FROM users WHERE id = ${userId}`
);

// GOOD — tagged template (Prisma parameterizes automatically)
const result = await prisma.$queryRaw`
  SELECT * FROM users WHERE id = ${userId}
`;
```

### Command Injection
- [ ] `child_process.exec()` with user input → Sev 1 (shell interprets metacharacters)
      Prefer `execFile()` or `spawn()` with argument arrays
- [ ] `child_process.execSync()` with any non-literal string → Sev 1
- [ ] `shell: true` in `spawn()` options + user-controlled args → Sev 1

### Code Injection
- [ ] `eval()` with non-literal input → Sev 1
- [ ] `new Function(userInput)` → Sev 1
- [ ] `vm.runInNewContext()` / `vm.runInThisContext()` with user data → Sev 1
- [ ] Template engines: user-controlled strings passed to `ejs.render()`,
      `pug.compile()`, `handlebars.compile()` → Sev 1

### Path Traversal
- [ ] `fs.readFile`, `fs.createReadStream`, `path.join` with user-supplied paths
      must be validated against a base directory using `path.resolve()` +
      `.startsWith(baseDir)` check
- [ ] `..` sequences not stripped from user-supplied filenames → Sev 1
- [ ] `express.static()` / `res.sendFile()` serving paths that include user input
      checked with `path.normalize()` and prefix validation

### ReDoS (Regular Expression DoS)
- [ ] User-supplied strings not passed to regexes with catastrophic backtracking
      patterns (nested quantifiers: `(a+)+`, `(.+)+`)
- [ ] Flag use of `new RegExp(userInput)` without input validation → Sev 2

---

## A02 – Cryptographic Failures

- [ ] Passwords hashed with `bcrypt` (cost >= 12) or `argon2` —
      never `crypto.createHash('md5')` or `'sha1'`
- [ ] `crypto.randomBytes(32)` used for tokens, nonces, session IDs —
      never `Math.random()` → Sev 1 for security-sensitive use
- [ ] JWT secrets loaded from environment variables, not hardcoded
- [ ] `.env` file in `.gitignore` — flag if `dotenv` is used and `.env` or
      `.env.production` appears committed to source control → Sev 1
- [ ] HTTPS enforced in production — plain `http.createServer()` in prod → Sev 2
- [ ] `jsonwebtoken` / `jose`: algorithm explicitly specified —
      `jwt.verify(token, secret)` without `algorithms` option enables `alg:none`
      attack → Sev 1

**Sev 1 – jsonwebtoken alg:none:**
```javascript
// BAD — no algorithm restriction
jwt.verify(token, secret);

// GOOD
jwt.verify(token, secret, { algorithms: ['HS256'] });
```

---

## A05 – Security Misconfiguration

- [ ] `helmet` middleware installed and applied early in the pipeline:
```javascript
app.use(helmet()); // X-Content-Type-Options, X-Frame-Options, HSTS, etc.
```
- [ ] Express `x-powered-by` disabled (`app.disable('x-powered-by')` or via helmet)
- [ ] CORS: explicit origin allowlist — never `origin: '*'` with `credentials: true`
- [ ] Error handler middleware does NOT send `err.stack` or internal paths to client
      in production (guard with `process.env.NODE_ENV === 'production'`)
- [ ] `NODE_ENV=production` set in production — Express and many libs change
      behavior (disable verbose errors, enable caching, etc.)
- [ ] `trust proxy` setting correct if behind a reverse proxy (for accurate IP
      in rate limiters and logs); but `app.set('trust proxy', true)` without a
      specific count/IP is Sev 2 (IP spoofing via X-Forwarded-For)
- [ ] Body parser limits configured — no unbounded `limit: '50mb'` unless justified:
```javascript
app.use(express.json({ limit: '1mb' }));
```

**Fastify specific:**
- [ ] `fastify({ logger: true })` — ensure logger does not serialize sensitive
      request body fields (configure `redact` option)
- [ ] `fastify-helmet` plugin registered
- [ ] Schema validation (`schema: { body: { ... } }`) on all routes that accept
      input — Fastify uses ajv for validation + serialization safety

---

## A01 – Broken Access Control

- [ ] Auth middleware applied before route handlers that touch user data
- [ ] User ID for data access comes from `req.user` (set by Passport / auth
      middleware) — never from `req.body.userId` or `req.params.id` alone
- [ ] Admin routes have explicit role-check middleware separate from auth check
- [ ] `req.user` populated from verified JWT claims server-side; client cannot
      influence it by passing a `user` key in the body

**Express router ordering — flag if incorrect:**
```javascript
// CORRECT
router.use(authMiddleware);       // auth first
router.get('/profile', handler);  // then route

// BAD — auth after route (handler runs unauthenticated)
router.get('/profile', handler);
router.use(authMiddleware);
```

---

## A07 – Authentication Failures

- [ ] Rate limiting on `/login`, `/register`, `/forgot-password`, `/reset-password`
      (`express-rate-limit` or `fastify-rate-limit`)
- [ ] `express-session`: `httpOnly: true`, `secure: true` (in production),
      `sameSite: 'strict'` or `'lax'`, `resave: false`, `saveUninitialized: false`
- [ ] Session secret loaded from environment variable — not hardcoded
- [ ] `bcrypt.compare()` for password verification — never `===` string equality
- [ ] Passport.js: `serializeUser` / `deserializeUser` do not expose sensitive
      fields — check what's stored in session
- [ ] Password reset: token is single-use, short-lived (< 15 min), and invalidated
      after use or on new request

---

## A06 – Vulnerable and Outdated Components

- [ ] `package.json` does not pin versions with known CVEs
- [ ] `npm audit` output: flag any critical/high items
- [ ] No packages with last publish > 3 years and 0 active maintainers
- [ ] `node_modules` not committed to source control
- [ ] `.npmrc` does not contain `_authToken` or registry credentials committed
      to source control → Sev 1

---

## A08 – Prototype Pollution

- [ ] `JSON.parse()` of user input used as object: check for `__proto__`,
      `constructor`, `prototype` key presence before property access
- [ ] `_.merge()`, `_.extend()`, `_.defaultsDeep()` with user-controlled objects
      — prototype pollution if lodash < 4.17.21
- [ ] `Object.assign({}, userObj)` without sanitization — can pollute if
      `userObj` contains `__proto__`
- [ ] `qs` library: `allowPrototypes: false` (default) not overridden

---

## A09 – Security Logging

- [ ] Passwords, tokens, credit card numbers not logged — check Morgan format
      strings and Winston/Pino field serializers
- [ ] Pino `redact` option configured for sensitive paths:
```javascript
pino({ redact: ['req.headers.authorization', 'body.password'] })
```
- [ ] Correlation / request IDs in logs for traceability (`req.id` in Fastify,
      or custom middleware in Express)

---

## A10 – SSRF

- [ ] `fetch()`, `axios`, `http.request()` with user-supplied URLs validated
      against an explicit domain allowlist
- [ ] Requests to `169.254.169.254` (AWS metadata), `fd00:ec2::254`,
      `localhost`, `127.x`, RFC-1918 ranges blocked → Sev 1
- [ ] DNS rebinding: resolved IP validated (not just the hostname) for
      outbound requests — use `dns.lookup()` result in the allowlist check

---

## NestJS-Specific

- [ ] `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true`
      applied globally — prevents mass assignment and extra-field injection:
```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
}));
```
- [ ] Guards (`@UseGuards`) applied at controller or handler level — not just
      at the module level where it might be accidentally bypassed
- [ ] `@Body()` DTOs annotated with `class-validator` decorators — plain object
      params without validation are flagged as Sev 2
- [ ] `@Roles()` decorator paired with a `RolesGuard` that checks `req.user.roles`
      from the JWT, not a request body field
- [ ] Exception filters do not expose internal NestJS error details in production
- [ ] `ConfigModule` with `validationSchema` (Joi/class-validator) used to
      validate required env vars at startup — missing secrets fail fast rather
      than silently using `undefined`
- [ ] Interceptors that log request/response data configured to redact sensitive fields
- [ ] `@nestjs/throttler` applied for rate limiting on auth endpoints

---

## Prisma-Specific

- [ ] `prisma.$queryRaw` with tagged template literals, not `$queryRawUnsafe`
- [ ] Multi-tenant apps: all queries scoped with `where: { tenantId }` — global
      query middleware (`$use`) recommended to enforce this centrally
- [ ] `select` / `include` on queries returning user data: explicit field selection
      to avoid leaking password hashes, internal flags, or audit fields
- [ ] Prisma client not instantiated per-request (performance + connection pool
      exhaustion risk) — use a singleton pattern

---

## Mongoose / MongoDB-Specific

- [ ] `{ strict: true }` (default) — flag any `{ strict: false }` schema options
      as Sev 2 (allows arbitrary fields into documents)
- [ ] `find(req.body)` or `findOne(req.query)` never used directly → Sev 1
- [ ] `$where` operator with user input → Sev 1 (JavaScript injection)
- [ ] `populate()` with user-supplied field names validated against allowlist

---

## TypeScript-Specific (Node.js + TS)

- [ ] **`as any` casts on user-supplied data** — bypasses type safety and can mask
      injection or validation gaps → flag every occurrence touching `req.body`,
      `req.query`, `req.params`
- [ ] **`unknown` preferred over `any`** for parsed input — forces explicit type
      narrowing before use
- [ ] **`JSON.parse()` result typed as `any`** — always narrow with a type guard or
      validation library (`zod`, `io-ts`, `class-validator`) before use
- [ ] `zod` / `joi` schemas validated at the route boundary, not deep inside
      service logic — late validation means untrusted data has already traveled far
- [ ] TypeScript strict mode (`"strict": true` in `tsconfig.json`) — disabled
      strict mode is Sev 3 (hides type errors that can conceal security bugs)

**Sev 2 pattern — `as any` on request body:**
```typescript
// BAD
const userId = (req.body as any).userId;

// GOOD — use zod or class-validator at the route boundary
const body = CreateOrderSchema.parse(req.body); // throws if invalid
```

---

## Express-Specific Deep Checks

- [ ] **`express.json()` body size limit** configured:
```javascript
app.use(express.json({ limit: '100kb' })); // not default unlimited
```
  Unbounded body = Sev 2 (memory exhaustion DoS)
- [ ] **`express.static()` directory path** does not include user-supplied
      segments — path traversal risk if `path.join(__dirname, req.params.folder)`
- [ ] `trust proxy` setting: set to the correct value for your infrastructure
      (e.g. `app.set('trust proxy', 1)` behind one reverse proxy) — wrong value
      causes incorrect IP in `req.ip`, breaking rate limiting and geo-blocking
- [ ] **Cookie parser**: if `cookie-parser` is used with a signed cookie secret,
      the secret must come from an environment variable
- [ ] **Session fixation**: `req.session.regenerate()` called after successful
      login to prevent session fixation attacks
- [ ] Helmet's `contentSecurityPolicy` configured with a policy, not just
      enabled with defaults — default CSP may be too permissive for the app

---

## JWT Deep Checks (Node.js)

- [ ] `jsonwebtoken`: `algorithms` option explicitly set in `verify()` call —
      omitting it allows the `none` algorithm attack:
```javascript
// BAD
jwt.verify(token, secret);

// GOOD
jwt.verify(token, secret, { algorithms: ['HS256'] });
```
- [ ] Asymmetric keys (RS256/ES256): `verify()` receives the **public key**,
      not the private key — using private key for verification is Sev 1
- [ ] `expiresIn` set on all tokens — no eternal tokens
- [ ] Token blacklist / revocation mechanism for logout (Redis set or DB flag)
- [ ] `sub` (subject) claim validated to match the authenticated user's ID
      after verification — missing check = token replay across users

---

## WebSocket / Socket.io Security (Node.js)

- [ ] Socket.io `cors` option mirrors the HTTP server CORS policy —
      `{ origin: '*' }` is Sev 2
- [ ] Auth token validated on the `connection` event, not just on first message:
```javascript
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  // verify token, call next() or next(new Error('Unauthorized'))
});
```
- [ ] Per-event input validation — socket events with user-supplied data must
      be validated just like HTTP body params
- [ ] Room/channel membership enforced server-side — clients must not be able
      to join rooms they're not authorized for by emitting `join` events freely
- [ ] **`socket.rooms`** not trusted as an authorization check — a connected
      socket's room list is server-managed but verify with the auth context

---

## AWS Lambda / Serverless (Node.js)

- [ ] **IAM roles** scoped to least privilege — Lambda execution role must not
      have `*` permissions on any AWS service → Sev 1
- [ ] **Event injection**: `event.body` from API Gateway is a string — always
      `JSON.parse()` with try/catch and validate before use
- [ ] Environment variables in Lambda functions do not contain secrets — use
      AWS Secrets Manager / Parameter Store with SDK retrieval at runtime
- [ ] **Cold start secrets caching**: secrets fetched from Secrets Manager
      cached in module scope (outside handler) — ensure cache TTL is reasonable
      and rotation is handled
- [ ] `event.requestContext.authorizer` fields used for auth context —
      never `event.headers['x-user-id']` which a client can forge
