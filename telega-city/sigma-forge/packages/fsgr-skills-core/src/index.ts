import type { SkillUnit } from "../../../fsgr-contracts/src/index.js";
import { REACT_COMPONENT_BUILD } from "./frontend/reactComponentBuild.js";
import { UI_FIX } from "./frontend/uiFix.js";
import { LAYOUT_SECTION_COMPOSE } from "./frontend/layoutSectionCompose.js";
import { API_ROUTE_BUILD } from "./backend/apiRouteBuild.js";
import { AUTH_GUARD_PATCH } from "./backend/authGuardPatch.js";
import { DB_SCHEMA_PATCH } from "./backend/dbSchemaPatch.js";
import { DOC_SPEC_WRITE } from "./content/docSpecWrite.js";
import { COPY_BLOCK_GENERATE } from "./content/copyBlockGenerate.js";
import { SCAN_SUMMARIZE } from "./research/scanSummarize.js";
import { COMPARE_SYNTHESIZE } from "./research/compareSynthesize.js";
import { TEST_RUN } from "./ops/testRun.js";
import { TRACE_EXPLAIN } from "./ops/traceExplain.js";
import { PATCH_VALIDATE } from "./ops/patchValidate.js";

export const CORE_SKILLS: SkillUnit[] = [
  REACT_COMPONENT_BUILD,
  UI_FIX,
  LAYOUT_SECTION_COMPOSE,
  API_ROUTE_BUILD,
  AUTH_GUARD_PATCH,
  DB_SCHEMA_PATCH,
  DOC_SPEC_WRITE,
  COPY_BLOCK_GENERATE,
  SCAN_SUMMARIZE,
  COMPARE_SYNTHESIZE,
  TEST_RUN,
  TRACE_EXPLAIN,
  PATCH_VALIDATE,
];

export interface SkillRegistryLike {
  registerSkill(skill: SkillUnit): void;
}

export function registerCoreSkills(registry: SkillRegistryLike): void {
  for (const skill of CORE_SKILLS) {
    registry.registerSkill(skill);
  }
}
