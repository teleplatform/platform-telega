"use client";

import { useEffect, useRef, useState } from "react";
import { TeleChip, TeleGlassPanel, TelePrimaryButton, TeleTextarea } from "@/components/tele";
import TraceDrawer from "../shared/TraceDrawer";
import FastTextArea, { type FastTextAreaHandle } from "@/ui/FastTextArea";
import { jumpTopActive } from "@/ui/activeSurface";

type SkillStage = "AutoReview" | "FixPlan" | "Patch";
type MediaStage = "Image" | "Video" | "Audio" | "Mux" | "Export";

export default function SkillsPanel({ makerMode }: { makerMode: boolean }) {
  return (
    <div className="space-y-4">
      <ReactSkillRunner makerMode={makerMode} />
      <MediaFactoryRunner makerMode={makerMode} />
    </div>
  );
}

function ReactSkillRunner({ makerMode }: { makerMode: boolean }) {
  const [stage, setStage] = useState<SkillStage>("AutoReview");
  const [code, setCode] = useState("export function Foo(){return <div>Hello</div>}");
  const [filePath, setFilePath] = useState("src/components/Foo.tsx");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [result, setResult] = useState<any>(null);
  const [traceOpen, setTraceOpen] = useState(false);
  const codeRef = useRef<FastTextAreaHandle | null>(null);
  const [showJump, setShowJump] = useState(false);


  async function run() {
    setStatus("loading");
    try {
      const codeValue = codeRef.current?.getText() ?? code;
      const res = await fetch("/api/v1/skills/react-best-practices/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage,
          code: codeValue,
          file_path: filePath,
          maker_mode: makerMode,
        }),
      });
      const json = await res.json();
      setResult(json);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <TeleGlassPanel className="p-4 space-y-3">
      <div className="text-sm text-muted-foreground">React Best Practices</div>
      <div className="flex flex-wrap gap-2">
        {(["AutoReview", "FixPlan", "Patch"] as SkillStage[]).map((s) => (
          <TeleChip key={s} label={s} active={stage === s} onClick={() => setStage(s)} />
        ))}
      </div>

      <div className="text-xs text-muted-foreground">File path</div>
      <TeleTextarea value={filePath} onChange={setFilePath} rows={1} />

      <div className="text-xs text-muted-foreground">Code</div>
      {showJump && (
        <button
          type="button"
          className="text-xs opacity-80 hover:opacity-100"
          onClick={() => jumpTopActive({ preferId: "skills-code", sourceId: "JumpButton:skills-code" })}
        >
          ↑ к началу
        </button>
      )}
      <FastTextArea
        ref={codeRef}
        defaultValue={code}
        onChangeDebounced={setCode}
        onScrollStateChange={(top) => setShowJump(top > 120)}
        surfaceId="skills-code"
        surfaceType="code"
        rememberScroll
        className="telegpt-fasttext tele-glass w-full min-h-[240px] max-h-[240px] rounded-tele-input p-3 text-foreground placeholder:text-muted-foreground"
      />

      <div className="flex items-center gap-2">
        <TelePrimaryButton onClick={run} disabled={status === "loading"}>
          Run
        </TelePrimaryButton>
        {!makerMode && stage === "Patch" && (
          <div className="text-xs text-muted-foreground">Maker required for Patch.</div>
        )}
        {status === "error" && (
          <div className="text-xs text-muted-foreground">Run failed.</div>
        )}
      </div>

      {result && (
        <TeleGlassPanel className="p-3">
          <div className="text-xs text-muted-foreground mb-2">Result</div>
          {result.issues && (
            <ul className="text-sm space-y-2">
              {result.issues.map((i: any, idx: number) => (
                <li key={idx}>
                  <strong>{i.title}</strong> — {i.suggestion}
                </li>
              ))}
            </ul>
          )}
          {result.fix_plan?.steps && (
            <ul className="text-sm space-y-2">
              {result.fix_plan.steps.map((s: string, idx: number) => (
                <li key={idx}>{s}</li>
              ))}
            </ul>
          )}
          {result.patch_diff && (
            <pre className="text-xs whitespace-pre-wrap">{result.patch_diff}</pre>
          )}
          {result.trace_id && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
              trace: {result.trace_id}
              <button
                type="button"
                className="text-white/70 hover:text-white"
                onClick={() => setTraceOpen(true)}
              >
                Details
              </button>
            </div>
          )}
          {result.trace_id && (
            <TraceDrawer
              open={traceOpen}
              onOpenChange={setTraceOpen}
              traceId={result.trace_id}
              makerMode={makerMode}
            />
          )}
        </TeleGlassPanel>
      )}
    </TeleGlassPanel>
  );
}

function MediaFactoryRunner({ makerMode }: { makerMode: boolean }) {
  const [stage, setStage] = useState<MediaStage>("Image");
  const [prompt, setPrompt] = useState("Minimal reel teaser");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [result, setResult] = useState<any>(null);
  const [traceOpen, setTraceOpen] = useState(false);
  const promptRef = useRef<FastTextAreaHandle | null>(null);
  const [showJump, setShowJump] = useState(false);


  const stages: MediaStage[] = ["Image", "Video", "Audio", "Mux", "Export"];

  async function run() {
    setStatus("loading");
    try {
      const promptValue = promptRef.current?.getText() ?? prompt;
      const res = await fetch("/api/v1/skills/mediafactory/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage,
          maker_mode: makerMode,
          prompt: promptValue,
          maker: { duration_sec: 8, fps: 30, with_audio: true },
        }),
      });
      const json = await res.json();
      setResult(json);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  const stageLocked = !makerMode && stage !== "Image";

  return (
    <TeleGlassPanel className="p-4 space-y-3">
      <div className="text-sm text-muted-foreground">MediaFactory</div>
      <div className="flex flex-wrap gap-2">
        {stages.map((s) => (
          <TeleChip key={s} label={s} active={stage === s} onClick={() => setStage(s)} />
        ))}
      </div>

      <div className="text-xs text-muted-foreground">Prompt</div>
      {showJump && (
        <button
          type="button"
          className="text-xs opacity-80 hover:opacity-100"
          onClick={() => jumpTopActive({ preferId: "skills-prompt", sourceId: "JumpButton:skills-prompt" })}
        >
          ↑ к началу
        </button>
      )}
      <FastTextArea
        ref={promptRef}
        defaultValue={prompt}
        onChangeDebounced={setPrompt}
        onScrollStateChange={(top) => setShowJump(top > 120)}
        surfaceId="skills-prompt"
        rememberScroll
        className="telegpt-fasttext tele-glass w-full min-h-[160px] max-h-[160px] rounded-tele-input p-3 text-foreground placeholder:text-muted-foreground"
      />

      <div className="flex items-center gap-2">
        <TelePrimaryButton onClick={run} disabled={status === "loading" || stageLocked}>
          Run
        </TelePrimaryButton>
        {stageLocked && <div className="text-xs text-muted-foreground">Maker required.</div>}
        {status === "error" && <div className="text-xs text-muted-foreground">Run failed.</div>}
      </div>

      {result && (
        <TeleGlassPanel className="p-3 space-y-2">
          <div className="text-xs text-muted-foreground">Artifacts</div>
          <div className="space-y-2">
            {(result.artifacts ?? []).map((a: any) => (
              <div key={a.path} className="text-sm">
                {a.name} • {a.bytes} bytes
              </div>
            ))}
          </div>
          {result.validators && (
            <div className="text-xs text-muted-foreground">
              mp4={String(result.validators.mp4_exists)} • duration=
              {String(result.validators.duration_ok)} • 9x16=
              {String(result.validators.aspect_9x16)} • audio=
              {String(result.validators.audio_present)}
            </div>
          )}
          {result.trace_id && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              trace: {result.trace_id}
              <button
                type="button"
                className="text-white/70 hover:text-white"
                onClick={() => setTraceOpen(true)}
              >
                Details
              </button>
            </div>
          )}
          {result.trace_id && (
            <TraceDrawer
              open={traceOpen}
              onOpenChange={setTraceOpen}
              traceId={result.trace_id}
              makerMode={makerMode}
            />
          )}
        </TeleGlassPanel>
      )}
    </TeleGlassPanel>
  );
}
