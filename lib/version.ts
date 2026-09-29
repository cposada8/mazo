/**
 * Which production release this is.
 *
 * The number lives in `package.json` and moves **only when something goes to
 * production** — never on dev — so it counts releases, not commits. A build
 * anywhere else still carries the number of the last release, marked as
 * not being it: `v1.2.0` is exactly what production is running, and
 * `v1.2.0 · dev` is that release plus whatever is being tried on top of it.
 */
export const VERSION = process.env.MAZO_VERSION ?? '0.0.0'

export const EN_PRODUCCION = process.env.MAZO_ENTORNO === 'production'

/** How the version is shown: `v1.2.0`, or `v1.2.0 · dev` off production. */
export const ETIQUETA_DE_VERSION = `v${VERSION}${EN_PRODUCCION ? '' : ' · dev'}`
