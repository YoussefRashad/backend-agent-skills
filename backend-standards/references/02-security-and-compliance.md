# 02 — Security and Compliance

> Cross-cutting security policy for consumer-finance backends handling national IDs, OTPs,
> card data and money movement.
>
> **This document sets a floor.** A project document **MAY** tighten these rules. It
> **MUST NOT** relax them. On any conflict about credentials or personal data, the stricter
> rule wins regardless of document precedence — see `.ai/standards/00-ai-agent-instructions.md` §2.

---

## 1. Data classification

Four classes. The class decides what may be written to a log.

### Class A — Masked always

PIN · password · card PAN · CVV · card token · private key.

- **MUST NOT** appear in any log, at any level, in any environment, including while debugging.
- **MUST** be masked or truncated wherever a payload containing them is persisted.
- **MUST NOT** be persisted except where the system's function requires it, and then only
  hashed or encrypted at rest.
- **MUST NOT** be returned in any API response other than the one that issues it.
- **MUST NOT** be placed in a URL, query string, or path.

> **PAN and CVV are not a policy choice.** PCI DSS prohibits storing CVV after
> authorization and requires PAN to be masked. A documented risk acceptance does not satisfy
> an assessor. These two stay in Class A, and the optional full capture described below
> never covers them.

### Class B — Credentials

OTP · access token · refresh token · `Authorization` header value · session ID ·
API key · client secret · request-signature secret · biometric signature.

- **MUST** be redacted in every log, at every level, in requests and in responses (§2.1).
  A logged credential is a usable credential for as long as it stays valid, readable by
  everyone who can read the log.
- **MUST NOT** be written to stdout, to an error tracker, to a third-party service, or into
  an API response other than the one that issues it.

### Class C — Personal data

National ID · passport number · full phone number · full name · date of birth · address ·
email · bank account number · IBAN · geolocation · device identifier · ID-document
reference · liveness-capture reference · credit-bureau data · address book.

- **MUST** be redacted in every log — masked or truncated so the full value cannot be
  recovered from the log line (§2.1). A log that carries personal data in clear is a second
  personal-data store with none of the first one's access rules.
- **MUST NOT** be sent to a third-party error tracker, analytics tool or external log
  aggregator.
- **MUST NOT** be placed in a URL, query string, or path.
- **MUST NOT** be used as a cache key, Redis key, filename, or object-storage key without
  hashing — those are not logs, they are addressable surfaces with different access rules.

_Implementation note, not a rule:_ ID-document and liveness fields carry an object-storage
URL or key in request and response payloads, not image bytes. The reference is itself
Class C and is redacted like any other; the image stays behind its bucket ACL.

### Optional — capturing Class B and Class C unredacted, under a risk acceptance

Redaction is the default, and nothing below applies unless an organization opts in. Where a
complete per-request trail is required — dispute resolution, incident forensics — an
organization **MAY** capture Class B and Class C values unredacted, inside one closed,
access-controlled request/response log store ("the capture store").

That is a deviation from this document, so it is never a convention. It **MUST** be recorded
as a risk acceptance in `.ai/standards/known-deviations.md` §3 — signed by someone who can
accept the risk, with an expiry — and it holds **only while all four of the following stay
true**:

1. No API, dashboard, report or export exposes log contents.
2. Access to the capture store is restricted; no general engineering or support access.
3. Retention is a short, mechanically enforced period (§3).
4. Logs are not replicated, restored or exported into a lower-trust environment.

- A change that breaks **any** of the four — a log-viewer endpoint, a support tool, a BI
  export, a restore into staging — **MUST** be treated as a change to the risk acceptance,
  and **MUST** be raised with whoever signed it before it ships. An agent encountering such
  a change **MUST** stop and ask.
- Even under a risk acceptance, these values **MUST NOT** be written anywhere outside the
  capture store — not to stdout, not to an error tracker, not to a third-party service, not
  into an API response.
- Class A is never covered. No risk acceptance permits logging a Class A value.

**Residual risk an organization takes on by opting in:** tokens and OTPs expire, so a
logged value is usually dead before a short retention window closes. The
**request-signature secret and API/client secrets do not** — a logged secret stays valid
until someone rotates it. Rotation is therefore the only control bounding that one, and the
capture store becomes a credential and personal-data store that inherits every obligation
of one.

### Class D — Service identifiers

Correlation ID · service-assigned user ID · order ID · request path · HTTP status · duration ·
provider name · error class.

Unrestricted. These **SHOULD** be the primary means of tracing, because they work in every
environment and carry no exposure.

---

## 2. Logging

### 2.1 The rule

- Redaction **MUST** be applied **symmetrically to requests and responses**. Class A, B and
  C values appear in responses as readily as in requests.
- Redaction **MUST** be recursive. A shallow scan that masks only top-level fields is not
  redaction — sensitive values nest.
- The redaction key list **MUST** cover every Class A, Class B and Class C field the
  service handles, at minimum:

  Class A — `password` (and every variant) · `pin` · `cardNumber` · `pan` · `cvv` · `cvc` ·
  `cardToken` · `privateKey`

  Class B — `otp` · `accessToken` · `refreshToken` · `token` · `authorization` ·
  `sessionId` · `apiKey` · `clientSecret` · `secret` · `signature`

  Class C — `nationalId` · `passportNumber` · `phone` · `mobile` · `fullName` ·
  `dateOfBirth` · `address` · `email` · `iban` · `accountNumber` · `latitude` ·
  `longitude` · `deviceId`

- Key matching **MUST** be case-insensitive and **MUST** cover the header spelling as well
  as the body spelling (`Authorization`, `x-api-key`, `access_token`). A list that matches
  `accessToken` but not `access_token` redacts one provider's payload and persists the
  next one's.
- A risk acceptance under §1 removes Class B and Class C keys from the list for the capture
  store only. It **MUST NOT** remove a Class A key.
- The configured key list **MUST** be verified against the library's actual defaults, not
  assumed from the feature's name. A default list that omits a listed field silently
  persists it.
- A payload size cap **MUST** be configured, so one large body cannot fill the log store.

### 2.2 Scope of the capture store

Without a recorded risk acceptance (§1), no log holds a Class B or Class C value in clear.
With one, those values are captured unredacted **only** inside the request/response log the
risk acceptance names. That store is the boundary.

- **MUST NOT** write Class B or Class C to stdout, an error tracker, an APM, an external log
  aggregator, or any third-party service — with or without a risk acceptance.
- **MUST NOT** expose the log store through an API, report, export or dashboard (§1,
  condition 1).
- An endpoint that would read from it **MUST** be raised with whoever signed the risk
  acceptance before it is built.

### 2.3 Headers

- `Authorization` and request-signature headers are Class B — they **MUST** be redacted
  (§1). Under a risk acceptance they are captured inside the capture store, and nowhere
  else.
- `Cookie` and `Set-Cookie` **MUST** be redacted if session material ever moves into them.

### 2.4 Errors

- Errors **MUST** be logged with correlation ID, operation, identifiers and stack.
- **MUST NOT** log a raw provider error object. Driver and HTTP client error objects carry
  the full request config — which can include Class A material such as card data from a
  payment provider's `source_data`. Log `error.message` plus explicit fields you have chosen.
- **MUST NOT** return a stack trace, driver error, upstream URL or echoed request body to an
  API caller. A log is read by operators; an API response is read by whoever called.

### 2.5 Discipline

- **MUST NOT** use `console.*`. Use the configured logger — `console` output goes to stdout,
  which bypasses the logger's redaction and sits outside the log store's access control and
  retention.
- Access to log tables and log storage **MUST** be restricted (§1, condition 2). Redaction
  misses the field nobody listed, and a log store holding Class B and Class C data is a
  credential and personal-data store that inherits every obligation of one.

---

## 3. Retention

A table that accumulates request, response or third-party payloads is a growing personal-data
store. Without a bound it becomes both a compliance exposure and a capacity problem, and it
grows monotonically.

- Every such table **MUST** have a defined retention period. Where a store holds Class B
  or Class C data unredacted under a risk acceptance (§1), that period **MUST** be short,
  **MUST** be enforced mechanically, and **MUST** be recorded both in the risk acceptance
  and in `.ai/standards/03-project-architecture.md` — the risk acceptance depends on it, so
  lengthening it reopens that risk acceptance.
- Retention **MUST** be enforced mechanically — a partition drop or a scheduled purge — not
  by intent.
- Retention periods **SHOULD** be recorded in `.ai/standards/03-project-architecture.md`.
- Personal data **MUST NOT** be retained past the purpose it was collected for.
- Tables holding payloads **SHOULD** be partitioned by time, so expiry is a partition drop
  rather than a mass delete.
- A deletion request for a data subject **SHOULD** be satisfiable. Design storage so that it
  can be, and record how.

---

## 4. Authentication

- Every user-facing route **MUST** require authentication explicitly. Where a framework
  treats routes as public by default, adding a controller without a guard exposes it — this
  **MUST** be checked on every new route.
- A route exempted from authentication **MUST** be justified, enumerated in
  `.ai/standards/03-project-architecture.md`, and reviewed.

### Tokens

- Every token verification **MUST** pass an explicit algorithm allowlist. Verifying with only
  a key accepts whatever algorithm the token claims.
- Every token signing call **MUST** set an explicit expiry. A token with no expiry is a
  permanent credential.
- Each token **purpose** (access, refresh, state, biometric, single-flow) **MUST** use its own
  signing secret. **MUST NOT** cross-use secrets between purposes — a token minted for one
  purpose then verifies for another.
- Tokens **MUST NOT** carry Class A or Class C data in their payload. A token is presented
  on every request and is readable by its bearer; it is not a place for card data or
  personal data.
- A token **SHOULD** carry an opaque public identifier rather than an internal database ID.
- Token lifetimes **SHOULD** be recorded in `.ai/standards/03-project-architecture.md`.

### Brute-force defence

- Authentication attempts **MUST** be rate-limited and counted.
- Lock counters **MUST** use `>=` comparisons, never `==`. An exact comparison disengages on
  overshoot.
- A counter key **MUST** receive its TTL atomically with its first increment (§8 of `01`),
  otherwise a partially-used counter persists forever.
- Lock ladders and attempt counters **MUST NOT** be bypassed or reset for convenience.

---

## 5. Authorization

Authentication proves who is calling. Authorization decides what they may touch. **A system
with only the first has no access control.**

- The acting identity **MUST** be derived from the verified authentication context.
- A subject identifier — `userId`, `nationalId`, `phone`, account number — supplied in a
  request **body**, **query string** or **path parameter** **MUST NOT** be used to select or
  mutate data.
- Every handler that returns or mutates a resource **MUST** verify that the resource belongs
  to the acting identity, by **database lookup**.
- **MUST NOT** authorize by parsing an identifier — an object key, a filename, a reference
  string. String inspection is not an ownership check.
- Where a route legitimately acts on another subject (an admin or back-office surface), it
  **MUST** be guarded by an explicit role check, and that route **SHOULD** be listed in
  `.ai/standards/03-project-architecture.md`.
- Where a flow legitimately has no bearer token (a guest or pre-registration flow), identity
  **MUST** come from a short-lived, single-purpose signed token bound to that flow, with its
  own secret, its own expiry, and step ordering enforced. It **SHOULD** be documented.
- **MUST NOT** authorize by source IP alone where the application sits behind a proxy with
  forwarded-header trust enabled — the header is caller-controlled unless the network
  guarantees only the proxy can reach the application.

---

## 6. Input safety

- User-supplied **values** **MUST** be bound parameters. No interpolation, no exceptions
  (`01` §7).
- Dynamic **identifiers** — sort columns, filter columns, table names — **MUST** come from a
  server-side allowlist enforced at query construction (`01` §3).
- Every endpoint **MUST** validate its input with a DTO. `any`-typed bodies bypass validation
  entirely.
- Pagination limits **MUST** be capped.
- Arrays from clients **MUST** be size-capped.
- Body and upload sizes **MUST** be bounded explicitly.
- Uploaded files **MUST** be validated by type and size, and **MUST NOT** be written to a
  path derived from user input.
- **MUST NOT** write user-controlled content to the filesystem from a request handler without
  a bound on size and a fixed destination path.

---

## 7. External integrations and webhooks

### Webhooks — verify first, then act

A webhook endpoint is unauthenticated by design: the provider cannot carry your request
signature. The provider's own signature is therefore the **only** control on that route.

- The provider signature **MUST** be verified as the handler's **first action** — before any
  database read, before lock acquisition, before any status check, before any state change.
- Signature comparison **MUST** be constant-time. A plain `!==` on a hash leaks timing.
- A request that fails verification **MUST NOT** mutate state. Not the order, not its status,
  not its audit log, not a counter. Reject it.

> This is the rule most often broken in a way that looks harmless. Writing a "failed" status
> before throwing feels like good auditing. It hands an unauthenticated caller the ability to
> change record state and inject attacker-controlled strings into an audit trail — and it can
> move the record out of whatever set a reconciliation job sweeps.

- Signature verification **MUST NOT** be conditional on a caller-supplied discriminator. If a
  flag in the payload, or in a queue job, can skip verification, verification is optional.
- Webhooks **MUST** have replay protection: a provider event ID stored with a unique
  constraint, or a timestamp freshness window. Status guards alone are duplicate suppression,
  not replay protection.
- A webhook route **MUST** be rate-limited. Exempting it from throttling because the provider
  is trusted also exempts everyone else.
- The payload **MUST** be treated as untrusted input after verification too — validate it.

### Providers

- Provider credentials **MUST** come from configuration, never from code.
- TLS verification **MUST NOT** be disabled.
- Every client **MUST** have an explicit timeout.
- Non-idempotent provider calls **MUST NOT** be retried (`01` §10).
- Provider responses **MUST NOT** be passed through verbatim to API callers — they leak
  upstream structure, and sometimes credentials.

---

## 8. Secrets

- Secrets **MUST NOT** be hard-coded, committed, or written into a database in cleartext.
- Secrets **MUST NOT** appear in error messages or API responses.
- API keys, client secrets and the request-signature secret are Class B: they **MUST** be
  redacted in every log (§1), and **MUST NOT** reach stdout, an error tracker, or any
  external service. Every other secret **MUST NOT** be logged at all.
- Environment files, certificates, keystores and service-account JSON **MUST NOT** be read
  or printed by tooling or agents. Variable _names_ are fine; values are not.
- Secrets **SHOULD** be rotatable without a code change.
- Long-lived static credentials **SHOULD** be replaced by short-lived, automatically rotated
  ones where the platform supports it.
- A rotation procedure **MUST** exist and be documented in `.ai/standards/03-project-architecture.md`,
  including what breaks during rotation.
- A leaked secret **MUST** be rotated, not merely removed from the code. Git history and log
  stores retain it.
- A secret scan **MUST** run in CI (`01` §18).

---

## 9. Transport and headers

- Security headers **MUST** be set by a maintained middleware. **MUST NOT** weaken or disable
  one without recording the reason.
- HSTS **MUST** be enabled in production.
- CORS origins **MUST** be an exact-match allowlist. **MUST NOT** use a wildcard, and
  **MUST NOT** reflect the request's origin.
- Allowing requests with no `Origin` header is a deliberate choice (it permits server-to-server
  and native clients). It **SHOULD** be a documented one.
- Rate limiting **MUST** be enabled globally, and **MUST** key on the real client IP when
  behind a proxy.
- **MUST NOT** strip `Retry-After` from a 429. It leaves clients with no backoff signal and
  produces retry storms.
- API documentation **MUST NOT** be exposed in production. Where exposed in lower
  environments it **MUST** require authentication and **MUST** fail closed when credentials
  are not configured.
- An unauthenticated operational endpoint (metrics, queue dashboard, health) **MUST** be
  restricted by network policy or an IP allowlist, and **MUST NOT** expose route inventory,
  timings or internal state publicly.

---

## 10. Object storage

- Authorization for an object **MUST** come from a database ownership lookup.
  **MUST NOT** authorize by parsing the object key.
- Object keys **MUST NOT** be treated as secrets, and **SHOULD** contain sufficient entropy
  that they are not enumerable.
- An object's ACL **MUST NOT** be widened as a side effect of any operation. A maintenance or
  repair routine **MUST NOT** change visibility.
- Presigned URLs **SHOULD** have the shortest practical expiry, and **SHOULD** constrain content
  type and size.
- An endpoint that mints upload URLs **MUST** be authenticated. An unauthenticated presign
  endpoint is an open write into your bucket.
- Class C documents — ID images, liveness captures, bank documents — **MUST** be stored in a
  private bucket. Logging their reference is permitted (§1); widening the object itself is not.

---

## 11. Supply chain

- A lockfile **MUST** be committed (`01` §16).
- Dependency vulnerability scanning **MUST** run in CI, and findings **SHOULD** be triaged.
- A private/internal package that performs a security function — redaction, signature
  verification, authentication — **MUST** have its version pinned and recorded in
  `.ai/standards/03-project-architecture.md`, and its **behaviour verified**, not assumed from its name.
  A change to its defaults is a change to your security posture.

---

## 12. When something leaks

If a credential or personal data has been exposed — in a log, stdout, an API response, a
commit, a screenshot, a ticket, an export, or any third-party service:

1. **Stop and report it.** Do not attempt a quiet fix.
2. **MUST NOT** delete logs or rewrite history before the exposure is assessed — that
   destroys the evidence needed to scope it.
3. Rotate the credential. Removing it from code does not un-leak it.
4. Determine scope: what was exposed, where it was written, who could read it, for how long.
5. Only then remediate the code path that caused it.

An agent that notices an exposure **MUST** surface it to the user immediately, name the file
and line, and **MUST NOT** treat it as a routine cleanup task to be bundled into other work.
