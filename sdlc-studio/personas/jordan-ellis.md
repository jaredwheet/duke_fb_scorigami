# Jordan Ellis

## Quick Reference

| Attribute | Value |
|-----------|-------|
| **Cast role** | Negative |
| **Interface** | Duke football publication |
| **Role** | Bulk sports-data integrator |
| **Context** | Wants a general multi-sport data export rather than Duke-specific publications. |

## Who They Are

Jordan evaluates systems as generic feeds to connect many sports and teams. Their goals would pull
this product toward a broad data platform, while the current product is a Duke football publishing
workflow.

## End Goals (stated to exclude)

1. Use one unrestricted API for many sports and teams.
2. Reconfigure publication rules for arbitrary downstream consumers.

## Why We Are Not Designing For Them

The current product's value comes from focused Duke football context, editorial review, and controlled
publication surfaces. A general bulk export is a separate product and must not weaken the Primary
fan-facing requirements.

## Behaviours & Context

- **Environment:** Automated data platform integrations.
- **Frequency:** High-volume scheduled extraction across multiple sports.
- **Proficiency:** Expects generic schemas and programmatic access.

## Frustrations

- A focused schema does not expose every sport or provider record.
- Editorial validation and publication state add constraints they do not need for bulk ingestion.

## How To Handle A Request From Them

Decline the request as out of scope for this product and record it as a separate RFC if a general
multi-sport data platform becomes an approved product direction.
