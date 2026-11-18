// General types of the ingredient model: the fields every domain has. The
// drink fields (ABV, sugar, acid) and the drink roles are in
// drink-ingredients/types.ts. They mirror schemas/ingredient.schema.json,
// schemas/prepared-ingredient.schema.json and schemas/common.schema.json;
// test/ingredients-types.test.ts compares the field lists with the schemas.

export type Id = string;
export type Level = 'category' | 'type' | 'product';

export interface Quantity {
  amount: number;
  unit: Id;
}

export interface Source {
  name: string;
  licence: string;
  url?: string;
  note?: string;
}

export interface Cost {
  price: number;
  currency: string;
  quantity: Quantity;
}

/** A substitution class is an id; ingredients with the same resolved id can stand in for each other. */
export type SubstitutionClass = Id;

export interface PreparedIngredient {
  specId: Id;
  yield: Quantity;
}

/** The inherited properties every domain has; a domain adds its own (drinks: ABV, sugar, acid). */
export type BaseInheritedProperty = 'role' | 'shelfLifeDays' | 'substitutionClass';

/** What one counted unit of an ingredient holds, as data with its evidence (docs/units.md#counted-units). */
export interface UnitVolume {
  /** Volume in ml of one unit (one whole egg, one slice). */
  ml: number;
  /** `assumption` means no source was read. */
  evidence: 'derived' | 'secondary' | 'assumption';
  /** Where the number comes from; free text. */
  source?: string;
}

/** An ingredient with the general fields; a domain extends it with its own properties and role values. */
export interface BaseIngredient {
  id: Id;
  name: string;
  level: Level;
  parentId?: Id;
  /** A role id of the domain (drinks: `base`, `sour`, ...). */
  role?: string;
  shelfLifeDays?: number;
  /** How to keep it, in the user's words (a prepared ingredient: "in the fridge, closed"); free text, never read by the engine. */
  storage?: string;
  substitutionClass?: SubstitutionClass;
  cost?: Cost;
  /** Volume of one counted unit by unit id (`whole`, `slice`, ...); never inherited. */
  unitVolumes?: Record<string, UnitVolume>;
  prepared?: PreparedIngredient;
  /** Inherited properties whose value is an assumption. */
  assumed?: string[];
  source?: Source;
  notes?: string;
}

export const PREPARED_FIELDS = [
  'specId',
  'yield',
] as const satisfies readonly (keyof PreparedIngredient)[];

/** A value with the ingredient that supplied it, or no value and the reason. Never a guess. */
export type Found<T> = { value: T; from: Id };
export type Missing = { value: undefined; reason: string };
export type Resolved<T> = Found<T> | Missing;

export type TreeErrorCode = 'duplicate-id' | 'missing-parent' | 'cycle' | 'level-order';

/** An error that names the ids involved; for a cycle the ids run around it and end with the first. */
export interface TreeError {
  code: TreeErrorCode;
  ids: Id[];
  message: string;
}
