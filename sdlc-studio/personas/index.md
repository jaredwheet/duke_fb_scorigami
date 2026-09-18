# Project Personas

Personas for Duke FB Scorigami. Generated from the brownfield PRD, TRD, TSD, and implementation
risk signals on 2026-09-17.

## Primary (the design target)

- [Avery Brooks](avery-brooks.md) - Duke football follower. Needs timely, understandable,
  trustworthy score and newsletter context.

## Secondary (served, never at the Primary's expense)

- [Taylor Morgan](taylor-morgan-design.md) - publishing operator. Needs safe schedules, visible
  failures, and recoverable delivery state.

## Negative (deliberately not designed for)

- [Jordan Ellis](jordan-ellis.md) - bulk sports-data integrator. Deliberately not served by this
  Duke-specific publishing surface.

## Team Personas

Internal team members who create and review artefacts.

### Product Amigo

| Persona | Role | Summary | File |
|---------|------|---------|------|
| Jamie Carter | Product owner/editor | Protects fan value, editorial scope, and source-backed requirements. | [Details](seats/jamie-carter.md) |

### Engineering Amigo

| Persona | Role | Summary | File |
|---------|------|---------|------|
| Rowan Patel | Staff engineer | Protects deterministic data, provider boundaries, persistence, and operations. | [Details](seats/rowan-patel.md) |

### QA Amigo

| Persona | Role | Summary | File |
|---------|------|---------|------|
| Casey Nguyen | QA lead | Proves acceptance criteria, fallbacks, idempotency, and negative paths. | [Details](seats/casey-nguyen.md) |

## Stakeholder Personas

External stakeholders who use or constrain the product.

### Served Users

| Persona | Role | Summary | File |
|---------|------|---------|------|
| Avery Brooks | Duke football follower | Wants timely, understandable, trustworthy score and newsletter context. | [Details](stakeholders/avery-brooks.md) |

### Operations Stakeholders

| Persona | Role | Summary | File |
|---------|------|---------|------|
| Taylor Morgan | Publishing operator | Needs safe schedules, visible failures, and recoverable delivery state. | [Details](stakeholders/taylor-morgan.md) |

## Consultation Defaults

| Artefact | Team | Stakeholders |
|----------|------|--------------|
| PRD | Product | Served users, operations |
| TRD | Engineering | Operations |
| TSD | QA, Engineering | Operations |
| Epic | Product, Engineering | Served users |
| Story | Product | Primary served user or operator |

## Provenance

| Source | Count | Notes |
|--------|-------|-------|
| Generated from PRD/codebase | 5 | Provisional cards; team cards are stamped and require acceptance. |
| Authored/imported | 0 | None at onboarding. |
