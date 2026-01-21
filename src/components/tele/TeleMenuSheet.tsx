import { cn } from "@/lib/utils";
import { TeleGlassPanel } from "./TeleGlassPanel";

export function TeleMenuSheet(props: {
  title?: string;
  items: Array<{ label: string; left?: React.ReactNode; right?: React.ReactNode; onClick?: () => void }>;
  className?: string;
}) {
  return (
    <TeleGlassPanel strong className={cn("w-[320px] p-3", props.className)}>
      {props.title && <div className="px-2 pb-2 text-sm font-semibold text-foreground">{props.title}</div>}
      <div className="space-y-2">
        {props.items.map((it, i) => (
          <button
            key={i}
            type="button"
            onClick={it.onClick}
            className="w-full tele-glass rounded-xl px-3 py-3 flex items-center justify-between gap-3 hover:bg-white/10"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                {it.left ?? "•"}
              </div>
              <div className="text-sm text-foreground">{it.label}</div>
            </div>
            <div className="text-white/50">{it.right ?? ">"}</div>
          </button>
        ))}
      </div>
    </TeleGlassPanel>
  );
}
