# Contributing

All commands assume you are in the repo root.

## First-time setup (labels)
This repo uses labels for PR automation and release notes grouping.
Before your first PR, run:

```bash
./scripts/bootstrap-labels.sh
```

## Search (ripgrep)

macOS may block access to some `~/Library/**` paths (TCC privacy), which causes
`Operation not permitted` messages when searching from `$HOME`.

Always search from the repo root:

```bash
cd ~/Projects/tele-gpt
rg -n "pattern" .
```

If you must search in `$HOME`, exclude `Library`:

```bash
rg -n "pattern" ~ --glob '!Library/**'
```

Quiet mode (hide permission warnings):

```bash
rg -n "pattern" ~ --no-messages
```
