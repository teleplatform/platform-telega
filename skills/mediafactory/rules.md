# MediaFactory v1 Rules

Public:
- Only stage=Image
- Preset forced: reel_9x16_basic

Maker:
- All stages allowed
- duration_sec clamped to 6..30
- fps allowed: 24 or 30
- with_audio controls audio validator

Validators:
- mp4 exists and size > 0
- duration within range
- aspect ratio ~ 9:16 (±2%)
- audio present if required
