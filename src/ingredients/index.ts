// The general ingredient model as model.ts exports it. Generic helpers
// (`BaseIngredient`, `IngredientTreeOf`, `inheritedValue`, ...) stay
// internal; the drink shapes are in drink-ingredients/.
export type {
  Cost,
  Found,
  Id,
  Level,
  Missing,
  PreparedIngredient,
  Quantity,
  Resolved,
  Source,
  SubstitutionClass,
  TreeError,
  TreeErrorCode,
  UnitVolume,
} from './types';
export { PREPARED_FIELDS } from './types';
export { ancestors, buildTree, descendants, distance, getIngredient, isA } from './tree';
export { resolveCost } from './properties';
export type {
  PreparedError,
  PreparedErrorCode,
  PreparedLine,
  PreparedSpec,
  SpecLookup,
} from './prepared';
export * from './substitution';
export * from './swap-candidates';
