import { TeleGlassPanel } from "./TeleGlassPanel";

export function TeleHeaderBar(props: { title: string; right?: React.ReactNode }) {
  return (
    <TeleGlassPanel strong className="px-4 py-4 flex items-center justify-between">
      <div className="text-base font-semibold">{props.title}</div>
      <div className="flex items-center gap-2">{props.right}</div>
    </TeleGlassPanel>
  );
}
