import { TeleGlassPanel } from "@/components/tele/TeleGlassPanel";

export default function HowItWorks({ strings }: { strings: any }) {
  return (
    <TeleGlassPanel>
      <div className="text-sm font-semibold mb-3">How it works</div>
      <div className="grid md:grid-cols-3 gap-3">
        {strings.how.map((x: string, i: number) => (
          <TeleGlassPanel key={i} className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Step {i + 1}</div>
            <div className="text-sm">{x}</div>
          </TeleGlassPanel>
        ))}
      </div>
    </TeleGlassPanel>
  );
}
