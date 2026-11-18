// What the built package must not contain: imports, DOM, host and Node-only
// names (docs/development.md). Strings and comments are not stripped, so a false
// positive means rewording the source.
const FORBIDDEN = [
  [/^\s*import\s|\bimport\s*\(/m, 'an import'],
  [/\brequire\s*\(/, 'require'],
  // Use of a host global: the name at the start of an expression, followed
  // by a member access or a call. A property or a string with the same word
  // (`result.document`, 'not-a-document') is not one.
  [
    /(?<![./\w$'"`-])(?:window|document|navigator|localStorage|sessionStorage|indexedDB)\s*(?:\.|\[|\?\.)/,
    'a DOM or browser name',
  ],
  [/(?<![.\w$])(?:fetch|XMLHttpRequest)\s*\(/, 'a network call'],
  [/\b(?:process|Buffer|__dirname|__filename)\b/, 'a Node-only name'],
  [/\bnode:/, 'a node: specifier'],
  [/\b(?:Date|performance|crypto)\b|\bMath\.random\b/, 'a clock or randomness'],
];

/** @param {string} text The bundle. @returns {string[]} One line per problem. */
export function checkDist(text) {
  return FORBIDDEN.flatMap(([pattern, what]) => (pattern.test(text) ? [`contains ${what}`] : []));
}
