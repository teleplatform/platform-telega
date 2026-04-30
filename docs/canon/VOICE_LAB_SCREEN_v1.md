# Voice•LAB Screen v1.0 (Tele•GPT)
Status: CANONICAL
Owner: Nikita
Route: /voice-lab
Nav label: Voice•LAB
Scope: Голоса + Ассистенты (привязка голоса к ассистенту)

## UX
- Один экран, 2 вкладки:
  1) Голоса: список + rename/delete + панели Speak/Convert/Dialogue
  2) Ассистенты: список ассистентов + dropdown выбора голоса + "тест фразой"

## Security
- Speak: Public allowed
- Register/Convert/Dialogue/Rename/Delete: Maker-only
- Привязка голоса к ассистенту: Maker-only
- Все изменения пишутся в audit (voice_audit_log)

## Data
- Таблица assistant_voice_bindings: assistant_id -> voice_id
- Один ассистент может иметь 0..1 голос (можно расширить позже)
