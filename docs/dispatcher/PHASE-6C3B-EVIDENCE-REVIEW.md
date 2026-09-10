# Phase 6C.3B — Soft Policy Hint Evidence Review

> **Status:** EVIDENCE PHASE — no code changes to routing semantics.
> `low = +0.03` was NOT modified during this experiment.
> Controlled corpus: direct calls to `applyPolicyHintToRanking()` with synthetic fixtures.
> Replay corpus: 18 deterministic fixture scenarios × 2 health epochs × 10 repeats through the real `selectProvider()` → observer seam. Not organic live traffic — all inputs are pre-constructed.

---

## Controlled Corpus

| Metric | Value |
|--------|-------|
| Total fixtures | 529 |
| Hints applied | 513 |
| No-match (no hint) | 16 |
| Ranking changed (flips) | 384 |
| Preference defeated | 115 |
| Decision impact rate | 74.9% |
| Target win rate | 70.1% |
| Avg flip gap | 0.0109 |
| Max flip gap | 0.0300 |
| Avg rank delta (flips) | 2.35 |
| Max rank delta (flips) | 4 |

### Gap Bucket Analysis (Controlled)

| Gap bucket | Hints | Flips | Flip rate | Avg gap | Max gap |
|------------|-------|-------|-----------|---------|---------|
| 0 | 85 | 71 | 83.5% | 0.0000 | 0.0000 |
| 0.001-0.005 | 62 | 62 | 100.0% | 0.0028 | 0.0048 |
| 0.005-0.01 | 61 | 61 | 100.0% | 0.0073 | 0.0099 |
| 0.01-0.015 | 65 | 65 | 100.0% | 0.0125 | 0.0149 |
| 0.015-0.02 | 54 | 54 | 100.0% | 0.0173 | 0.0200 |
| 0.02-0.03 | 71 | 71 | 100.0% | 0.0257 | 0.0300 |
| >0.03 | 115 | 0 | 0.0% | 0.0477 | 0.0714 |

### Safety Assertions (Controlled)

| Assertion | Result |
|-----------|--------|
| Flips above bonus gap | PASS (0) |
| No-hint ranking changes | PASS (0) |
| Kill-switch changes | PASS (0) |
| Single-eligible flips | PASS (0) |

### Formal Boundary Property (Unit Test Verified)

```
gap < bonus (0.03)  → flip possible
gap = bonus (0.03)  → adjusted tie → base rank preserved → NO flip
gap > bonus (0.03)  → no flip
```

Verified by `tests/unit/provider/policy-hint.test.ts` — "hard flip boundary" test
covering gap = 0.029999 (flip), gap = 0.030000 (tie, base wins), gap = 0.030001 (no flip).

---

## Replay Corpus (Deterministic Fixture Replay)

| Metric | Value |
|--------|-------|
| Total decisions | 360 |
| Decisions with policy evidence | 360 |
| Hints applied | 140 |
| Ineligible (no rule match) | 220 |
| Ranking changed (flips) | 120 |
| Preference defeated | 0 |
| Decision impact rate | 85.7% |
| Target win rate | 100.0% |
| Avg base gap (all applied) | 0.0054 |
| Max base gap (all applied) | 0.0150 |
| Avg flip gap | 0.0063 |
| Max flip gap | 0.0150 |
| Avg rank delta (flips) | 1.33 |
| Max rank delta (flips) | 4 |

### Gap Bucket Analysis (Replay)

| Gap bucket | Hints | Flips | Flip rate | Avg gap | Max gap |
|------------|-------|-------|-----------|---------|---------|
| 0 | 20 | 0 | 0.0% | 0.0000 | 0.0000 |
| 0.005-0.01 | 100 | 100 | 100.0% | 0.0050 | 0.0050 |
| 0.01-0.015 | 10 | 10 | 100.0% | 0.0100 | 0.0100 |
| 0.015-0.02 | 10 | 10 | 100.0% | 0.0150 | 0.0150 |

### Safety Assertions (Replay)

| Assertion | Result |
|-----------|--------|
| Flips above bonus gap | PASS (0) |
| No-hint ranking changes | PASS (0) |

---

## Combined Summary

| Metric | Controlled | Replay | Combined |
|--------|-----------|------|----------|
| Decisions | 529 | 360 | 889 |
| Applied hints | 513 | 140 | 653 |
| Flips | 384 | 120 | 504 |
| Defeated | 115 | 0 | 115 |
| Impact rate | 74.9% | 85.7% | 77.2% |
| Max flip gap | 0.0300 | 0.0150 | 0.0300 |

---

## Flipped Decision Details (Controlled — Top 20 by Gap)

| ID | Gap | Base winner | Preferred | Base score | Pref score | Bonus | Adjusted | Hypothetical | Rank Δ |
|----|-----|-------------|-----------|------------|------------|-------|----------|-------------|--------|
| ctrl-0462 | 0.0300 | kimi_api | openai_api | 0.9601 | 0.9301 | +0.030 | 0.9601 | openai_api | #2→#0 |
| ctrl-0463 | 0.0300 | kimi_api | openai_api | 0.9662 | 0.9362 | +0.030 | 0.9662 | openai_api | #2→#0 |
| ctrl-0465 | 0.0300 | kimi_api | openai_api | 0.9278 | 0.8978 | +0.030 | 0.9278 | openai_api | #2→#0 |
| ctrl-0468 | 0.0300 | kimi_api | openai_api | 0.9672 | 0.9372 | +0.030 | 0.9672 | openai_api | #2→#0 |
| ctrl-0469 | 0.0300 | kimi_api | openai_api | 0.9418 | 0.9118 | +0.030 | 0.9418 | openai_api | #2→#0 |
| ctrl-0514 | 0.0300 | kimi_api | openai_api | 0.9539 | 0.9239 | +0.030 | 0.9539 | openai_api | #2→#0 |
| ctrl-0519 | 0.0300 | kimi_api | openai_api | 0.9531 | 0.9231 | +0.030 | 0.9531 | openai_api | #2→#0 |
| ctrl-0521 | 0.0300 | kimi_api | openai_api | 0.9208 | 0.8908 | +0.030 | 0.9208 | openai_api | #2→#0 |
| ctrl-0404 | 0.0299 | kimi_api | openai_api | 0.9262 | 0.8963 | +0.030 | 0.9263 | openai_api | #2→#0 |
| ctrl-0313 | 0.0298 | kimi_api | deepseek_api | 0.9613 | 0.9315 | +0.030 | 0.9615 | deepseek_api | #3→#0 |
| ctrl-0271 | 0.0298 | kimi_api | openai_api | 0.9468 | 0.9170 | +0.030 | 0.9470 | openai_api | #1→#0 |
| ctrl-0300 | 0.0297 | kimi_api | deepseek_api | 0.9375 | 0.9078 | +0.030 | 0.9378 | deepseek_api | #3→#0 |
| ctrl-0281 | 0.0295 | kimi_api | openai_api | 0.9386 | 0.9091 | +0.030 | 0.9391 | openai_api | #2→#0 |
| ctrl-0316 | 0.0295 | kimi_api | deepseek_api | 0.9498 | 0.9203 | +0.030 | 0.9503 | deepseek_api | #3→#0 |
| ctrl-0291 | 0.0294 | kimi_api | openai_api | 0.9209 | 0.8915 | +0.030 | 0.9215 | openai_api | #2→#0 |
| ctrl-0322 | 0.0292 | kimi_api | zyloo_api | 0.9688 | 0.9396 | +0.030 | 0.9696 | zyloo_api | #4→#0 |
| ctrl-0317 | 0.0288 | kimi_api | deepseek_api | 0.9246 | 0.8958 | +0.030 | 0.9258 | deepseek_api | #3→#0 |
| ctrl-0305 | 0.0287 | kimi_api | zyloo_api | 0.9395 | 0.9108 | +0.030 | 0.9408 | zyloo_api | #3→#0 |
| ctrl-0318 | 0.0287 | kimi_api | deepseek_api | 0.9406 | 0.9119 | +0.030 | 0.9419 | deepseek_api | #3→#0 |
| ctrl-0279 | 0.0284 | kimi_api | openai_api | 0.9300 | 0.9016 | +0.030 | 0.9316 | openai_api | #2→#0 |
| ... | | | | | | | | | 364 more |

## Flipped Decision Details (Replay)

| Request ID | Gap | Base winner | Preferred | Bonus | Adjusted | Hypothetical | Actual | Rank Δ |
|------------|-----|-------------|-----------|-------|----------|-------------|--------|--------|
| shadow-healthy-deeps | 0.0150 | kimi_local_web_api | deepseek_api | +0.030 | 0.9750 | deepseek_api | deepseek_api | #4→#0 |
| shadow-healthy-deeps | 0.0150 | kimi_local_web_api | deepseek_api | +0.030 | 0.9750 | deepseek_api | deepseek_api | #4→#0 |
| shadow-healthy-deeps | 0.0150 | kimi_local_web_api | deepseek_api | +0.030 | 0.9750 | deepseek_api | deepseek_api | #4→#0 |
| shadow-healthy-deeps | 0.0150 | kimi_local_web_api | deepseek_api | +0.030 | 0.9750 | deepseek_api | deepseek_api | #4→#0 |
| shadow-healthy-deeps | 0.0150 | kimi_local_web_api | deepseek_api | +0.030 | 0.9750 | deepseek_api | deepseek_api | #4→#0 |
| shadow-healthy-deeps | 0.0150 | kimi_local_web_api | deepseek_api | +0.030 | 0.9750 | deepseek_api | deepseek_api | #4→#0 |
| shadow-healthy-deeps | 0.0150 | kimi_local_web_api | deepseek_api | +0.030 | 0.9750 | deepseek_api | deepseek_api | #4→#0 |
| shadow-healthy-deeps | 0.0150 | kimi_local_web_api | deepseek_api | +0.030 | 0.9750 | deepseek_api | deepseek_api | #4→#0 |
| shadow-healthy-deeps | 0.0150 | kimi_local_web_api | deepseek_api | +0.030 | 0.9750 | deepseek_api | deepseek_api | #4→#0 |
| shadow-healthy-deeps | 0.0150 | kimi_local_web_api | deepseek_api | +0.030 | 0.9750 | deepseek_api | deepseek_api | #4→#0 |
| shadow-healthy-auto- | 0.0100 | kimi_api | deepseek_api | +0.030 | 0.9750 | deepseek_api | kimi_api | #2→#0 |
| shadow-healthy-auto- | 0.0100 | kimi_api | deepseek_api | +0.030 | 0.9750 | deepseek_api | kimi_api | #2→#0 |
| shadow-healthy-auto- | 0.0100 | kimi_api | deepseek_api | +0.030 | 0.9750 | deepseek_api | kimi_api | #2→#0 |
| shadow-healthy-auto- | 0.0100 | kimi_api | deepseek_api | +0.030 | 0.9750 | deepseek_api | kimi_api | #2→#0 |
| shadow-healthy-auto- | 0.0100 | kimi_api | deepseek_api | +0.030 | 0.9750 | deepseek_api | kimi_api | #2→#0 |
| shadow-healthy-auto- | 0.0100 | kimi_api | deepseek_api | +0.030 | 0.9750 | deepseek_api | kimi_api | #2→#0 |
| shadow-healthy-auto- | 0.0100 | kimi_api | deepseek_api | +0.030 | 0.9750 | deepseek_api | kimi_api | #2→#0 |
| shadow-healthy-auto- | 0.0100 | kimi_api | deepseek_api | +0.030 | 0.9750 | deepseek_api | kimi_api | #2→#0 |
| shadow-healthy-auto- | 0.0100 | kimi_api | deepseek_api | +0.030 | 0.9750 | deepseek_api | kimi_api | #2→#0 |
| shadow-healthy-auto- | 0.0100 | kimi_api | deepseek_api | +0.030 | 0.9750 | deepseek_api | kimi_api | #2→#0 |
| shadow-healthy-auto- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-degraded-auto | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-healthy-auto- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-degraded-auto | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-healthy-auto- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-degraded-auto | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-healthy-auto- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-degraded-auto | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-healthy-auto- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-degraded-auto | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-healthy-auto- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-degraded-auto | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-healthy-auto- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-degraded-auto | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-healthy-auto- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-degraded-auto | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-healthy-auto- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-degraded-auto | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-healthy-auto- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-healthy-kimi- | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-degraded-auto | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_api | #1→#0 |
| shadow-degraded-kimi | 0.0050 | kimi_local_web_api | kimi_api | +0.030 | 0.9850 | kimi_api | kimi_local_web_api | #1→#0 |

---

## Interpretation

The `low → +0.03` bonus acts as a **bounded influence** among providers whose production-score gap is below 0.03. Key observations:

1. **Zero flips at or above the bonus gap** — the mechanism never overrides a provider with gap >= 0.03. At exactly gap = 0.03, adjusted scores tie and base rank is preserved.
2. **Impact drops sharply at the bonus boundary** — the `>0.03` bucket shows 0% flip rate.
3. **Flips are strictly in the sub-0.03 gap zone** — this is the proven bounded-influence region.
4. **Equal adjusted scores preserve base rank** — the stable sort prevents artificial reordering.
5. **No-hint and kill-switch scenarios produce zero ranking changes** — fail-open behavior confirmed.
