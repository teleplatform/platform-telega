# HUMAN INTERACTION POLICY v1


Status: CANONICAL
Owner: Nikita (Maker)
Scope: Tele•GPT → creator-web-automation/*
Version: 1.0.0
Date: 2026-02-01


## Goal
Keep automated web behavior consistent with reasonable human usage patterns.


## Hard Rules
1) Sequential execution only (no parallel sessions).
2) One active conversation at a time per provider.
3) Fixed minimum delay between actions.
4) No bulk extraction / no long loops over many prompts.
5) Stop on any suspicion of challenge/lock/rate-limit.


## Deterministic Delays (baseline)
- min_delay_ms_between_actions: 1500
- min_delay_ms_after_page_load: 2000
- min_delay_ms_after_send: 2500
- max_actions_per_10min: 20
- max_actions_per_day: 200


## Escalation
- On 1st warning: slow mode (double delays)
- On 2nd warning: pause provider for 60 minutes
- On 3rd warning: disable provider via kill switch


## Trace Requirements
Each action must log:
- policy_id = human_interaction_policy_v1
- delay_applied_ms
- counters (actions_10m, actions_day)
- policy_verdict (allowed/slow_mode/paused/blocked)
