import { useForgeActionCards } from "../hooks/useForge";

const SEVERITY_STYLES = {
  info: "bg-blue-500/10 border-blue-500/30 text-blue-400",
  warning: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
  danger: "bg-red-500/10 border-red-500/30 text-red-400",
  success: "bg-green-500/10 border-green-500/30 text-green-400",
};

const SEVERITY_ICONS = {
  info: "🔵",
  warning: "🟡",
  danger: "🔴",
  success: "🟢",
};

export function ForgeActionCardsPanel() {
  const { cards, loading } = useForgeActionCards();

  if (loading && !cards.length) {
    return null;
  }

  if (cards.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {cards.map((card) => (
        <div
          key={card.card_id}
          className={`p-3 rounded-lg border ${SEVERITY_STYLES[card.severity as keyof typeof SEVERITY_STYLES]}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span>{SEVERITY_ICONS[card.severity as keyof typeof SEVERITY_ICONS]}</span>
            <span className="font-semibold">{card.title_en}</span>
          </div>
          <p className="text-sm mb-2 opacity-80">{card.description_en}</p>
          <div className="flex flex-wrap gap-1">
            {card.commands?.map((cmd: string) => (
              <span
                key={cmd}
                className="text-xs px-2 py-1 bg-white/10 rounded font-mono"
              >
                {cmd}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}