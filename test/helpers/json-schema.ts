// A small validator for the JSON Schema subset the engine's data and
// vector schemas use (type, enum, const, required, properties,
// additionalProperties, items, minItems, minimum, exclusiveMinimum,
// pattern, oneOf). It exists so no validation library is needed; a
// keyword outside this subset throws instead of being ignored silently.
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Schema = { [key: string]: Json };

const known = new Set([
  '$schema',
  '$id',
  'title',
  'description',
  'type',
  'enum',
  'const',
  'required',
  'properties',
  'additionalProperties',
  'items',
  'minItems',
  'minimum',
  'exclusiveMinimum',
  'pattern',
  'oneOf',
]);

function typeOf(value: Json): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function matches(type: string, value: Json): boolean {
  if (type === 'integer') return typeof value === 'number' && Number.isInteger(value);
  return typeOf(value) === type;
}

export function validate(schema: Schema, value: Json, path = '$'): string[] {
  const errors: string[] = [];
  for (const key of Object.keys(schema)) {
    if (!known.has(key)) throw new Error(`unsupported schema keyword: ${key}`);
  }
  const type = schema.type;
  if (type !== undefined) {
    const types = Array.isArray(type) ? type : [type];
    if (!types.some((t) => matches(String(t), value))) {
      return [`${path}: expected ${types.join(' or ')}, got ${typeOf(value)}`];
    }
  }
  if (schema.const !== undefined && JSON.stringify(schema.const) !== JSON.stringify(value)) {
    errors.push(`${path}: expected ${JSON.stringify(schema.const)}`);
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((e) => e === value)) {
    errors.push(`${path}: not one of ${JSON.stringify(schema.enum)}`);
  }
  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) {
      errors.push(`${path}: below ${schema.minimum}`);
    }
    if (typeof schema.exclusiveMinimum === 'number' && value <= schema.exclusiveMinimum) {
      errors.push(`${path}: not above ${schema.exclusiveMinimum}`);
    }
  }
  if (typeof value === 'string' && typeof schema.pattern === 'string') {
    if (!new RegExp(schema.pattern).test(value)) errors.push(`${path}: does not match pattern`);
  }
  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
      errors.push(`${path}: fewer than ${schema.minItems} items`);
    }
    const items = schema.items;
    if (items && typeof items === 'object' && !Array.isArray(items)) {
      value.forEach((v, i) => errors.push(...validate(items, v, `${path}[${i}]`)));
    }
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const props = (schema.properties ?? {}) as { [key: string]: Schema };
    for (const name of (schema.required ?? []) as string[]) {
      if (!(name in value)) errors.push(`${path}: missing ${name}`);
    }
    for (const [name, v] of Object.entries(value)) {
      const sub = props[name];
      if (sub) errors.push(...validate(sub, v, `${path}.${name}`));
      else if (schema.additionalProperties === false) errors.push(`${path}: unexpected ${name}`);
      else if (
        schema.additionalProperties &&
        typeof schema.additionalProperties === 'object' &&
        !Array.isArray(schema.additionalProperties)
      ) {
        errors.push(...validate(schema.additionalProperties, v, `${path}.${name}`));
      }
    }
  }
  if (Array.isArray(schema.oneOf)) {
    const ok = schema.oneOf.filter((s) => validate(s as Schema, value, path).length === 0);
    if (ok.length !== 1) errors.push(`${path}: matches ${ok.length} of oneOf, expected 1`);
  }
  return errors;
}
