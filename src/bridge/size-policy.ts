export const SIZE_POLICY = {
  directTextCharsMax: 8000,
  chunkTargetChars: 4000,
  chunkHardMaxChars: 6000,
  responseDirectCharsMax: 6000,
  responseChunkedCharsMax: 12000,
  responseFileFallbackChars: 15000,
};

export type SizeCategory = "short" | "medium" | "long" | "very-long";

export interface SizeCheck {
  category: SizeCategory;
  chars: number;
  willChunk: boolean;
  willFileFallback: boolean;
}

export function categorizeSize(chars: number): SizeCheck {
  const { directTextCharsMax, responseChunkedCharsMax, responseFileFallbackChars } = SIZE_POLICY;

  if (chars <= directTextCharsMax) {
    return {
      category: "short",
      chars,
      willChunk: false,
      willFileFallback: false,
    };
  }

  if (chars <= responseChunkedCharsMax) {
    return {
      category: "medium",
      chars,
      willChunk: true,
      willFileFallback: false,
    };
  }

  if (chars <= responseFileFallbackChars) {
    return {
      category: "long",
      chars,
      willChunk: true,
      willFileFallback: false,
    };
  }

  return {
    category: "very-long",
    chars,
    willChunk: true,
    willFileFallback: true,
  };
}

export function isDirectSafe(chars: number): boolean {
  return chars <= SIZE_POLICY.directTextCharsMax;
}

export function willChunk(chars: number): boolean {
  return chars > SIZE_POLICY.directTextCharsMax;
}

export function shouldFallbackToFile(chars: number): boolean {
  return chars > SIZE_POLICY.responseFileFallbackChars;
}