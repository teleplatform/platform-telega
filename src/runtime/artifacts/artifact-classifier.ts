import type { ArtifactClassification, ArtifactType, DeliveryIntent } from "./artifact-types.js";

export interface CodeBlockInfo {
  language: string;
  content: string;
  startLine: number;
  filename?: string;
}

export function extractCodeBlocks(text: string): CodeBlockInfo[] {
  const blocks: CodeBlockInfo[] = [];
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const fenceMatch = line.match(/^`{3,}(\w*)/);

    if (fenceMatch) {
      const language = fenceMatch[1] || "";
      const fenceChar = line.match(/^(`{3,})/)?.[1] || "```";
      const contentLines: string[] = [];

      // TGR-6.49: Try to find filename in the line before the block
      let blockFilename: string | undefined;
      const prevLine = i > 0 ? lines[i - 1].trim() : "";
      const filenameMatch = prevLine.match(/(?:file|filename|path|src|📄)\s*[:\-]?\s*([a-zA-Z0-9._\-\/]+)/i);
      if (filenameMatch) {
        blockFilename = filenameMatch[1];
      }

      i++;

      while (i < lines.length) {
        if (lines[i].trimStart().startsWith(fenceChar)) {
          break;
        }
        contentLines.push(lines[i]);
        i++;
      }

      const content = contentLines.join("\n");

      // Alternative: search filename inside the block (first 2 lines)
      if (!blockFilename) {
        for (const pattern of FILE_MARKER_PATTERNS) {
          const firstTwoLines = contentLines.slice(0, 2).join("\n");
          const innerMatch = firstTwoLines.match(pattern);
          if (innerMatch) {
            blockFilename = innerMatch[0].split(":").pop()?.trim();
            break;
          }
        }
      }

      blocks.push({
        language,
        content,
        startLine: i - contentLines.length,
        filename: blockFilename,
      });
    }

    i++;
  }

  return blocks;
}

function detectCapsuleManifest(text: string): boolean {
  return /\bcapsule_version\b/.test(text)
    || /\bforge_capsule\b/i.test(text)
    || /\bartifact_type\s*:\s*capsule\b/.test(text);
}

function detectZipProject(text: string): boolean {
  const hasPackageJson = /\bpackage\.json\b/.test(text);
  const hasSrcDir = /\bsrc\/\b/.test(text) || /\bsrc[\\/]/i.test(text);
  return hasPackageJson && hasSrcDir;
}

const FILE_MARKER_PATTERNS = [
  /\/\/\s*file:\s*\S+/gi,
  /#\s*file:\s*\S+/gi,
  /\/\/\s*filename:\s*\S+/gi,
  /#\s*filename:\s*\S+/gi,
  /\/\/\s*path:\s*\S+/gi,
  /#\s*path:\s*\S+/gi,
];

function detectMultiFileMarkers(text: string): boolean {
  const markers = new Set<string>();
  for (const pattern of FILE_MARKER_PATTERNS) {
    let match: RegExpExecArray | null;
    const re = new RegExp(pattern.source, "gi");
    while ((match = re.exec(text)) !== null) {
      const marker = match[0].trim();
      markers.add(marker);
    }
  }
  return markers.size >= 2;
}

function suggestFilename(type: ArtifactType, language?: string, blocks?: CodeBlockInfo[]): string | undefined {
  switch (type) {
    case "code_file": {
      if (language) {
        const lang = language.toLowerCase();
        const extMap: Record<string, string> = {
          typescript: "ts", javascript: "js", ts: "ts", js: "js",
          python: "py", py: "py",
          rust: "rs", go: "go", java: "java", cpp: "cpp", c: "c",
          bash: "sh", sh: "sh", shell: "sh",
          json: "json", yaml: "yaml", yml: "yaml", toml: "toml",
          sql: "sql", html: "html", css: "css", markdown: "md", md: "md",
        };
        const ext = extMap[lang] ?? lang;
        return `code.${ext}`;
      }
      if (blocks && blocks.length > 0 && blocks[0].language) {
        return suggestFilename("code_file", blocks[0].language);
      }
      return "code.txt";
    }
    case "markdown":
    case "report":
      return "output.md";
    case "plain_text":
      return "output.txt";
    case "capsule":
      return "capsule.json";
    case "zip_project":
    case "multi_file":
      return "sources.zip";
    case "dataset":
      return "dataset.csv";
    default:
      return undefined;
  }
}

function classifyBySize(chars: number, lines: number, stats: ArtifactClassification["stats"]): { type: ArtifactType; delivery: DeliveryIntent; reason: string; stats: ArtifactClassification["stats"] } {
  if (chars <= 3500) {
    return {
      type: "plain_text",
      delivery: "message",
      reason: `Short text (${chars} chars), deliver as single message`,
      stats,
    };
  }

  if (chars <= 12000) {
    return {
      type: "markdown",
      delivery: "chunks",
      reason: `Medium text (${chars} chars), deliver as chunked messages`,
      stats,
    };
  }

  return {
    type: "markdown",
    delivery: "file_with_preview",
    reason: `Large text (${chars} chars), deliver as file with summary preview`,
    stats,
  };
}

function detectExplicitFileRequest(text: string): boolean {
  const patterns = [
    /\bпришли\s+файлом\b/i,
    /\bскинь\s+файлом\b/i,
    /\bотправь\s+файлом\b/i,
    /\bсделай\s+markdown\s+файл\b/i,
    /\bскинь\s+\.(ts|js|py|json|md|txt)\b/i,
    /\bдай\s+архив\b/i,
    /\bотправь\s+пример\s+файла\b/i,
    /\bas\s+a\s+file\b/i,
    /\bsend\s+file\b/i,
    /\bпришли\s+результат\s+файлом\b/i,
    /\bсоздай\s+файл\b/i,
    /\bотправь\s+как\s+файл\b/i,
    /\bв\s+виде\s+файла\b/i,
  ];
  return patterns.some(p => p.test(text));
}

export function classifyArtifact(text: string, contextText?: string): ArtifactClassification {
  const chars = text.length;
  const lines = text === "" ? 0 : text.split("\n").length;
  const blocks = extractCodeBlocks(text);

  const isExplicitFile = (contextText ? detectExplicitFileRequest(contextText) : false) || detectExplicitFileRequest(text);

  let largestCodeBlockChars = 0;
  for (const block of blocks) {
    if (block.content.length > largestCodeBlockChars) {
      largestCodeBlockChars = block.content.length;
    }
  }

  const stats = {
    chars,
    lines,
    codeBlocks: blocks.length,
    largestCodeBlockChars,
  };

  // Priority 0: Explicit file request
  if (isExplicitFile) {
    const language = blocks.find(b => b.language)?.language;
    return {
      type: blocks.length > 2 ? "multi_file" : "code_file",
      delivery: "file",
      isExplicitFileRequest: true,
      language,
      filename: suggestFilename(blocks.length > 2 ? "multi_file" : "code_file", language, blocks),
      reason: "Explicit file delivery requested by user",
      stats,
    };
  }

  // Priority 1: Forge Capsule manifest
  if (detectCapsuleManifest(text)) {
    return {
      type: "capsule",
      delivery: "file",
      language: "json",
      filename: suggestFilename("capsule"),
      reason: "Forge Capsule manifest detected, deliver as capsule file",
      stats,
    };
  }

  // Priority 2: Zip project (package.json + src/)
  if (detectZipProject(text)) {
    return {
      type: "zip_project",
      delivery: "zip",
      filename: suggestFilename("zip_project"),
      reason: "Project structure detected (package.json + src/), deliver as zip archive",
      stats,
    };
  }

  // Priority 3: Multi-file markers
  if (blocks.length >= 2 && detectMultiFileMarkers(text)) {
    return {
      type: "multi_file",
      delivery: "zip",
      filename: suggestFilename("multi_file"),
      reason: `Multiple file markers found across ${blocks.length} code blocks, deliver as zip`,
      stats,
    };
  }

  // Priority 4: Large code block
  if (largestCodeBlockChars > 2500) {
    const language = blocks.find(b => b.language)?.language;
    return {
      type: "code_file",
      delivery: "file_with_preview",
      language,
      filename: suggestFilename("code_file", language, blocks),
      reason: `Large code block (${largestCodeBlockChars} chars), deliver as file with preview`,
      stats,
    };
  }

  // Priority 5: Size-based classification
  const sizeResult = classifyBySize(chars, lines, stats);
  const hasMarkdownSyntax = /\n#{1,6}\s|[*_]{2}|`{3}|\[.+\]\(.+\)/.test(text);

  // TGR-6.46: Detect explicit "message" delivery request
  const isExplicitMessage = contextText ? /\bдай\s+код\s+тут\b|\bчтобы\s+скопировать\b|\bпокажи\s+в\s+чате\b/i.test(contextText) : false;

  if (isExplicitMessage) {
    return {
      ...sizeResult,
      delivery: "chunks", // Always as text if explicitly asked
      reason: "Explicit message delivery requested by user",
    };
  }

  // Priority 6: Detect explicit "both" delivery request
  const isExplicitBoth = contextText ? /\b(пришли|скинь|отправь)\s+(и\s+)?файлом,\s+и\s+(чтобы\s+можно\s+было\s+скопировать|в\s+чате)\b/i.test(contextText) : false;

  if (isExplicitBoth) {
    const language = blocks.find(b => b.language)?.language;
    return {
      type: blocks.length > 2 ? "multi_file" : "code_file",
      delivery: "file_with_preview", // preview + file = "both"
      isExplicitFileRequest: true,
      language,
      filename: suggestFilename(blocks.length > 2 ? "multi_file" : "code_file", language, blocks),
      reason: "Explicit both (file + message) delivery requested by user",
      stats,
    };
  }

  if (hasMarkdownSyntax && sizeResult.type === "plain_text") {
    return {
      ...sizeResult,
      type: "markdown",
      reason: text.includes("KiloCode Bridge") ? "KiloCode Bridge Report" : `Short text (${chars} chars) with markdown syntax, deliver as single message`,
      filename: suggestFilename("markdown"),
    };
  }

  return {
    ...sizeResult,
    filename: suggestFilename(sizeResult.type),
  };
}
