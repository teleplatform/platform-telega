import { cn } from "@/lib/utils";

export function TeleSecondaryButton(props: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={cn(
        "rounded-[var(--radius-pill)] px-5 py-2.5 text-sm",
        "tele-glass border border-white/10 text-white/85 hover:bg-white/10",
        props.className
      )}
    >
      {props.children}
    </button>
  );
}
