// A seeded random world for the stock tests: a tree with classes and roles,
// prepared ingredients (cycles possible), specs with optional lines, listed
// substitutes and unknown ingredients. The generator lives in the tests
// only; the engine has no randomness.
import type { Id, Ingredient, StockEntry, StockSpec } from '../../src/index';

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface World {
  ingredients: Ingredient[];
  specs: StockSpec[];
  stocks: StockEntry[][];
}

export function world(seed: number, size = { categories: 4, specs: 40, stocks: 4 }): World {
  const r = rng(seed);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(r() * list.length)] as T;
  const roles = ['base', 'modifier', 'sweet', 'sour'] as const;
  const ingredients: Ingredient[] = [];
  for (let c = 0; c < size.categories; c++) {
    const cat = `c${c}`;
    ingredients.push({
      id: cat,
      name: cat,
      level: 'category',
      role: pick(roles),
      ...(r() < 0.5 ? { substitutionClass: `k${c % 2}` } : {}),
    });
    const types = 2 + Math.floor(r() * 2);
    for (let t = 0; t < types; t++) {
      const type = `${cat}t${t}`;
      ingredients.push({
        id: type,
        name: type,
        level: 'type',
        parentId: cat,
        ...(r() < 0.3 ? { substitutionClass: `k${Math.floor(r() * 2)}` } : {}),
      });
      const products = 1 + Math.floor(r() * 3);
      for (let p = 0; p < products; p++) {
        ingredients.push({ id: `${type}p${p}`, name: 'p', level: 'product', parentId: type });
      }
    }
  }
  const ids = ingredients.map((i) => i.id);
  const lines = (n: number): StockSpec['lines'] =>
    Array.from({ length: n }, () => {
      const ingredientId = r() < 0.03 ? 'ghost' : pick(ids);
      return {
        ingredientId,
        ...(r() < 0.2 ? { optional: true } : {}),
        ...(r() < 0.15 ? { substitutes: [{ ingredientId: pick(ids) }] } : {}),
      };
    });
  const specs: StockSpec[] = [];
  // About one in eight types becomes a prepared ingredient; its recipe is a spec.
  for (const i of ingredients) {
    if (i.level === 'type' && r() < 0.125) {
      i.prepared = { specId: `prep-${i.id}`, yield: { amount: 100, unit: 'ml' } };
      specs.push({ id: `prep-${i.id}`, lines: lines(1 + Math.floor(r() * 3)) });
    }
  }
  for (let s = 0; s < size.specs; s++) {
    specs.push({
      id: `s${String(s).padStart(4, '0')}`,
      status: pick(['draft', 'on-menu', 'on-menu', 'retired'] as const),
      templateId: pick(['t1', 't2', 't3', undefined]),
      lines: lines(1 + Math.floor(r() * 4)),
    });
  }
  const stocks = Array.from({ length: size.stocks }, () => {
    const density = 0.15 + r() * 0.5;
    return ids
      .filter(() => r() < density)
      .map((ingredientId): StockEntry => ({ ingredientId, present: r() < 0.9 }));
  });
  return { ingredients, specs, stocks };
}

export const idsOf = (list: readonly { id: Id }[]) => list.map((x) => x.id);
