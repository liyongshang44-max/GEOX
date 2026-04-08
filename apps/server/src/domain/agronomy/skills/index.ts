// LEGACY AGRONOMY SKILLS CATALOG (migration/bootstrap only).
// DO_NOT_USE_LEGACY_AGRONOMY_SKILLS_IN_RUNTIME
import { cornCrop } from "./crop/corn/corn.crop";
import { tomatoCrop } from "./crop/tomato/tomato.crop";

import { cornWaterRule } from "./rules/corn/corn.water_balance.rule";
import { cornWaterRuleV2 } from "./rules/corn/corn.water_balance.v2.rule";
import { tomatoFertilizeRule } from "./rules/tomato/tomato.fertilize.rule";

import { irrigationAcceptance } from "./acceptance/irrigation.acceptance";
import { fertilizeAcceptance } from "./acceptance/fertilize.acceptance";

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
