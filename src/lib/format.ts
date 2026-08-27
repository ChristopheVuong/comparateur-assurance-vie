/**
 * How numbers are written on the page.
 *
 * All at one address, for two reasons. The engine rounds nothing — a
 * projection that rounded as it went would drift, and the accounting identity
 * the tests rest on would stop closing — so every figure has to be shaped
 * somewhere, and doing it at the edge keeps `lib/` arithmetic. And `Intl`
 * formatters are expensive to build, so they are made once and reused rather
 * than constructed inside a render.
 *
 * Two typographic details are deliberate. Amounts are shown to the euro: on
 * capital figures in the hundreds of thousands, cents are noise pretending to
 * be precision. And a difference is written with a real minus sign, U+2212,
 * not a hyphen — a hyphen is narrower than a digit and makes a column of
 * figures ragged.
 */

const MOINS = '−';
const INSECABLE = ' ';

const euros = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const entiers = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

/**
 * Below this, an amount prints as "0 €".
 *
 * A fact about `eur()` rather than about money: it rounds to the euro, so half
 * a euro is exactly where a line stops carrying information and starts claiming
 * an item cost nothing. Hiding such a line is honest; dropping it from a total
 * is not — which is why totals are taken over the whole record and only the
 * rows are filtered.
 */
export const SEUIL_EUR_VISIBLE = 0.5;

function fini(valeur: number): number {
  return Number.isFinite(valeur) ? valeur : 0;
}

/**
 * An amount, to the euro.
 *
 * The `|| 0` is not decoration: `Math.round` preserves negative zero, and
 * `Intl` faithfully renders it as "−0 €" — a minus sign in front of nothing,
 * which reads as an error every time.
 */
export function eur(valeur: number): string {
  return euros.format(Math.round(fini(valeur)) || 0).replace(/-/g, MOINS);
}

/** A difference, always signed, so a gain and a loss cannot be misread. */
export function eurSigne(valeur: number): string {
  const v = Math.round(fini(valeur));
  if (v === 0) return eur(0);
  return v > 0 ? `+${eur(v)}` : eur(v);
}

export function nombre(valeur: number): string {
  return entiers.format(Math.round(fini(valeur))).replace(/-/g, MOINS);
}

/**
 * A rate, written the way a French reader expects it: a comma, no trailing
 * zeros beyond what is needed, and an unbreakable space before the sign.
 */
export function taux(valeur: number, decimales = 2): string {
  const v = fini(valeur) * 100;
  const rendu = v
    .toFixed(decimales)
    .replace(/\.?0+$/, '')
    .replace('.', ',')
    .replace(/^-/, MOINS);
  return `${rendu === '' ? '0' : rendu}${INSECABLE}%`;
}

/** Rate points, for gaps between two rates: "0,25 point", not "0,25 %". */
export function points(valeur: number, decimales = 2): string {
  const v = fini(valeur) * 100;
  const rendu = v.toFixed(decimales).replace(/\.?0+$/, '').replace('.', ',');
  const pluriel = Math.abs(v) >= 2 ? 'points' : 'point';
  return `${rendu === '' ? '0' : rendu}${INSECABLE}${pluriel}`;
}

export function annees(valeur: number): string {
  const v = Math.round(fini(valeur));
  return `${v}${INSECABLE}${v > 1 ? 'ans' : 'an'}`;
}
