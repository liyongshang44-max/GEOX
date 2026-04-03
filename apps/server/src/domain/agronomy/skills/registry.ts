import { cornCrop } from "./crop/corn/corn.crop";
import { tomatoCrop } from "./crop/tomato/tomato.crop";

import { cornWaterRule } from "./rules/corn/corn.water_balance.rule";
import { tomatoFertilizeRule } from "./rules/tomato/tomato.fertilize.rule";

import { irrigationAcceptance } from "./acceptance/irrigation.acceptance";

export const cropSkills = [cornCrop, tomatoCrop];

export const ruleSkills = [
  cornWaterRule,
  tomatoFertilizeRule
];

export const acceptanceSkills = [
  irrigationAcceptance
];
