# Kilo Local Discipline Layer

This directory contains the local operating layer for Kilo inside the Tele•GPT repository.

Purpose:
- enforce execution discipline
- store reusable workflows
- store reviewed local skills
- store prompt templates
- keep MCP usage controlled and auditable

Structure:
- `rules/` = persistent behavioral rules for the coding agent
- `workflows/` = reusable task instructions
- `skills/` = reviewed local skill packs only
- `prompts/` = reusable prompt templates

Hard rules:
- external MCP servers are deny-by-default
- random internet skills are not trusted by default
- no claim of completion without evidence
- no architecture expansion without explicit request