<!-- Source: Generated from PRD, TRD, and GitHub Actions -->
<!-- Generated: 2026-09-17 -->
<!-- Confidence: INFERRED -->
<!-- stakeholder: ops -->
# Taylor Morgan - publishing operator

> **Cast:** Customer (Taylor is accountable for the publishing operation but does not author the
> application code.)
>
> **Arbitration:** Taylor's operational goals never override the Primary persona's interface. When
> Taylor's wants conflict with what the Primary user needs, the Primary wins the interface and Taylor's
> needs are met through workflow controls, logs, delivery state, and runbooks.

## Who They Are

Taylor owns the scheduled publishing calendar and is the person who investigates a failed Actions run
before the next edition. They have dealt with provider outages and accidental duplicate sends, so they
prefer explicit state, bounded jobs, and a safe test path over opaque automation.

## What They Want

1. Scheduled jobs finish within their timeout and expose enough state to recover safely.
2. Manual ingestion and newsletter tests have explicit inputs and never surprise a public recipient.
3. Schema migrations, secrets, retries, and known gaps have a documented owner and procedure.

## Veto Lines

- No production release without required migrations, secret checks, and a green test gate.
- No workflow that can send to a real recipient or public X account from the default test suite.
- No delivery path that cannot distinguish failed, completed, and not-yet-attempted work.

## Evidence They Read

- GitHub Actions run status, logs, inputs, timeout, and concurrency configuration.
- Supabase issue/delivery/tweet state and migration history.
- Jest result, SDLC reconciliation, and release review evidence.

## Consultation Stance

- **Always asks:** If this run fails halfway through, what can I safely retry and how do I know?
- **Reassured by:** idempotency keys, deterministic fallback tests, explicit migration order, and an
  operator-visible recovery path.
