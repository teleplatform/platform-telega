import { adaptForWeb } from "./webAdapter.js";
import { adaptForTelegram } from "./telegramAdapter.js";
import { adaptForVoice } from "./voiceAdapter.js";
import { adaptForAlice } from "./aliceAdapter.js";
const ADAPTER_MAP = {
    web: adaptForWeb,
    telegram: adaptForTelegram,
    voice: adaptForVoice,
    alice: adaptForAlice,
};
const RATIONALE_MAP = {
    web: "preserved original text with clean whitespace for web readability",
    telegram: "shortened to compact form for telegram delivery",
    voice: "reduced clause weight for easier spoken delivery",
    alice: "smoothed phrasing for assistant-style spoken delivery",
};
export function runSurfaceAdaptation(input) {
    const adapter = ADAPTER_MAP[input.surface] ?? adaptForVoice;
    const adapted_text = adapter(input.final_text);
    const rationale = RATIONALE_MAP[input.surface] ?? RATIONALE_MAP.voice;
    return {
        surface: input.surface,
        original_text: input.final_text,
        adapted_text,
        rationale,
    };
}
//# sourceMappingURL=runSurfaceAdaptation.js.map