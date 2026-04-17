// LEGACY AGRONOMY SKILLS CATALOG (migration/bootstrap only).
// DO_NOT_USE_LEGACY_AGRONOMY_SKILLS_IN_RUNTIME
import { cornCrop } from "./crop/corn/corn.crop.js";
import { tomatoCrop } from "./crop/tomato/tomato.crop.js";

import { cornWaterRule } from "./rules/corn/corn.water_balance.rule.js";
import { cornWaterRuleV2 } from "./rules/corn/corn.water_balance.v2.rule.js";
import { tomatoFertilizeRule } from "./rules/tomato/tomato.fertilize.rule.js";

import { irrigationAcceptance } from "./acceptance/irrigation.acceptance.js";
import { fertilizeAcceptance } from "./acceptance/fertilize.acceptance.js";

export const cropSkills = [cornCrop, tomatoCrop];

export const ruleSkills = [
  cornWaterRule,
  cornWaterRuleV2,
  tomatoFertilizeRule,
];

export const acceptanceSkills = [
  irrigationAcceptance,
  fertilizeAcceptance,
];
