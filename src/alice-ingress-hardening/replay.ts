// ─────────────────────────────────────────────────────────────
// ALICE INGRESS HARDENING PACK v1.0 — Replay Protection
//
// Detects repeated identical ingress requests within a bounded window.
// Uses request fingerprint + bounded replay window.
// If request is repeated → reject truthfully, don't call protocol adapter.
// ─────────────────────────────────────────────────────────────

import type { AliceIngressFingerprint } from "./types.js";
import { fingerprintsMatch } from "./fingerprint.js";

// In-memory replay window (bounded size)
const _replayWindow: Map<string, { fingerprint: AliceIngressFingerprint; seenAt: number }> = new Map();
const _maxWindowSize = 1000;
const _replayWindowMs = 60 * 1000; // 60 seconds default

export function setReplayWindowMs(ms: number): void {
  // Bounded: min 10s, max 5min
  _replayWindowMs = Math.min(Math.max(ms, 10_000), 300_000);
}

export function isReplayRequest(fingerprint: AliceIngressFingerprint): boolean {
  // Clean expired entries
  cleanExpiredEntries();

  // Check for matching fingerprint in window
  for (const [, entry] of _replayWindow) {
    if (fingerprintsMatch(entry.fingerprint, fingerprint)) {
      return true;
    }
  }

  return false;
}

export function rememberIngressFingerprint(fingerprint: AliceIngressFingerprint): void {
  // Clean expired entries first
  cleanExpiredEntries();

  // Add new fingerprint
  const id = fingerprint.fingerprintId;
  _replayWindow.set(id, { fingerprint, seenAt: Date.now() });

  // Bounded window size
  if (_replayWindow.size > _maxWindowSize) {
    // Remove oldest entry
    let oldestId: string | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of _replayWindow) {
      if (entry.seenAt < oldestTime) {
        oldestTime = entry.seenAt;
        oldestId = key;
      }
    }
    if (oldestId) _replayWindow.delete(oldestId);
  }
}

function cleanExpiredEntries(): void {
  const now = Date.now();
  const toDelete: string[] = [];
  for (const [id, entry] of _replayWindow) {
    if (now - entry.seenAt > _replayWindowMs) {
      toDelete.push(id);
    }
  }
  for (const id of toDelete) {
    _replayWindow.delete(id);
  }
}

export function getReplayWindowStats(): { size: number; max: number } {
  return { size: _replayWindow.size, max: _maxWindowSize };
}

// Test-only: clear the replay window
export function clearReplayWindow(): void {
  _replayWindow.clear();
}
