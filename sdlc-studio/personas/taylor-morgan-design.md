# Taylor Morgan

## Quick Reference

| Attribute | Value |
|-----------|-------|
| **Cast role** | Secondary |
| **Interface** | Operator workflows |
| **Role** | Publishing operator |
| **Context** | Monitors scheduled Actions runs and recovers failed ingestion or delivery jobs. |

## Who They Are

Taylor owns the publishing calendar and investigates a failed run before the next edition. They have
dealt with provider outages and duplicate sends, so they prefer explicit state, bounded jobs, and a
safe test path over opaque automation.

## End Goals

1. Know whether a scheduled job completed, failed, or can be safely retried.
2. Run ingestion and test newsletters with explicit inputs and no accidental public side effect.
3. Keep migrations, secrets, and recovery procedures understandable for the next operator.

## Experience Goals

- Feel in control during a provider outage or partial failure.
- Feel confident that a retry will not duplicate a completed publication.

## Behaviours & Context

- **Environment:** GitHub Actions, Supabase, local Node commands, and provider dashboards.
- **Frequency:** Checks scheduled jobs every publication day and runs manual recovery as needed.
- **Proficiency:** Comfortable with command-line workflows and operational state, not expected to edit domain code.

## Frustrations

- A green-looking retry that does not distinguish completed from failed delivery.
- A migration or secret prerequisite that is known only by one developer.

## Scenario

Taylor sees a newsletter job fail after issue assembly. They inspect persisted delivery state, run the
test path with an explicit date and sink recipient, and then retry only the incomplete deliveries.
