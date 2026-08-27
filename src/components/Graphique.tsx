import type { ResultatAccessible } from '../lib/assuranceVie';
import { contrat } from '../lib/contrats';
import { eur } from '../lib/format';

/**
 * One curve per contract, drawn by hand.
 *
 * No chart library, for the same reason the rest of the project has no
 * dependencies: six polylines and an axis are a hundred lines of SVG, against a
 * hundred kilobytes of someone else's abstractions and a styling fight.
 *
 * What the picture is for is the *shape* rather than the endpoint — the table
 * already gives the endpoint. Fee gaps look like nothing for eight years and
 * then fan out, and that fan is the argument. A premiums line runs underneath
 * so the reader can see how much of the final figure is their own money.
 */

const L = 62;
const R = 16;
const T = 16;
const B = 30;
const W = 720;
const H = 300;

const COULEURS = [
  'var(--color-brand-500)',
  'var(--color-azur-500)',
  'var(--color-jade-500)',
  'var(--color-ambre-500)',
  'var(--color-brique-500)',
  'var(--color-ink-500)',
];

function pasLisible(max: number, cibles = 4): number {
  const brut = max / cibles;
  const decade = 10 ** Math.floor(Math.log10(brut));
  const rapport = brut / decade;
  const pas = rapport < 1.5 ? 1 : rapport < 3 ? 2 : rapport < 7 ? 5 : 10;
  return pas * decade;
}

export function Graphique({
  resultats,
  survole,
  onSurvol,
}: {
  resultats: ResultatAccessible[];
  survole: string | null;
  onSurvol: (cle: string | null) => void;
}) {
  if (resultats.length === 0) return null;

  const horizon = resultats[0].annees.length;
  const max = Math.max(...resultats.flatMap((r) => r.annees.map((a) => a.valeurFin)));
  if (!(max > 0)) return null;

  const x = (annee: number) => L + ((W - L - R) * annee) / horizon;
  const y = (valeur: number) => H - B - ((H - T - B) * valeur) / (max * 1.05);

  const pas = pasLisible(max * 1.05);
  const graduations: number[] = [];
  for (let v = 0; v <= max * 1.05; v += pas) graduations.push(v);

  const anneesAxe = [0, ...resultats[0].annees.map((a) => a.annee)].filter(
    (a) => a === 0 || a === horizon || a % Math.max(1, Math.round(horizon / 5)) === 0,
  );

  const primes = [
    { annee: 0, valeur: 0 },
    ...resultats[0].annees.map((a) => ({ annee: a.annee, valeur: a.primesCumulees })),
  ];

  return (
    <div className="card p-5 sm:p-6">
      <h3 className="text-base font-semibold text-ink-900">Comment l’écart se creuse</h3>
      <p className="mt-1 text-sm leading-relaxed text-ink-500">
        Valeur du contrat année après année. Les courbes se tiennent pendant des années, puis
        s’écartent : un demi-point de frais ne se voit pas tout de suite, il se compose.
      </p>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={`Valeur de ${resultats.length} contrats sur ${horizon} ans`}
      >
        {graduations.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--color-ink-100)" />
            <text
              x={L - 8}
              y={y(v) + 4}
              textAnchor="end"
              fontSize="11"
              fill="var(--color-ink-400)"
            >
              {v >= 1000 ? `${Math.round(v / 1000)} k€` : `${v} €`}
            </text>
          </g>
        ))}

        {anneesAxe.map((a) => (
          <text
            key={a}
            x={x(a)}
            y={H - B + 18}
            textAnchor="middle"
            fontSize="11"
            fill="var(--color-ink-400)"
          >
            {a === 0 ? '0' : `${a} ans`}
          </text>
        ))}

        {/* Ce que vous avez versé — la ligne de flottaison. */}
        <polyline
          points={primes.map((p) => `${x(p.annee)},${y(p.valeur)}`).join(' ')}
          fill="none"
          stroke="var(--color-ink-300)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />

        {resultats.map((r, i) => {
          const points = [
            `${x(0)},${y(0)}`,
            ...r.annees.map((a) => `${x(a.annee)},${y(a.valeurFin)}`),
          ].join(' ');
          const estActif = survole === null || survole === r.cle;
          return (
            <polyline
              key={r.cle}
              points={points}
              fill="none"
              stroke={COULEURS[i % COULEURS.length]}
              strokeWidth={survole === r.cle ? 3 : 2}
              strokeLinejoin="round"
              opacity={estActif ? 1 : 0.2}
              onMouseEnter={() => onSurvol(r.cle)}
              onMouseLeave={() => onSurvol(null)}
              className="transition-opacity"
            />
          );
        })}
      </svg>

      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {resultats.map((r, i) => (
          <li key={r.cle}>
            <button
              type="button"
              onMouseEnter={() => onSurvol(r.cle)}
              onMouseLeave={() => onSurvol(null)}
              onFocus={() => onSurvol(r.cle)}
              onBlur={() => onSurvol(null)}
              className={[
                'flex items-center gap-1.5 text-xs transition',
                survole === null || survole === r.cle ? 'text-ink-600' : 'text-ink-300',
              ].join(' ')}
            >
              <span
                className="h-0.5 w-4 rounded-full"
                style={{ backgroundColor: COULEURS[i % COULEURS.length] }}
              />
              {contrat(r.cle).libelle}
            </button>
          </li>
        ))}
        <li className="flex items-center gap-1.5 text-xs text-ink-400">
          <span className="h-px w-4 border-t border-dashed border-ink-300" />
          Ce que vous avez versé ({eur(primes.at(-1)?.valeur ?? 0)})
        </li>
      </ul>

      <p className="field-hint mt-3">
        Les valeurs tracées sont nettes des prélèvements sociaux du fonds en euros, retenus chaque
        année, mais brutes de l’impôt de sortie, qui ne se paie qu’au rachat. Le tableau, lui, donne
        bien le capital net.
      </p>
    </div>
  );
}
