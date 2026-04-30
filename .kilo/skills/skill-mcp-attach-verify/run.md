# Run: MCP Attach Verify

Steps:

1. Check MCP server presence
- Verify that `telegpt_bridge` is visible

2. Check tools list
- Run tools/list
- Confirm tools are not empty
- Record tool names

3. Execute safe verification
- Call `telegpt_runtime_binding_verify` if available
- Capture raw response

4. Evaluate result

Return one of:

READY:
- server visible
- tools present
- binding verify returns ok:true

PARTIAL:
- server visible but tools missing OR binding unclear

BLOCKED:
- server not visible OR tools/list fails

Output format:

- server: found / not found
- tools: count + names
- binding: result
- verdict: READY | PARTIAL | BLOCKED