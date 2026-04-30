
# Document Ingest Module v1

## Status
🟢 **APPROVED** — Canonical Candidate → Pilot / Integration Ready

## Position in Architecture

```
Tele•Ga Core
└─ Ingest Layer
   └─ Document / Media Ingest
      └─ PaddleOCR-VL-1.5 (Document Parsing & Layout Engine)
```

## ARCHITECTURE

### Purpose
OCR ради понимания документа, а не только текста:
- документ → структура
- текст → иерархия
- таблицы → логические блоки
- страницы → единый поток чтения

### Inputs
- **PDF documents** (multi-page, scanned, native)
- **Images** (JPG, PNG, TIFF)
- **Batch processing** (multiple documents in single request)

### Processing Modes
1. **Sync mode** — для интерактивных сценариев (single document, < 10 pages)
2. **Async mode** — для batch processing и больших документов (10+ pages)

### PaddleOCR Pipeline
```
Input → Preprocessing → Layout Detection → Text Recognition → 
Table Analysis → Structure Reconstruction → Output
```

### Core Responsibilities
- **Layout blocks detection** (headers, paragraphs, lists, tables, figures)
- **Table structure analysis** (including cross-page merge)
- **Reading order determination** (natural document flow)
- **Seal/stamp recognition** (official documents)
- **Document hierarchy extraction** (headers, subheaders, sections)

### Constraints
✅ **Full layout parsing** — только официальный Paddle pipeline (Docker / native)
⚠️ **Transformers** — строго element-level recognition
❌ **Russian handwriting** — вне scope на данном этапе

---

## API CONTRACT

### Endpoints

#### 1. Ingest Document
```typescript
POST /api/v1/document/ingest
Content-Type: multipart/form-data

Request:
{
  file: File,              // PDF or image
  mode: "sync" | "async",  // Processing mode
  options?: {
    extractTables: boolean,      // Default: true
    mergeCrossPageTables: boolean, // Default: true
    detectSeals: boolean,        // Default: true
    preserveOriginalOrder: boolean // Default: true
  }
}

Response (sync):
{
  jobId: string,
  status: "completed",
  result: DocumentStructure
}

Response (async):
{
  jobId: string,
  status: "processing",
  estimatedCompletionTime: number // seconds
}
```

#### 2. Get Document Parse Result
```typescript
GET /api/v1/document/parse/:jobId

Response:
{
  jobId: string,
  status: "completed" | "processing" | "failed",
  result?: DocumentStructure,
  error?: string,
  progress?: {
    totalPages: number,
    processedPages: number,
    currentStage: string
  }
}
```

#### 3. Batch Ingest
```typescript
POST /api/v1/document/batch-ingest
Content-Type: multipart/form-data

Request:
{
  files: File[],             // Multiple documents
  mode: "async",             // Only async for batch
  options?: IngestOptions
}

Response:
{
  batchId: string,
  jobIds: string[],
  status: "processing"
}
```

### Result Schema

```typescript
interface DocumentStructure {
  documentId: string;
  metadata: {
    filename: string;
    totalPages: number;
    processingTime: number;
    createdAt: string;
    confidence: number; // Overall confidence score
  };

  pages: Page[];

  // Unified reading order across pages
  readingOrder: ReadingBlock[];

  // Cross-page merged tables
  tables: Table[];

  // Document hierarchy
  hierarchy: HierarchyNode[];
}

interface Page {
  pageNumber: number;
  size: { width: number; height: number };
  rotation: number; // Degrees (0, 90, 180, 270)

  blocks: Block[];
  confidence: number;
}

interface Block {
  blockId: string;
  type: "text" | "header" | "table" | "figure" | "seal" | "list";
  bbox: BoundingBox; // [x1, y1, x2, y2]
  content: string;
  confidence: number;

  // For tables
  tableStructure?: TableStructure;

  // For headers
  level?: number; // H1, H2, H3, etc.
}

interface Table {
  tableId: string;
  pages: number[]; // Pages this table spans
  rows: TableRow[];
  headers: string[];
  bbox: BoundingBox;
  confidence: number;
}

interface TableRow {
  rowId: string;
  cells: TableCell[];
}

interface TableCell {
  cellId: string;
  content: string;
  bbox: BoundingBox;
  rowSpan: number;
  colSpan: number;
  confidence: number;
}

interface HierarchyNode {
  nodeId: string;
  type: "section" | "subsection" | "paragraph";
  level: number;
  title?: string;
  content?: string;
  children: HierarchyNode[];
  pageRanges: [number, number][];
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

---

## TRACE HOOKS

### Page-level Hooks
```typescript
interface PageTraceEvent {
  eventType: "page_start" | "page_complete" | "page_failed";
  pageNumber: number;
  timestamp: string;
  duration: number;
  confidence: number;
  blocksDetected: number;
  error?: string;
}
```

### Block-level Hooks
```typescript
interface BlockTraceEvent {
  eventType: "block_detected" | "block_recognized" | "block_failed";
  blockId: string;
  blockType: string;
  pageNumber: number;
  timestamp: string;
  confidence: number;
  bbox: BoundingBox;
  content?: string;
  error?: string;
}
```

### Confidence / Fallback Hooks
```typescript
interface ConfidenceEvent {
  eventType: "low_confidence" | "fallback_triggered" | "recovery_attempt";
  level: "page" | "block" | "cell";
  itemId: string;
  confidence: number;
  threshold: number;
  fallbackAction: string;
  timestamp: string;
  recoveryAttempted: boolean;
  recoverySuccess?: boolean;
}
```

### Trace Hook Integration
```typescript
// Trace events are sent to:
// 1. Forge Explain (for debugging and analysis)
// 2. Mission Control (for monitoring and alerts)
// 3. Knowledge Packs (for learning and improvement)

interface TraceConfig {
  enabled: boolean;
  endpoints: {
    explain: string;
    missionControl: string;
    knowledgePacks: string;
  };
  filters: {
    minConfidence: number;
    eventTypes: string[];
  };
}
```

---

## PILOT SCENARIO

### Objective
Validate Document Ingest Module v1 with real-world documents and establish boundaries of applicability.

### Test Documents (1-2 documents)
1. **Invoice** — structured document with tables, line items, totals
2. **Technical Specification** — multi-page document with headers, sections, cross-page tables

### Quality Metrics
- **Layout detection accuracy** — % of correctly identified blocks
- **Table structure accuracy** — % of correctly parsed tables
- **Reading order accuracy** — % of correct reading sequence
- **Overall confidence score** — average across all blocks
- **Processing time** — per page and total

### Success Criteria
- Layout detection accuracy ≥ 85%
- Table structure accuracy ≥ 80%
- Reading order accuracy ≥ 85%
- Overall confidence score ≥ 0.75
- Processing time ≤ 5 seconds per page (sync mode)

### Boundaries of Applicability
After pilot, document:
1. **Supported scenarios** — what works well
2. **Degraded scenarios** — what works with limitations
3. **Unsupported scenarios** — what should be rejected or handled differently

### Pilot Deliverables
- Test results report
- Quality metrics analysis
- Boundaries of applicability document
- Recommendations for v2 improvements

---

## Integration Points

### Consumers
1. **MarketBase** — invoices, price lists, catalogs
2. **B2B Market Link** — KP → Quote → Invoice processing
3. **Mission Control / Intel** — document parsing for Knowledge Packs
4. **Forge ART•Core** — document as artifact for Explain / Trace

### Dependencies
- PaddleOCR-VL-1.5 (Docker / native)
- Forge Explain (trace hooks)
- Mission Control (monitoring)
- Knowledge Packs (learning)

---

## License
Apache 2.0 — compatible with Tele•Ga commercial core

## Version History
- v1.0 — Initial canonical specification (2026-02-03)
