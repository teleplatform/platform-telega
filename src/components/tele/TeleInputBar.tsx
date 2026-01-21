import { cn } from "@/lib/utils";

export function TeleInputBar(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <textarea
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      className={cn(
        "w-full min-h-[120px] tele-glass rounded-[var(--radius-input)] p-4 outline-none",
        "text-[15px] leading-6 placeholder:text-white/35",
        props.className
      )}
    />
  );
}
