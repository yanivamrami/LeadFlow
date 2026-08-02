# .NET / C# Security Checklist

Apply these checks in addition to the OWASP Top 10 baseline when reviewing
.NET or C# code (.NET Core, .NET 5+, ASP.NET Core, EF Core, Minimal APIs,
SignalR, Blazor, or classic ASP.NET MVC/WebForms).

---

## A01 – Broken Access Control

- [ ] All controllers/actions that return user data are decorated with `[Authorize]`
      or have explicit role checks (`[Authorize(Roles = "...")]`)
- [ ] Resource-level authorization is enforced — `userId` from JWT claims
      is validated against the resource owner, not just the route param (IDOR)
- [ ] `[AllowAnonymous]` usage is intentional and documented
- [ ] Razor Pages use `AuthorizeFilter` or `[Authorize]` at the page model level

**Minimal API (ASP.NET Core 6+) specific:**
- [ ] `.RequireAuthorization()` applied to route groups or individual endpoints —
      minimal APIs have no `[Authorize]` attribute by default
- [ ] `app.MapGroup("/admin").RequireAuthorization("AdminPolicy")` — admin route
      groups must not be missing this call
- [ ] Policy-based auth (`AuthorizationPolicy`) used for fine-grained control
      rather than role strings hardcoded in attributes

**SignalR specific:**
- [ ] Hub methods that return user data are decorated with `[Authorize]`
- [ ] `Context.UserIdentifier` used to scope hub messages to authenticated users;
      never trust a client-supplied `userId` parameter for targeting
- [ ] Group membership (`Groups.AddToGroupAsync`) gated on server-side auth check,
      not just client-initiated join requests

**Common findings:**
- Missing `[Authorize]` on controllers that were "temporarily" left open
- Trusting `userId` from request body/query string instead of `HttpContext.User`
- IDOR via predictable integer IDs without ownership check

---

## A02 – Cryptographic Failures

- [ ] Secrets (connection strings, API keys, JWT secrets) NOT in `appsettings.json`
      committed to source control — use `IConfiguration` + environment variables,
      User Secrets (dev only), or Azure Key Vault / AWS Secrets Manager
- [ ] Passwords hashed with `BCrypt.Net`, `PasswordHasher<T>` (ASP.NET Identity),
      or `Rfc2898DeriveBytes` (PBKDF2, >= 310,000 iterations) — never MD5, SHA1, plain SHA256
- [ ] Sensitive data in transit: `UseHttpsRedirection()` + HSTS (`UseHsts()`) configured
- [ ] JWT bearer: `RequireHttpsMetadata = true` — never `false` in production
- [ ] `DataProtection` API used for encrypting cookies, tokens, anti-forgery tokens at rest
- [ ] TLS 1.2+ enforced; TLS 1.0/1.1 disabled in `web.config` or Kestrel config
- [ ] `RandomNumberGenerator.GetBytes()` used for security tokens — never `System.Random`
- [ ] Symmetric encryption uses AES-256-GCM or AES-256-CBC with HMAC — no DES, 3DES, RC4

**Sev 1 flags:**
- Connection string or JWT secret hardcoded in any source file or `appsettings.json`
- `System.Random` used to generate tokens, session IDs, or password reset codes

---

## A03 – Injection

### SQL Injection
- [ ] No raw SQL string concatenation — use EF Core LINQ, `FromSqlRaw` with
      parameters, or `SqlCommand` with `SqlParameter`
- [ ] `FromSqlRaw()` must never interpolate user input — use `FromSqlInterpolated()`
      or explicit `SqlParameter` objects
- [ ] Dapper: `Query<T>(sql, new { param })` — never `string.Format` into the sql arg

**Sev 1 pattern:**
```csharp
// BAD
var sql = $"SELECT * FROM Orders WHERE CustomerId = '{customerId}'";
context.Database.ExecuteSqlRaw(sql);

// GOOD — EF Core LINQ (fully parameterized)
context.Orders.Where(o => o.CustomerId == customerId).ToList();

// GOOD — interpolated (EF parameterizes the interpolated values)
context.Database.ExecuteSqlInterpolated(
    $"SELECT * FROM Orders WHERE CustomerId = {customerId}");
```

### LDAP Injection
- [ ] LDAP filter values escaped using `Encoder.LdapFilterEncode()` (AntiXSS)
      before composing filter strings

### XXE (XML External Entity)
- [ ] `XmlReader` / `XmlDocument` created with `DtdProcessing.Prohibit` and
      `XmlResolver = null`
```csharp
// GOOD
var settings = new XmlReaderSettings {
    DtdProcessing = DtdProcessing.Prohibit,
    XmlResolver = null
};
```

### Command Injection
- [ ] `Process.Start()` never includes unsanitized user input in `Arguments`
- [ ] Prefer `ProcessStartInfo.ArgumentList` (array) over `Arguments` (string)
      when user data must be passed — no shell interpolation with ArgumentList

### Open Redirect
- [ ] `LocalRedirect()` used instead of `Redirect(returnUrl)` for user-supplied URLs
- [ ] `Url.IsLocalUrl(returnUrl)` checked before redirecting to any user-supplied URL

---

## A04 – Insecure Design

- [ ] Mass assignment: API input models are explicit DTOs, never EF Core entities directly
- [ ] `[BindNever]` on sensitive entity properties that must not be model-bound
- [ ] File uploads: validate by magic bytes (not extension), enforce `MaxRequestBodySize`,
      store outside web root, rename on disk (never use the original filename)
- [ ] All list endpoints enforce a max page size server-side — unbounded queries
      with user-controlled `take` param are Sev 2 (potential DoS)

---

## A05 – Security Misconfiguration

- [ ] `app.UseDeveloperExceptionPage()` NOT in Production (gated on `env.IsDevelopment()`)
- [ ] Error responses do not leak stack traces, file paths, or EF query text
- [ ] CORS: never `AllowAnyOrigin()` + `AllowCredentials()` simultaneously
- [ ] HTTP security headers applied: `X-Content-Type-Options: nosniff`,
      `X-Frame-Options: DENY`, `Referrer-Policy`, `Content-Security-Policy`, HSTS
- [ ] `web.config`: `removeServerHeader="true"`; Kestrel: `AddServerHeader = false`
- [ ] Docker: app not running as root — `USER` directive set in Dockerfile
- [ ] `appsettings.Development.json` not deployed to production environments

**Middleware pipeline order — flag if incorrect (Sev 1):**
```csharp
// CORRECT ORDER
app.UseHttpsRedirection();   // 1
app.UseStaticFiles();        // 2
app.UseRouting();            // 3
app.UseAuthentication();     // 4  <-- must come BEFORE UseAuthorization
app.UseAuthorization();      // 5
app.MapControllers();        // 6
```
`UseAuthorization()` appearing before `UseAuthentication()` → **Sev 1**.

**Blazor specific:**
- [ ] Blazor Server: `CircuitOptions.DetailedErrors = false` in production
- [ ] Blazor WASM: no secrets or sensitive business logic in client-side assemblies
- [ ] `[Authorize]` used on Blazor components, not just route-level guards

---

## A06 – Vulnerable and Outdated Components

- [ ] NuGet packages don't reference versions with known CVEs
      (`dotnet list package --vulnerable` if available)
- [ ] `Newtonsoft.Json` >= 13.0.1 (older: known deserialization risks)
- [ ] No `<PackageReference>` overrides of transitive packages without documented reason
      (may indicate an unresolved CVE workaround)

---

## A07 – Identification and Authentication Failures

- [ ] JWT validation: `ValidateIssuer`, `ValidateAudience`, `ValidateLifetime`,
      `ValidateIssuerSigningKey` all `true`
- [ ] JWT secret >= 256 bits; stored in secrets manager, not source code
- [ ] `ValidAlgorithms` restricted — mitigates `alg:none` attack
- [ ] Refresh token rotation: old token invalidated on use
- [ ] Account lockout: `MaxFailedAccessAttempts` set in ASP.NET Identity
- [ ] Password policy: `PasswordOptions` enforces minimum complexity
- [ ] `[ValidateAntiForgeryToken]` on all state-changing MVC actions
- [ ] Cookie auth: `HttpOnly = true`, `Secure = true`, `SameSite = Strict/Lax`
- [ ] Password reset tokens: short expiry, single-use enforced via token invalidation
- [ ] MFA enforced for admin accounts via ASP.NET Identity 2FA pipeline

---

## A08 – Software and Data Integrity

- [ ] `Newtonsoft.Json` `TypeNameHandling` NOT set to `All` or `Auto` without
      a safe `SerializationBinder` — enables RCE via gadget chains
- [ ] `BinaryFormatter` not used anywhere — removed in .NET 9, RCE vector → **Sev 1**
- [ ] `XmlSerializer` / `DataContractSerializer` not used with untrusted input
      without DTD disabled
- [ ] NuGet `nuget.config` restricts package sources to trusted feeds — prevents
      dependency confusion attacks (public + private feed mix)

**Sev 1 flag:** Any use of `BinaryFormatter` or `LosFormatter` with user-supplied data.

---

## A09 – Security Logging and Monitoring

- [ ] Auth failures, access violations, and input validation failures logged via `ILogger`
- [ ] Logs do NOT contain passwords, full tokens, credit card numbers, or SSNs
- [ ] Structured logging masks sensitive fields at the destructuring level
- [ ] Correlation IDs (`X-Correlation-ID` / `TraceIdentifier`) propagated
- [ ] No `Console.WriteLine()` in production code — use `ILogger`

---

## A10 – SSRF

- [ ] `HttpClient` calls with user-supplied URLs validated against a domain allowlist
- [ ] Block cloud metadata endpoints (`169.254.169.254`), `localhost`, and RFC-1918
      ranges (10.x, 172.16.x, 192.168.x)
- [ ] `MaxResponseContentBufferSize` set on `HttpClient` to prevent memory exhaustion
      from SSRF payloads

---

## EF Core Specific

- [ ] `DbContext` registered as Scoped, NOT Singleton — Singleton DbContext causes
      cross-request data leakage in concurrent scenarios → **Sev 1**
- [ ] Global query filters (`HasQueryFilter`) in place for multi-tenant row filtering —
      tenant-scoped entities without a global filter are IDOR risks
- [ ] `AsNoTracking()` used for read-only queries (Sev 3 — performance/amplified DoS risk)
- [ ] `SaveChanges()` inside a loop flagged — N+1 write pattern, potential DoS

---

## Dependency Injection Pitfalls

- [ ] Scoped services NOT injected into Singleton services (captive dependency —
      causes shared mutable state across requests) → **Sev 1** if service holds user data
- [ ] `IHttpContextAccessor` not used in background/hosted services —
      `HttpContext` is null outside request scope and will throw

---

## Multi-Tenant Architecture

These are high-value findings specific to SaaS / multi-tenant .NET apps.

- [ ] **Tenant resolution** is performed in middleware or a scoped service —
      never resolved from a user-supplied header without verification
- [ ] **Global query filter** (`HasQueryFilter`) applied to every tenant-scoped
      entity in `DbContext.OnModelCreating` → missing filter = cross-tenant data leak → **Sev 1**
- [ ] `TenantId` is sourced from the authenticated JWT claim, never from
      `req.Query`, `req.Body`, or a cookie the client controls
- [ ] Background jobs / `IHostedService` explicitly set tenant context when
      running outside a request scope — missing = either data leak or wrong-tenant writes
- [ ] `DbContext` factory (`IDbContextFactory<T>`) used in background services
      to avoid sharing scoped context across tenant boundaries

**Sev 1 pattern — missing global filter:**
```csharp
// BAD — no tenant isolation; all tenants see all records
public DbSet<Order> Orders { get; set; }

// GOOD — row-level tenant isolation via EF Core global filter
protected override void OnModelCreating(ModelBuilder builder) {
    builder.Entity<Order>().HasQueryFilter(o => o.TenantId == _tenantContext.TenantId);
}
```

---

## API Design Security

- [ ] **Pagination enforced server-side** — `take` / `pageSize` from request body
      capped at a hard maximum (e.g., 200) to prevent memory exhaustion DoS → Sev 2
- [ ] **Projection over full entity return** — `Select()` to a DTO instead of
      returning the full EF entity; prevents accidental field exposure
- [ ] **Versioned API** endpoints — deprecated versions that bypass newer auth
      checks must be explicitly sunset, not silently left reachable
- [ ] **`[ApiController]`** attribute present on all Web API controllers —
      without it, model validation errors are not automatically returned as 400
- [ ] Input DTOs annotated with `[Required]`, `[MaxLength]`, `[Range]` — no
      unbounded string fields on public endpoints
- [ ] HTTP `PATCH` endpoints use dedicated patch DTOs (not the full entity) to
      avoid unintended mass-update of sensitive fields

---

## Middleware & Pipeline Security

- [ ] **Rate limiting** (`AddRateLimiter`, .NET 7+) configured on auth, registration,
      and password-reset endpoints — absence is Sev 2
- [ ] **Request size limits** set via `app.UseRequestSizeLimiting()` or
      `[RequestSizeLimit]` on file upload endpoints
- [ ] **Response compression** (`UseResponseCompression`) is disabled for
      HTTPS responses that include sensitive data in cookies/headers
      (BREACH / CRIME attack vector) — Sev 2 if used with auth cookies
- [ ] **IP-based allow-listing** on internal admin endpoints — admin surfaces
      exposed to the public internet without IP restriction are Sev 2
- [ ] `UseExceptionHandler("/error")` configured for production — no unhandled
      exceptions reaching the response

---

## Secrets & Configuration Management

- [ ] `dotnet user-secrets` used in development — secrets never in
      `appsettings.Development.json` in source control
- [ ] `IOptions<T>` / `IOptionsSnapshot<T>` used for config binding —
      raw `IConfiguration["Key"]` access in services bypasses validation
- [ ] `[Required]` data annotations on `IOptions<T>` binding classes so
      missing secrets fail fast at startup instead of at runtime
- [ ] Azure Key Vault / AWS Secrets Manager referenced via `AddAzureKeyVault()`
      or `AddSecretsManager()` in `Program.cs` — not via manual HTTP calls

---

## gRPC / Minimal API / WebSocket Extras

**gRPC:**
- [ ] `ServerCallContext` metadata headers used for auth, not custom headers —
      unauthenticated gRPC endpoints with sensitive calls are Sev 1
- [ ] `AuthInterceptor` registered on the server — per-method `[Authorize]`
      alone is insufficient for streaming calls

**Minimal APIs (.NET 6+):**
- [ ] `app.MapPost(...).RequireAuthorization()` — every mutating endpoint
      explicitly declares auth requirement
- [ ] `.WithOpenApi()` + `.ExcludeFromDescription()` used to hide internal
      endpoints from Swagger in production builds

**WebSockets:**
- [ ] `Origin` header validated on WebSocket upgrade request to prevent
      cross-origin WebSocket hijacking → Sev 1
- [ ] Message size limit configured to prevent memory exhaustion

---

## Cloud & Deployment

- [ ] **Managed Identity** used for Azure resources (Key Vault, Storage, SQL)
      instead of connection-string credentials → missing = Sev 2
- [ ] **Docker image** uses non-root `USER`, slim base image (`aspnet` not `sdk`),
      and no secrets baked into image layers (check `RUN` and `ENV` in Dockerfile)
- [ ] **Environment-specific `appsettings`** — `appsettings.Production.json`
      must not contain secrets; it should reference environment variables only
- [ ] **Health check endpoints** (`/health`, `/readyz`) do not expose internal
      topology (DB connection strings, service URLs) in their response body
