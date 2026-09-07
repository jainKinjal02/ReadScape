/**
 * Development-only logging.
 *
 * Metro does not strip console calls from release bundles, so a bare
 * console.log ships to production and lands in device logs — including things
 * we should not be writing down, such as user ids and local file paths.
 * `__DEV__` is false in release builds, so these become no-ops there.
 *
 * console.error / console.warn are deliberately NOT wrapped: genuine failures
 * are worth surfacing in production too (and are where crash reporting will
 * hook in later). Just keep user data out of them.
 */
export function devLog(...args: unknown[]): void {
  if (__DEV__) console.log(...args);
}

export function devWarn(...args: unknown[]): void {
  if (__DEV__) console.warn(...args);
}
