import {
  ECHELLE_FRAIS_ANNUELS,
  LIBELLES_GROUPE,
  POSTES,
  POSTES_RECURRENTS,
  sommeTaux,
  type PosteRecurrent,
  type TauxAnnuel,
} from '../lib/assuranceVie';
import { taux } from '../lib/format';

/**
 * The yearly charge, drawn to a fixed scale.
 *
 * Every bar on the page shares one scale, so a longer bar is a dearer contract
 * and nothing else. The two alternatives both destroy that: scaling each bar to
 * its own total makes every row look identical, and scaling the set to its own
 * dearest member rescales the picture whenever the field changes — a bar could
 * shrink because its neighbours got worse. So the rail is an absolute two
 * points a year, the same in every session and every screenshot, and the rare
 * contract that runs past it is marked as overflowing rather than accommodated.
 *
 * SVG rather than divs, for one reason that decides it: MACIF levies 0,01 % on
 * outstandings, which is half a percent of the rail. A flex row of
 * percentage-width divs rounds that to a layout pixel and it either vanishes or
 * snaps to a full pixel; in user units it is drawn at its true width and reads
 * as the hairline it is.
 */

/**
 * Exhaustive over the recurring items by construction: marking another charge
 * `recurrent` in the catalogue fails to compile here until it is given a
 * colour, rather than drawing a segment in `undefined`.
 */
const COULEURS: Record<PosteRecurrent, string> = {
  support: 'var(--color-brand-500)',
  gestionContrat: 'var(--color-azur-500)',
  encours: 'var(--color-ambre-500)',
};

export { COULEURS as COULEURS_POSTES };

/** Composed from the catalogue, so it cannot drift from what is drawn. */
function decrire(t: TauxAnnuel, contexte: string): string {
  const parts = POSTES_RECURRENTS.map(
    // Zero-rate items stay in the sentence: "frais sur encours 0 %" is
    // information about a contract that charges none.
    (p) => `${LIBELLES_GROUPE[POSTES[p].groupe].toLowerCase()} ${taux(t[p])}`,
  );
  return `${contexte} : ${taux(sommeTaux(t))} au total — ${parts.join(', ')}.`;
}

export function BarreFrais({
  cle,
  tauxAnnuel,
  contexte,
}: {
  /** Unique per row: the clip path needs an id of its own. */
  cle: string;
  tauxAnnuel: TauxAnnuel;
  contexte: string;
}) {
  const phrase = decrire(tauxAnnuel, contexte);
  const total = sommeTaux(tauxAnnuel);
  const deborde = total > ECHELLE_FRAIS_ANNUELS;

  // Cumulative offsets, folded rather than accumulated: the segments follow one
  // another along the rail in catalogue order, and that order is the same on
  // every row — which is what lets the eye compare one contract to the next.
  const segments = POSTES_RECURRENTS.reduce<{ poste: PosteRecurrent; x: number; largeur: number }[]>(
    (acc, poste) => {
      const precedent = acc.at(-1);
      const x = precedent ? precedent.x + precedent.largeur : 0;
      return [...acc, { poste, x, largeur: (100 * tauxAnnuel[poste]) / ECHELLE_FRAIS_ANNUELS }];
    },
    [],
  );

  return (
    <svg
      viewBox="0 0 100 8"
      preserveAspectRatio="none"
      role="img"
      aria-label={phrase}
      className="mt-1.5 ml-auto block h-1.5 w-24"
    >
      <title>{phrase}</title>
      <clipPath id={`barre-${cle}`}>
        <rect x="0" y="0" width="100" height="8" rx="4" />
      </clipPath>
      <rect x="0" y="0" width="100" height="8" rx="4" fill="var(--color-ink-100)" />
      <g clipPath={`url(#barre-${cle})`}>
        {segments.map((s) => (
          <rect
            key={s.poste}
            x={s.x}
            y="0"
            width={Math.max(0, s.largeur)}
            height="8"
            fill={COULEURS[s.poste]}
          />
        ))}
      </g>
      {/* Past the rail. The exact rate is printed above, so nothing is lost. */}
      {deborde && <path d="M 97 1 L 100 4 L 97 7 Z" fill="var(--color-ink-500)" />}
    </svg>
  );
}
