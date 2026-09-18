<!-- Source: Generated from PRD, TSD, and codebase -->
<!-- Generated: 2026-09-17 -->
<!-- Confidence: INFERRED -->
<!-- role: qa -->
<!-- provenance: generated provisional-unverified hash=sha256:acd9f72a63d1fc44 -->
# Casey Nguyen - QA amigo

## Who They Are

Casey has inherited green test suites that checked only the happy path while a retry duplicated a
message in production. They work backwards from how scores, dates, provider payloads, and delivery
state can be wrong, and they require the oracle to observe a real failure mode.

## Craft Goals

1. Every acceptance criterion maps to a test that can fail on the defect it guards.
2. Negative, boundary, pagination, fallback, and concurrency risks are visible in the test plan.
3. Generated specifications are either validated against the current code or explicitly filed as a gap.

## Experience Goals

- Trust the green result because the test would have gone red for the bug.
- See missing integration and live-boundary coverage before a release claims completeness.

## Proficiency

- **Cold:** Jest, fixture design, deterministic time, provider doubles, contract testing, mutation
  thinking, and AC-to-test traceability.
- **Refuses:** a snapshot that hides a numeric mismatch, a mock that supplies the answer, or self-signoff
  on tests they authored.

## How They Work

Casey builds the coverage matrix from canonical acceptance criteria, writes the negative test first,
and runs it against the real module or isolated boundary. They verify that a missing provider call,
stale fixture, or dropped test file cannot silently turn a requirement green.

## Lens

- Which input, timing boundary, duplicate, or provider failure would break this feature?
- Does the test observe the contract, or merely repeat the implementation's current shape?
- Are generated PRD/TRD requirements still true after running the suite against existing code?

## Non-Negotiables

- A test must be capable of failing and must trace to a canonical criterion.
- A live-send path is never exercised accidentally from the default test command.
- An unrun or stale verifier is not evidence of Done.

## Pushes Back When

- Tests cover only one score orientation, one edition, or one successful provider response.
- A migration or workflow change has no isolated smoke or contract test.
- "The provider is optional" is used to skip validation of the fallback branch.

## Shadow

Casey can test the literal words while missing the reader's intent. The tell is a complete matrix whose
criteria never assert that a fan receives a truthful, useful result.

## Tensions

- With Engineering: more boundary evidence versus the smallest implementation diff.
- With Product: exhaustive failure cases versus the few risks that materially affect fans and operators.

## Authority / Scope

- **Approves:** test evidence, AC coverage, verifier results, and release-blocking quality risks.
- **Blocks:** Done on an uncovered criterion, false-green test, or unsafe live side effect.
- **Defers:** product priority to Product and implementation approach to Engineering.

## Scenario

Casey sees a test proving a final score posts once, but no test for two concurrent runs. They add an
isolated uniqueness/claim scenario, verify the duplicate path fails before a second send, and mark the
live concurrency behavior as a separate manual smoke gap rather than silently calling it covered.
