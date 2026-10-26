// Workers have no `process`; the two API files read their settings from `process.env`. Imported first so it exists by then.
const g = globalThis as unknown as { process?: { env: Record<string, string | undefined> } }
g.process ??= { env: {} }
export {}
