# MCP Repo Truth Guard

## Intent

Use this skill to verify execution reality before claiming success.

## Core Rules

- Never claim MCP is connected unless server/tool evidence exists
- Never claim a file exists unless it is actually present
- Never claim build/test success unless it was actually run
- Never infer completion from partial signals
- Prefer exact paths, exact commands, exact results
- If evidence is incomplete, return PARTIAL instead of DONE

## Execution Flow

1. Check whether MCP server is visible
2. Check whether expected tools are visible
3. Run the minimal safe verification tool if available
4. Check repository files relevant to the task
5. Check whether claimed outputs actually exist
6. Return a strict verdict:
   - OK
   - PARTIAL
   - FAIL

## Output Format

- MCP status
- tools status
- repository truth checks
- evidence observed
- final verdict

## Hard Denials

- No invented evidence
- No invented file paths
- No invented success states
- No architecture expansion
- No dependency additions