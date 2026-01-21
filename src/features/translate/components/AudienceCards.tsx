import { TeleGlassPanel } from "@/components/tele/TeleGlassPanel";

export default function AudienceCards({ strings }: { strings: any }) {
  return (
    <TeleGlassPanel>
      <div className="text-sm font-semibold mb-3">Для кого</div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {strings.audience.map((a: any, i: number) => (
          <TeleGlassPanel key={i} className="p-4">
            <div className="text-2xl">{a.icon}</div>
            <div className="mt-2 text-sm">{a.title}</div>
          </TeleGlassPanel>
        ))}
      </div>
    </TeleGlassPanel>
  );
}
