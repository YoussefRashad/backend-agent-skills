# ADR-006: Redact credentials and personal data in every log by default

## Status

Accepted. Decision (maintainer, 2026-11-10). Shipped as `backend-standards` 3.0.0.

## Context

A consumer-finance backend handling OTPs, tokens, national IDs and card data has to
choose what a request/response log may contain. Capturing everything makes per-request
dispute resolution and incident forensics easy, and turns the log store into a credential
and personal-data store. Redacting protects the log store and makes that forensic work
harder.

A standard that many unrelated services adopt cannot assume what protects any one
service's log store. The default therefore has to be the one that is safe without knowing.

## Decision

Two classes are **redacted in every log**, in requests and in responses:

- **Class B** — OTP, access and refresh tokens, `Authorization` header, session ID, API
  key, client secret, request-signature secret, biometric signature.
- **Class C** — national ID, passport, full phone, full name, DOB, address, email, bank
  account, IBAN, geolocation, device identifier, ID-document and liveness references,
  credit-bureau data, address book.

**Class A is unchanged.** PIN, password, PAN, CVV, card token and private keys are masked
always, in every environment, including while debugging — PCI DSS prohibits storing CVV
after authorization and requires PAN to be masked, and a documented risk acceptance does
not satisfy an assessor.

## The optional risk acceptance

An organization that needs a complete per-request trail **MAY** capture Class B and Class C
unredacted, inside one closed request/response log store. That is a deviation from `02`: it
is recorded as a risk acceptance in the adopting project's `known-deviations.md` §3, signed
by someone who can accept the risk, with an expiry. It holds only while all four stay true:

1. No API, dashboard, report or export exposes log contents.
2. Access to the log store is restricted; no general engineering or support access.
3. Retention is a short, mechanically enforced period.
4. Logs are not replicated, restored or exported into a lower-trust environment.

**A change that breaks any of the four is a change to the risk acceptance**, not a feature.
It must be raised with whoever signed it before it ships, and an agent that encounters one
must stop and ask. No risk acceptance covers Class A.

## Alternatives Considered

| Option                                                              | Pros                                                                    | Cons                                                                                                |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Redact B and C by default; capture only by risk acceptance (chosen) | Safe without knowing the adopter's log store; the exception is explicit | Dispute resolution works from Class D identifiers unless the organization opts in                   |
| Capture B and C unredacted under four conditions, as the default    | Complete per-request trail; disputes resolvable without reproducing     | Every adopter inherits a credential and personal-data store whether or not the four conditions hold |
| Redact B and C, with a break-glass unmask                           | Middle ground                                                           | Needs a second access path and its own trail — more surface, not less                               |

## Consequences

- A project re-syncing from 2.x **must change code**: its redaction key list has to cover
  the Class B and Class C fields in `02` §2.1, or it has to record the risk acceptance.
  That is why this is a major bump.
- Tracing leans on Class D — correlation ID, user ID, order ID — which works in every
  environment and carries no exposure.
- Where an organization opts in, its log store **is** a credential and personal-data
  store. Access restriction and mechanical retention are load-bearing controls, not
  hygiene. Tokens and OTPs expire; request-signature and API/client secrets do **not**, so
  rotation is the only control bounding a logged secret.
- Class B and C **MUST NOT** reach stdout, an error tracker, an APM or any third-party
  service, with or without a risk acceptance. This is why `no-console` is an `error` in
  the canonical lint config: `console` writes to stdout, past the logger's redaction.

## Evidence

- `backend-standards/references/02-security-and-compliance.md` §1 — the Class B and
  Class C redaction rules, the optional risk acceptance and its four conditions, and the
  PCI carve-out. §2.1 lists the minimum redaction keys; §2.2 scopes the capture store; §3
  requires a short, mechanical retention period for it.
- `backend-standards/templates/docs/known-deviations.md` §3 — where a risk acceptance is
  recorded.
- `backend-standards/templates/agents/docs-sync.md` § 5 — instructs the agent to stop and
  raise it if a change breaks one of the four conditions.
