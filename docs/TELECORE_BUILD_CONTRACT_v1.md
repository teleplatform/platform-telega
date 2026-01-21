# Tele•Core Build Contract v1.0

This contract defines the canonical JSON format for tasks sent to Forge and results returned to Tele•GPT.

## BuildTask (Tele•GPT → Forge)
```json
{
  "type": "build_task",
  "version": "1.0",
  "meta": {
    "task_id": "auto",
    "created_at": 0,
    "priority": "normal",
    "mode": "smart",
    "persona": "builder",
    "ecosystem": "telega",
    "visibility": "creator"
  },
  "goal": {
    "title": "Short goal here",
    "description": "What exactly must appear in the product."
  },
  "user_story": "As a user, I want ... so that ...",
  "scope": {
    "must_include": ["..."],
    "out_of_scope": ["..."]
  },
  "uiux": {
    "screen": "where this lives",
    "components": ["button", "modal", "form"],
    "behavior": ["click -> open modal", "submit -> success toast"],
    "states": {
      "loading": true,
      "empty": true,
      "error": true
    }
  },
  "data_api": {
    "tables": [],
    "api_routes": [],
    "auth": {
      "required": false,
      "rls": false
    },
    "logging": {
      "required": true
    }
  },
  "files": {
    "hint_paths": [],
    "allow_discovery": true
  },
  "acceptance_criteria": [
    "Criterion 1",
    "Criterion 2",
    "Criterion 3"
  ],
  "verification": {
    "commands": ["pnpm lint", "pnpm typecheck", "pnpm build"],
    "manual": ["Open screen X", "Click Y", "Validate Z"]
  },
  "constraints": {
    "public_creator_split": true,
    "minimal_patch": true,
    "no_extra_dependencies": true,
    "production_ready": true
  }
}
```

## Required fields
- `type`, `version`
- `meta.visibility` (public|creator|core)
- `goal.title`
- `scope.must_include`
- `acceptance_criteria`
- `verification.commands`

## BuildResult (Forge → Tele•GPT)
```json
{
  "type": "build_result",
  "version": "1.0",
  "summary": {
    "status": "done",
    "task_id": "same-as-input",
    "mode_used": "smart",
    "iterations_used": 1
  },
  "implemented": [
    "Implemented feature A",
    "Added endpoint B",
    "Updated UI C"
  ],
  "files_changed": [
    {
      "path": "apps/ui/src/...",
      "change": "Added button + modal flow"
    },
    {
      "path": "apps/api/src/...",
      "change": "Added route + validation"
    }
  ],
  "verification": {
    "commands": ["pnpm lint", "pnpm build"],
    "manual": ["Open screen", "Click action", "Confirm result"]
  },
  "notes": ["Edge case handled: ..."],
  "next_step": "One best next step only"
}
```

## Status values
- `done`
- `partial`
- `blocked`

Forge must never claim success if blocked.
