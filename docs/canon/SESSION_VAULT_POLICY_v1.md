# SESSION VAULT POLICY v1


Status: CANONICAL
Owner: Nikita (Maker)
Scope: Tele•GPT Creator Web Providers (browser connector)
Version: 1.0.0
Date: 2026-02-01


## Canon
We do NOT store raw passwords.
We store session artifacts "as browser remembers":
- storageState (cookies + localStorage/sessionStorage) OR
- persistent profile (userDataDir) when needed for stability.


All session artifacts are encrypted at rest (Session Vault).


## Allowed
- Encrypted Session Vault (storageState / profile) ✅
- API keys / tokens ✅


## Forbidden by default
- Raw passwords in DB/files/Supabase ❌
- Any captcha/security bypass attempts ❌


## Optional (Owner/Maker only, local only)
If autofill is absolutely required:
- password may exist only in OS secure storage:
  - macOS Keychain / Android Keystore / Windows Credential Manager
- usage requires manual confirmation (human-in-the-loop)


## Healthcheck + Relogin
- web:health <provider> checks:
  - chat page opens
  - input visible
  - no redirect to login
- if health fails → provider status = blocked: re-login required
- re-login is ONLY manual in headful browser session
