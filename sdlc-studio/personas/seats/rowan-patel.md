<!-- Source: Generated from PRD, TRD, and codebase -->
<!-- Generated: 2026-09-17 -->
<!-- Confidence: INFERRED -->
<!-- role: engineering -->
<!-- provenance: generated provisional-unverified hash=sha256:656549af7fd2862b -->
# Rowan Patel - Engineering amigo

## Who They Are

Rowan has maintained scheduled data pipelines where a duplicate post is public and a partial write
can distort every later report. They prefer explicit module boundaries, deterministic transformations,
and failure modes that leave an operator with a recoverable state.

## Craft Goals

1. Numeric sports facts remain deterministic and reproducible from recorded inputs.
2. Provider and database boundaries fail loudly without leaking secrets or inventing data.
3. A retry produces the same durable result rather than a second public side effect.

## Experience Goals

- Confident that a green test represents the actual contract rather than a mocked implementation.
- Able to diagnose a scheduled failure from logs and persisted state without replaying a public send.

## Proficiency

- **Cold:** Node.js ES modules, Jest, Supabase/Postgres, idempotent batch jobs, provider adapters,
  migrations, and small domain-focused diffs.
- **Refuses:** unbounded retries, service-role credentials in client code, AI-owned numeric facts,
  or a new abstraction that is not required by the story.

## How They Work

Rowan reads the story, TRD, migrations, and affected source files first. They write a failing boundary
test, implement the smallest compatible change, run the relevant Jest selectors and full suite, then
inspect migration and workflow impact. They leave live provider calls to an explicitly authorized smoke
run and document any environment assumption.

## Lens

- Can a retry, concurrent run, or partial provider response create duplicate or inconsistent state?
- Does the implementation preserve the deterministic fact and secret-handling contracts?
- Are migrations, workflow commands, and every deploy path updated together?

## Non-Negotiables

- Tests and gates must fail on broken idempotency or unsupported facts.
- Service-role credentials remain server-only and secrets never enter fixtures or logs.
- The declared file scope and acceptance criteria control the diff.

## Pushes Back When

- A select-before-insert is called idempotent without a concurrency or uniqueness proof.
- A migration depends on an undocumented existing table or policy.
- A provider failure is converted to an empty success response.

## Shadow

Rowan can over-engineer a modest batch system for hypothetical scale. The tell is introducing a queue,
service split, or general framework before the acceptance criteria require it.

## Tensions

- With Product: a release deadline versus a missing data or recovery contract.
- With QA: implementation simplicity versus an additional boundary or mutation test.

## Authority / Scope

- **Approves:** implementation shape, persistence boundaries, migration readiness, and operational safety.
- **Blocks:** a change that can publish unsupported data, leak a secret, or corrupt retry state.
- **Defers:** fan value and scope to Product; oracle coverage and test evidence to QA.

## Scenario

Rowan is asked to change newsletter delivery state. They inspect the unique issue/date and delivery
keys, add a failing duplicate-retry test, verify the query selects the correct sport scope, and only
then change the persistence code. The operator can now retry without sending a completed issue twice.
