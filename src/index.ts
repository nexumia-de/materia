// The public entry and the package's contract (docs/modules.md): the general
// functions, the generic ones an app's own rules call with its lists
// (`inheritedValue`, `resolvePrepared`, `fillSlots`, `matchTemplates`,
// `findVariants`, `diffVersions`), and every type. Nothing here knows a
// domain: no units, no drink or kitchen rules.
export {
  ancestors,
  buildTree,
  descendants,
  distance,
  getIngredient,
  isA,
  PREPARED_FIELDS,
  resolveCost,
  sameClass,
  substitutesFor,
  swapCandidates,
} from './ingredients/index';
export { inheritedValue, resolveAllOf } from './ingredients/properties';
export { resolvePrepared } from './ingredients/prepared';

export { lineRole } from './templates/index';
export { fillSlots } from './templates/slots';
export { matchTemplates } from './templates/match';
export { findVariants } from './templates/variants';

export { buildFamily, findFamilyCycles, summariseRiff } from './specs/index';
export { diffVersions } from './specs/diff';

export {
  buildStockIndex,
  makeableSpecs,
  missingOne,
  pairRanking,
  unlockRanking,
} from './stock/index';

export {
  addDays,
  dayNumber,
  daysBetween,
  expiry,
  limitingShelfLife,
  USE_SOON_DAYS,
} from './shelf/index';

export type * from './ingredients/prepared';
export type * from './ingredients/properties';
export type * from './ingredients/substitution';
export type * from './ingredients/swap-candidates';
export type * from './ingredients/tree';
export type * from './ingredients/types';
export type * from './templates/match';
export type * from './templates/slots';
export type * from './templates/types';
export type * from './templates/variants';
export type * from './specs/diff';
export type * from './specs/family';
export type * from './specs/riff-change';
export type * from './specs/types';
export type * from './stock/evaluation';
export type * from './stock/fixers';
export type * from './stock/makeable';
export type * from './stock/pair-fixers';
export type * from './stock/pairs';
export type * from './stock/prepared';
export type * from './stock/satisfies';
export type * from './stock/stock-index';
export type * from './stock/types';
export type * from './stock/unlock';
export type * from './shelf/dates';
export type * from './shelf/expiry';
export type * from './shelf/limiting';
