import { Switch } from "@/components/ui/switch";

export function TeleToggle(props: {
  leftLabel: string;
  rightLabel: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="tele-glass rounded-tele-pill px-3 h-10 flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{props.leftLabel}</span>
      <Switch checked={props.checked} onCheckedChange={props.onCheckedChange} />
      <span className="text-xs text-muted-foreground">{props.rightLabel}</span>
    </div>
  );
}
