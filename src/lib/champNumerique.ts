import { useEffect, useState } from 'react';
import { nombre } from './format';

export type OptionsSaisie = {
  min: number;
  max: number;
  /** Decimals allowed; 0 for a whole-euro amount. */
  decimales?: number;
  /** For optional fields: zero is "not filled in", and shows the placeholder. */
  videSiZero?: boolean;
};

/**
 * The typing logic behind every numeric field.
 *
 * Two things it has to get right, and neither is obvious:
 *
 *  - a local draft, so that clearing the field does not make a zero appear
 *    under the user's fingers, and an entry half typed ("1,", "2 0") is left
 *    alone until they are done;
 *  - an out-of-bounds value is **clamped rather than refused**, because
 *    silently swallowing a keystroke is how a field ends up feeling broken. The
 *    limits are spelled out in the hint under each field instead.
 *
 * Both decimal marks are accepted, comma and full stop: a French keyboard types
 * one and a numeric keypad often the other, and refusing either would be
 * pedantry aimed at the wrong person.
 */
/**
 * What a keystroke leaves in the field, and what number it means.
 *
 * Split out of the hook and exported so it can be tested without a DOM — which
 * matters more than it looks. The naive version kept every digit and dot, so
 * `1.2.3` reached `Number()` as `NaN`, `NaN` reached the React state, and
 * `?rendement=NaN` reached the address bar. The engine survived it (every
 * public function clamps on the way in) but the page did not: the sliders got
 * `NaN` as a value and the shared link was broken. A second decimal mark is a
 * typo, not an attack, and it must simply be ignored.
 */
export function analyser(saisie: string, decimales: number) {
  if (decimales === 0) {
    const chiffres = saisie.replace(/[^\d]/g, '');
    return { chiffres, valeur: Number(chiffres || 0) };
  }
  const nettoye = saisie.replace(/,/g, '.').replace(/[^\d.]/g, '');
  // Only the first decimal mark counts; the rest are dropped rather than
  // poisoning the parse.
  const [entier, ...reste] = nettoye.split('.');
  const chiffres = reste.length === 0 ? entier : `${entier}.${reste.join('')}`;
  const valeur = Number(chiffres || 0);
  return { chiffres, valeur: Number.isFinite(valeur) ? valeur : 0 };
}

export function formater(valeur: number, decimales: number, videSiZero: boolean) {
  if (videSiZero && valeur === 0) return '';
  if (decimales === 0) return nombre(valeur);
  return valeur.toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimales,
  });
}

export function useChampNumerique(
  valeur: number,
  { min, max, decimales = 0, videSiZero = false }: OptionsSaisie,
  onChange: (v: number) => void,
) {
  const rendre = (v: number) => formater(v, decimales, videSiZero);
  const lire = (saisie: string) => analyser(saisie, decimales);

  const [brouillon, setBrouillon] = useState(() => rendre(valeur));

  useEffect(() => {
    if (lire(brouillon).valeur !== valeur) setBrouillon(rendre(valeur));
    // Only resynchronise when the upstream value changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valeur]);

  return {
    brouillon,
    saisir: (saisie: string) => {
      const { chiffres, valeur: v } = lire(saisie);
      setBrouillon(
        decimales === 0
          ? // A euro amount reads better with its separators, including while
            // it is being typed.
            chiffres === ''
            ? ''
            : rendre(Number(chiffres))
          : chiffres.replace('.', ','),
      );
      onChange(Math.min(max, Math.max(min, v)));
    },
    quitter: () => setBrouillon(rendre(valeur)),
  };
}
