# BG-01M2V18R: Deterministic editorial fallback reuses unapproved subheadline numbers

> **Status:** inbox
> **Created:** 2026-09-18
> **Created-by:** sdlc-studio new
> **Raised-by:** sdlc-studio; agent; v1
> **Affects:** src/ai/fallbackEditorial.js, src/ai/humanEditorial.js, src/ai/orchestrator.test.js
> **Severity:** Medium
> **Points:** 2

## Summary

When live issue data contains a numeric subheadline value outside the Q8 fact packet, deterministic fallback preserves that text and final validation blocks the test newsletter instead of producing safe fallback copy.

## Steps to Reproduce

Run the orchestrator with a canonical score packet whose input `subheadline` contains an unrelated
numeric value, such as `Next stop at 170 yards.`, and with no OpenAI key.

## Expected Behaviour

The deterministic fallback replaces the untrusted subheadline with score text authorized by the packet,
and final editorial validation remains approved.

## Actual Behaviour

The fallback reused the input subheadline; Q8 correctly rejected the unsupported number and stopped the
newsletter before rendering/delivery.

## Proposed Fix

Build a deterministic score/opponent subheadline in `fallbackEditorial.js` instead of reusing the incoming
editorial subheadline, then pin the regression with the exact orchestrator test selector.

## Verification

- **Verify:** shell npm test -- --runInBand src/ai/orchestrator.test.js -t "fallback sanitizes unapproved subheadline numbers"
- **Production side effect:** none; test uses no provider and no delivery.

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-18 | sdlc-studio | Created via `new` (deterministic) |
