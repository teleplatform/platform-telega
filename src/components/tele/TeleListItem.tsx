import { cn } from "@/lib/utils";

export function TeleListItem(props: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={cn(
        "w-full text-left tele-glass rounded-xl px-4 py-3 flex items-center justify-between gap-3 hover:bg-white/10",
        props.className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
          {props.icon ?? "•"}
        </div>
        <div>
          <div className="text-sm text-foreground">{props.title}</div>
          {props.subtitle && <div className="text-xs text-muted-foreground">{props.subtitle}</div>}
        </div>
      </div>
      <div className="text-white/50">{props.right ?? ">"}</div>
    </button>
  );
}
