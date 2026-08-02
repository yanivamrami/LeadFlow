# Angular / TypeScript Security Checklist

Apply these checks in addition to the OWASP Top 10 baseline when reviewing
Angular or TypeScript frontend code. Covers Angular 14+ (standalone components,
signals, NgRx, Angular Material, SSR with Angular Universal / hydration).

---

## A03 – Injection / XSS

Angular's template engine auto-escapes by default — the risk comes from
bypassing it intentionally or accidentally.

- [ ] **`[innerHTML]` binding** — flag every occurrence. Any binding to user-supplied
      or API-returned data is Sev 1 unless server-side sanitized
- [ ] **`bypassSecurityTrustHtml()`**, `bypassSecurityTrustScript()`,
      `bypassSecurityTrustUrl()`, `bypassSecurityTrustResourceUrl()` —
      each call must be justified; any processing user-controlled data → Sev 1
- [ ] **`DomSanitizer`** — only acceptable when the HTML source is verifiably
      safe (e.g., CMS content sanitized server-side with a strict allowlist)
- [ ] **Template injection** — `{{userValue}}` is safe; dynamically constructed
      template strings passed to the compiler at runtime are not
- [ ] No `document.write()`, `eval()`, `new Function()` in any `.ts` file
- [ ] `<script>` tags not injected into the DOM dynamically from user content

**Sev 1 pattern:**
```typescript
// BAD — direct XSS vector
this.html = this.sanitizer.bypassSecurityTrustHtml(userInput);

// GOOD — bind directly; Angular sanitizes [innerHTML] automatically
this.html = userInput;
```

**Angular SSR / Hydration specific:**
- [ ] Server-side rendered HTML does not embed unsanitized user input in the
      initial payload (SSR XSS can bypass client-side Angular sanitization)
- [ ] `TransferState` keys do not carry sensitive data (visible in page source)

---

## A01 – Broken Access Control (Client-Side)

- [ ] Route guards (`CanActivate`, `CanActivateChild`, `CanLoad` / `canMatch`)
      implemented for all authenticated and role-restricted routes
- [ ] Sensitive UI elements check permissions from the decoded auth token or
      NgRx/Signal store state — never from a local mutable boolean variable
- [ ] **Never trust the frontend for authorization** — flag any pattern where
      Angular sends a `role` or `isAdmin` field in the request body that the
      backend might use for access decisions
- [ ] Lazy-loaded admin modules use `canMatch` / `CanLoad` to prevent unauthenticated
      users from downloading the bundle at all

**NgRx specific:**
- [ ] Auth state in the store is populated from the validated JWT on the server,
      not from a user-editable payload field
- [ ] Selectors that derive `isAdmin` / `hasRole` from store state trace back to
      a server-validated token claim — flag if derived from a form or route param

**Angular Signals specific:**
- [ ] `computed()` signals derived from auth state correctly handle unauthenticated
      state (return false / empty, not throw) to prevent UI state errors that
      could be exploited for partial access
- [ ] `effect()` side effects that trigger navigation or data fetch are gated on
      auth signal state, not just `undefined` checks

---

## A02 – Cryptographic Failures

- [ ] **No secrets in source code** — API keys, OAuth client secrets, or signing
      keys must never appear in `.ts`, `environment.ts`, or `environment.prod.ts`
      committed to source control → **Sev 1**
- [ ] `environment.ts` values with `_SECRET`, `_KEY`, `_TOKEN` suffixes or long
      random-looking strings are Sev 1
- [ ] JWT tokens stored in `localStorage` → Sev 2 (XSS-stealable);
      prefer `HttpOnly` cookies managed by the server
- [ ] Sensitive data (PII, tokens) not stored in `sessionStorage` unencrypted
- [ ] `crypto.subtle` or server-side encryption used for any client-stored sensitive
      data; browser-side `btoa()` / base64 is encoding, not encryption

---

## A05 – Security Misconfiguration

- [ ] `Content-Security-Policy` does not include `unsafe-inline` for scripts
      without a nonce/hash strategy
- [ ] `angular.json` production build: `optimization: true`, `sourceMap: false`
      (source maps in production expose internal code structure)
- [ ] `index.html` does not load third-party scripts without SRI (Subresource
      Integrity) hashes: `<script integrity="sha384-..." crossorigin="anonymous">`
- [ ] `<meta http-equiv="X-UA-Compatible" content="IE=edge">` present
- [ ] Proxy configuration (`proxy.conf.json`) used in development is NOT
      deployed to production (it can expose internal API routing)
- [ ] `ng serve` / dev server not used in production — flag if Dockerfile or
      deployment script runs `ng serve` instead of `ng build` + static host

---

## A07 – Authentication Failures

- [ ] Login forms use `autocomplete="current-password"` — not suppressed
- [ ] Auth tokens cleared from all storage on logout (localStorage, sessionStorage,
      in-memory store / NgRx reset action)
- [ ] Token expiry handled — expired tokens trigger re-auth, not a silent 401 loop
- [ ] `HttpInterceptor` refreshes tokens before expiry, not after a failed 401
      (prevents race conditions on parallel requests)
- [ ] No tokens or credentials logged via `console.log()` — flag even in
      development-mode guards
- [ ] `remember me` persistence: if token is stored beyond session in localStorage,
      document the decision and flag as Sev 2 if sensitive app

---

## A08 – Software Integrity / Supply Chain

- [ ] `package-lock.json` or `yarn.lock` committed and up to date
- [ ] No packages with known CVEs — flag if `npm audit` output shows high/critical
- [ ] No CDN-loaded scripts without SRI hashes in `index.html`
- [ ] `@angular/core` and related packages not significantly behind latest stable
      (major security patches in each minor release)

---

## Angular-Specific Patterns

### HttpClient & Interceptors
- [ ] Auth interceptor attaches token from a secure, centralized store
      (never hardcoded, never from a component property)
- [ ] Error interceptor does not swallow 401/403 silently — must trigger logout
      or token refresh
- [ ] Request interceptors do not log full request bodies (may contain PII or tokens)
- [ ] `withCredentials: true` only set when CORS cookies are intentionally used;
      paired with a strict `Access-Control-Allow-Origin` on the server

### Reactive Forms
- [ ] Validators sanitize / trim input before API calls
- [ ] `[disabled]` binding on form controls: prefer `form.get('x').disable()`
      over `[disabled]="condition"` — template-driven disabling can be bypassed
      via DevTools → Sev 2 if disabling a privileged action
- [ ] File upload components validate type and size client-side for UX only —
      remind that server-side validation is required for security

### Standalone Components (Angular 14+)
- [ ] `importProvidersFrom(HttpClientModule)` at bootstrap level — not re-imported
      inside lazy-loaded feature providers (can bypass app-level interceptors)
- [ ] `provideRouter()` with guards configured at the route definition level,
      not only at the lazy-loaded module boundary

### Angular Material / UI
- [ ] `MatDialog` / overlay content that renders user HTML uses Angular's safe
      binding, not `innerHTML` injection inside dialog templates
- [ ] `MatTable` data sources do not render cell content as HTML

### Third-Party Libraries
- [ ] `ngx-quill`, `angular-editor`, or any WYSIWYG library: sanitization config
      reviewed — these libraries often require explicit allowlist configuration
      to prevent stored XSS via editor content
- [ ] Chart libraries (NGX-Charts, Chart.js wrappers) not rendering user-supplied
      labels as raw HTML (flag `allowHtml: true` options)

---

## Angular Signals & Standalone Components (Angular 17+)

Modern Angular patterns introduce new attack surfaces not covered by legacy guides.

### Signals Security
- [ ] Signal values derived from user input and bound via `[innerHTML]` or
      passed to `bypassSecurityTrust*` are Sev 1 — same XSS rules apply
- [ ] `computed()` signals that produce HTML strings must pass through Angular's
      sanitizer before rendering — inline `effect()` writing to `nativeElement.innerHTML`
      is Sev 1
- [ ] `toSignal()` wrapping an `HttpClient` observable — ensure the observable
      source doesn't emit sensitive data into error messages logged to console

### @defer Blocks (Angular 17+)
- [ ] `@defer` blocks loading admin/privileged UI must still be gated by a
      route-level guard — lazy loading doesn't prevent a bundle download request;
      the **backend must enforce auth independently**
- [ ] `@defer (when condition)` where `condition` derives from user-controlled
      input — review for logic bypass potential

---

## State Management Security (NgRx / Signals Store)

- [ ] **Auth token never stored raw in NgRx state** — DevTools can inspect all
      state in development; tokens belong in memory (service property) or
      `HttpOnly` cookie only
- [ ] NgRx `Effects` making HTTP calls use selectors scoped to the current user's
      ID — shared store in SSR can leak cross-user data → Sev 1
- [ ] **NgRx DevTools disabled in production:**
```typescript
// GOOD — guarded by environment flag
StoreDevtoolsModule.instrument({ maxAge: 25, logOnly: environment.production })
// or omit the module entirely in production imports
```
Missing guard = store state visible to anyone with DevTools → Sev 2

---

## Angular SSR (Universal / Server-Side Rendering)

- [ ] **`TransferState`** must not serialize auth tokens, session IDs, or PII —
      it's embedded in the HTML sent to every client → Sev 1
- [ ] SSR responses containing user-specific data must set
      `Cache-Control: private, no-store` — cached by a CDN = cross-user data
      leak → Sev 1
- [ ] `isPlatformBrowser(this.platformId)` guard before accessing `localStorage`,
      `document`, `window` — SSR crashes expose internal server errors
- [ ] HTTP interceptors in SSR context must not forward client cookies between
      requests for different users (shared `HttpClient` instance in server scope)

---

## Angular + OAuth / OIDC (angular-oauth2-oidc / Auth0 / MSAL)

- [ ] **PKCE flow used** (`responseType: 'code'` + `useSilentRefresh: false`) —
      implicit flow (`response_type=token`) is deprecated and exposes tokens
      in URL fragments visible in browser history → Sev 2
- [ ] `state` parameter validated on redirect callback to prevent CSRF on OAuth flow
- [ ] `nonce` validated in ID token claims to prevent replay attacks
- [ ] `post_logout_redirect_uri` is a server-allowlisted URI, not user-supplied

---

## Content Security Policy for Angular

- [ ] CSP `script-src` must NOT include `unsafe-eval` in production — AOT
      build does not require it; JIT does, but JIT must not be used in prod → Sev 2
- [ ] `style-src 'unsafe-inline'` required for Angular Material by default —
      flag as Sev 3; suggest nonce-based approach
- [ ] **Trusted Types** (`require-trusted-types-for 'script'`) in CSP prevents
      DOM XSS even when sanitizer is bypassed — Angular 16+ supports this natively
