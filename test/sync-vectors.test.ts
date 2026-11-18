// Runs vectors/sync (merge, places, combined view, document, envelope, plan)
// and checks the two properties of the merge, symmetry and idempotence, over
// the vectors and over generated cases from a seeded generator.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import {
  buildDocument,
  buildEnvelope,
  buildUnit,
  combinePlaces,
  envelopeAad,
  instantMs,
  mergePlace,
  mergeRecords,
  parseDocument,
  parseEnvelope,
  parseUnit,
  planSync,
  planUnitSync,
  type Envelope,
  type LocalPlaceState,
  type LocalUnitState,
  type Place,
  type PlaceDocument,
  type SyncRecord,
  type UnitDocument,
} from '../src/index';
import { validate } from './helpers/json-schema';

const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const dir = fileURLToPath(new URL('../vectors/sync/', import.meta.url));
const schema = read(`${dir}sync-vector.schema.json`);
const vectors = readdirSync(dir)
  .filter((f) => f.endsWith('.json') && !f.includes('schema'))
  .map((f) => ({ file: f, v: read(`${dir}${f}`) }));

type Input = {
  local: never;
  remote: never;
  byPlace: never;
  ticked: never;
  document: never;
  envelope: never;
  text?: string;
  json?: unknown;
};
type Case = { name: string; input: Input; expected: unknown };
type Rec = SyncRecord<unknown>;
const text = (input: Input) =>
  typeof input.text === 'string' ? input.text : JSON.stringify(input.json);

describe('sync vectors', () => {
  test('they validate and carry their file name as id', () => {
    expect(vectors.length).toBeGreaterThanOrEqual(10);
    for (const { file, v } of vectors) {
      expect(validate(schema, v), file).toEqual([]);
      expect(`${v.id}.json`).toBe(file);
    }
  });
  test('there are vectors for every kind', () => {
    expect(new Set(vectors.map((x) => x.v.kind))).toEqual(
      new Set([
        'merge',
        'place',
        'combine',
        'document',
        'envelope',
        'plan',
        'unit-parse',
        'unit-build',
        'unit-plan',
      ]),
    );
  });
  for (const { file, v } of vectors) {
    describe(file, () => {
      for (const c of v.cases as Case[]) {
        const i = c.input;
        if (v.kind === 'merge') {
          test(c.name, () => expect(mergeRecords(i.local, i.remote)).toEqual(c.expected));
        } else if (v.kind === 'place') {
          test(c.name, () => expect(mergePlace(i.local, i.remote)).toEqual(c.expected));
        } else if (v.kind === 'combine') {
          test(c.name, () => expect(combinePlaces(i.byPlace, i.ticked)).toEqual(c.expected));
        } else if (v.kind === 'plan') {
          test(c.name, () => expect(planSync(i.local, i.remote)).toEqual(c.expected));
        } else if (v.kind === 'unit-plan') {
          test(c.name, () => expect(planUnitSync(i.local, i.remote)).toEqual(c.expected));
        } else if (v.kind === 'unit-parse') {
          test(c.name, () => expect(parseUnit(text(i))).toEqual(c.expected));
        } else if (v.kind === 'unit-build') {
          test(c.name, () => {
            const out = buildUnit((i as unknown as { unit: UnitDocument }).unit);
            expect({ text: out }).toEqual(c.expected);
            const back = parseUnit(out);
            expect(back.ok && buildUnit(back.unit)).toBe(out);
          });
        } else if (v.kind === 'document') {
          if (file === 'document-build.json') {
            test(c.name, () => {
              const out = buildDocument(i.document);
              expect({ text: out }).toEqual(c.expected);
              const back = parseDocument(out);
              expect(back.ok && buildDocument(back.document)).toBe(out);
            });
          } else test(c.name, () => expect(parseDocument(text(i))).toEqual(c.expected));
        } else if (file === 'envelope-build.json') {
          test(c.name, () => {
            const out = buildEnvelope(i.envelope);
            expect({ text: out, aad: envelopeAad(i.envelope) }).toEqual(c.expected);
            expect(parseEnvelope(out)).toEqual({ ok: true, envelope: JSON.parse(out) });
          });
        } else test(c.name, () => expect(parseEnvelope(text(i))).toEqual(c.expected));
      }
    });
  }
});

/** A small seeded generator (mulberry32): the tests must not use Math.random. */
function seeded(seed: number) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return (n: number) => Math.floor(next() * n);
}

const TIMES = [
  '2026-11-18T10:00:00.000Z',
  '2026-11-18T10:00:00Z',
  '2026-11-18T10:00:01.000Z',
  '2026-11-18T10:05:00.000Z',
  '2026-11-18T10:05:00.5Z',
];

function generate(pick: (n: number) => number): Rec[] {
  const out: Rec[] = [];
  for (let n = pick(7); n > 0; n--) {
    const key = ['a', 'b', 'c', 'd'][pick(4)] as string;
    const updatedAt = TIMES[pick(TIMES.length)] as string;
    const kind = pick(10);
    if (kind === 0) out.push({ key, updatedAt: 'bad', value: 1 });
    else if (kind <= 3) out.push({ key, updatedAt, deleted: true });
    else out.push({ key, updatedAt, value: { n: pick(3), m: pick(2) === 0 ? { x: 1 } : [1] } });
  }
  return out;
}

function properties(local: Rec[], remote: Rec[], label: string) {
  const ab = mergeRecords(local, remote);
  const ba = mergeRecords(remote, local);
  expect(ab.records, `${label}: symmetry`).toEqual(ba.records);
  expect(ab.changedLocal, `${label}: sides`).toEqual(ba.changedRemote);
  for (const input of [local, remote]) {
    const again = mergeRecords(ab.records, input);
    expect(again.records, `${label}: idempotence`).toEqual(ab.records);
    expect(again.changedLocal, `${label}: stable`).toEqual([]);
  }
  expect(mergeRecords(ab.records, ab.records).records).toEqual(ab.records);
  for (const r of ab.records) expect(instantMs(r.updatedAt), label).toBeDefined();
}

describe('merge properties', () => {
  test('symmetry and idempotence hold for every merge vector', () => {
    for (const { file, v } of vectors.filter((x) => x.v.kind === 'merge')) {
      for (const c of v.cases as Case[]) {
        properties(
          c.input.local as unknown as Rec[],
          c.input.remote as unknown as Rec[],
          `${file}: ${c.name}`,
        );
      }
    }
  });
  test('symmetry and idempotence hold for generated cases', () => {
    const pick = seeded(20261118);
    for (let n = 0; n < 400; n++) properties(generate(pick), generate(pick), `generated ${n}`);
  });
  test('three-way merge does not depend on the order', () => {
    const pick = seeded(7);
    for (let n = 0; n < 200; n++) {
      const [x, y, z] = [generate(pick), generate(pick), generate(pick)];
      const left = mergeRecords(mergeRecords(x, y).records, z).records;
      const right = mergeRecords(x, mergeRecords(y, z).records).records;
      expect(left, `generated ${n}`).toEqual(right);
    }
  });
});

describe('plan properties', () => {
  const place: Place = { id: 'p', name: 'Flat', updatedAt: TIMES[0] as string };
  test('after both sides apply a plan, a second cycle has nothing to do', () => {
    const pick = seeded(99);
    for (let n = 0; n < 200; n++) {
      const local: LocalPlaceState<unknown, unknown> = {
        place,
        records: generate(pick),
        entities: generate(pick),
      };
      const remote: PlaceDocument = {
        format: 'materia-place',
        version: 1,
        place,
        records: generate(pick),
        entities: generate(pick),
      };
      const first = planSync(local, remote);
      if ('error' in first) throw new Error('same place expected');
      const remoteAfter = first.write ?? remote;
      const second = planSync(first.local, remoteAfter);
      if ('error' in second) throw new Error('same place expected');
      expect(second.write, `generated ${n}`).toBeUndefined();
      expect(second.localChanged, `generated ${n}`).toBe(false);
    }
  });
});

describe('envelope type', () => {
  test('the envelope of a vector is accepted as the type', () => {
    const e = parseEnvelope(
      JSON.stringify({
        format: 'materia-sync',
        version: 1,
        kdf: { name: 'k', hash: 'h', iterations: 1, salt: 'AA==' },
        cipher: { name: 'c', nonce: 'AA==' },
        data: 'AA==',
      }),
    );
    const envelope: Envelope | undefined = e.ok ? e.envelope : undefined;
    expect(envelope?.version).toBe(1);
  });
});

describe('unit plan properties', () => {
  const unit = { id: 'u', name: 'Mine', updatedAt: TIMES[0] as string };
  const names = ['specs', 'templates', 'future-things'];
  const collections = (pick: (n: number) => number) => {
    const out: Record<string, Rec[]> = {};
    for (const name of names) if (pick(3) > 0) out[name] = generate(pick);
    return out;
  };
  test('after both sides apply a plan, a second cycle has nothing to do', () => {
    const pick = seeded(4242);
    for (let n = 0; n < 200; n++) {
      const local: LocalUnitState = {
        kind: 'library',
        unit,
        collections: collections(pick),
      };
      const remote: UnitDocument = {
        format: 'materia-unit',
        version: 1,
        kind: 'library',
        unit,
        collections: collections(pick),
      };
      const first = planUnitSync(local, remote);
      if ('error' in first) throw new Error('same unit expected');
      const second = planUnitSync(first.local, first.write ?? remote);
      if ('error' in second) throw new Error('same unit expected');
      expect(second.write, `generated ${n}`).toBeUndefined();
      expect(second.localChanged, `generated ${n}`).toBe(false);
      const swapped = planUnitSync(
        { kind: 'library', unit, collections: remote.collections },
        { ...remote, collections: local.collections },
      );
      if ('error' in swapped) throw new Error('same unit expected');
      expect(swapped.local.collections, `generated ${n}: symmetry`).toEqual(
        first.local.collections,
      );
    }
  });
});
