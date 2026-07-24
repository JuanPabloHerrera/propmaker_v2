/**
 * Locale-pinned number formatting.
 *
 * A bare `toLocaleString()` resolves the locale from the runtime — en-US on the
 * Node server, the viewer's own locale in the browser — so the two disagree on
 * grouping separators ("1,300" vs "1.300") and React throws a hydration
 * mismatch (#418) for any client component that renders one.
 *
 * The UI copy is English (`<html lang="en">`), so en-US grouping is the correct
 * fixed choice. Use this everywhere a number is rendered, including in Server
 * Components, so the whole app formats identically.
 */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}
