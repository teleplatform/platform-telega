# Security Policy

## Supported Versions
Only the latest version on the default branch is supported.
Security fixes are applied forward.

## Reporting a Vulnerability
Please do **not** open public issues for security-sensitive reports.

Report privately by contacting the maintainer:
- GitHub: @vijaytaitoo

Include:
- What you found (impact and affected area)
- Steps to reproduce (minimal)
- Any proof-of-concept details that are safe to share
- Suggested fix (optional)

## Disclosure Process
1) We confirm receipt.
2) We assess severity and scope.
3) We implement a fix and prepare a release/patch.
4) We coordinate disclosure timing if needed.

## Security Expectations (Contributor Rules)
- Never commit secrets (API keys, tokens, private URLs).
- Use `.env` files locally; keep `.env.example` non-sensitive.
- Avoid adding dependencies without reason.
- Prefer least-privilege access for external services.
- Keep logs free of sensitive data.

## Dependency Security
- Keep dependencies up to date.
- CI should fail on obvious build/test errors.
- If a dependency has a known critical issue, prioritize upgrading or replacing it.
