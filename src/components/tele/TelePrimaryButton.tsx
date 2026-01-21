import { cn } from "@/lib/utils";

export function TelePrimaryButton(props: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className={cn(
        "rounded-[var(--radius-pill)] px-5 py-2.5 text-sm font-medium",
        "bg-gradient-to-r from-purple-500 to-pink-500 text-white tele-glow",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        props.className
      )}
    >
      {props.children}
    </button>
  );
}
