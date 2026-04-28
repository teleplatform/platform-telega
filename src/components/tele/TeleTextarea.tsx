import { cn } from "@/lib/utils";

export function TeleTextarea(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  disabled?: boolean;
}) {
  return (
    <textarea
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      rows={props.rows ?? 6}
      disabled={props.disabled}
      className={cn(
        "tele-glass rounded-tele-input p-3 w-full outline-none text-foreground placeholder:text-muted-foreground",
        props.className
      )}
    />
  );
}
