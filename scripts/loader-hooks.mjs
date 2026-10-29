// Node loader hooks for scripts/acceptance-demo.mjs only (never used by the app).
// - 'server-only' is a Next.js build-time marker, not a runtime package here,
//   so it resolves to an empty module in the acceptance process.
// - Extensionless relative imports in the project's .ts sources (e.g. './seed')
//   resolve to their .ts files, which Node's type stripping can then load.
export async function resolve(specifier, context, next) {
  if (specifier === 'server-only') {
    return { url: 'data:text/javascript,export default {}', shortCircuit: true };
  }
  if (
    (specifier.startsWith('./') || specifier.startsWith('../')) &&
    !/\.[a-zA-Z0-9]+$/.test(specifier)
  ) {
    return { url: new URL(`${specifier}.ts`, context.parentURL).href, shortCircuit: true };
  }
  return next(specifier, context);
}
