# Build Check Readiness

## Intent

Use this skill to verify repository readiness through actual script and command evidence.

## Core Rules

- Never claim READY without evidence
- Never invent scripts that do not exist
- Never invent successful build/check results
- Prefer minimal safe verification
- Prefer exact script names and exact command outputs
- If evidence is incomplete, return PARTIAL instead of READY

## Execution Flow

1. Inspect package.json and available scripts
2. Identify build/check/typecheck/test scripts if present
3. Run only the minimal safe readiness verification needed
4. Capture exact results
5. Return a strict readiness verdict:
   - READY
   - PARTIAL
   - BLOCKED

## Output Format

- repository scripts found
- commands run
- exact evidence observed
- blockers
- final readiness verdict

## Hard Denials

- No invented scripts
- No invented success states
- No silent dependency installation
- No broad refactors
- No architecture expansion