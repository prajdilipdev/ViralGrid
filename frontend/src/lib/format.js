/**
 * Number formatting for stat tiles.
 *
 * A long figure like 12,345,678 has no break opportunity, so in a narrow grid
 * cell it cannot shrink and pushes the whole page sideways on mobile. Large
 * values are therefore shown compactly (1.2M), with the exact number kept in a
 * tooltip.
 */

const compact = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Display form: exact up to 5 digits, compact beyond that. */
export const statValue = (n) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  return Math.abs(v) >= 100000 ? compact.format(v) : v.toLocaleString();
};

/** Exact form, for the title attribute. */
export const exactValue = (n) =>
  n === null || n === undefined || Number.isNaN(Number(n)) ? "" : Number(n).toLocaleString();
