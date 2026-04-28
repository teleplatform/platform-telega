"use client";

import React, { useState } from "react";

export function VoiceRenameInline({
  voice_id,
  current,
  onDone,
}: {
  voice_id: string;
  current: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(current);
  const [busy, setBusy] = useState(false);

  async function save() {
    const name = val.trim();
    if (!name) return;
    setBusy(true);
    try {
      const r = await fetch("/api/voice/rename", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ voice_id, label: name }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "rename_failed");
      setOpen(false);
      onDone();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          setVal(current);
          setOpen(true);
        }}
        className="rounded-xl bg-white/10 px-3 py-2 text-xs hover:bg-white/15"
      >
        Переименовать
      </button>
    );
  }

  return (
    <div className="flex gap-2 items-center">
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="w-44 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none focus:border-white/20"
        placeholder="Название…"
      />
      <button
        onClick={save}
        disabled={busy || !val.trim()}
        className="rounded-xl bg-white/10 px-3 py-2 text-xs hover:bg-white/15 disabled:opacity-40"
      >
        {busy ? "…" : "OK"}
      </button>
      <button
        onClick={() => setOpen(false)}
        className="rounded-xl bg-white/10 px-3 py-2 text-xs hover:bg-white/15"
      >
        ✕
      </button>
    </div>
  );
}
