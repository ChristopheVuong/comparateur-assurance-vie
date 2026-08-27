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
export function useChampNumerique(
  valeur: number,
  { min, max, decimales = 0, videSiZero = false }: OptionsSaisie,
  onChange: (v: number) => void,
) {
  const formater = (v: number) =>
    videSiZero && v === 0
      ? ''
      : decimales === 0
        ? nombre(v)
        : v.toLocaleString('fr-FR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: decimales,
          });

  const analyser = (saisie: string) => {
    const chiffres =
      decimales === 0
        ? saisie.replace(/[^\d]/g, '')
        : saisie.replace(/,/g, '.').replace(/[^\d.]/g, '');
    return { chiffres, valeur: Number(chiffres || 0) };
  };

  const [brouillon, setBrouillon] = useState(() => formater(valeur));

  useEffect(() => {
    if (analyser(brouillon).valeur !== valeur) setBrouillon(formater(valeur));
    // Only resynchronise when the upstream value changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valeur]);

  return {
    brouillon,
    saisir: (saisie: string) => {
      const { chiffres, valeur: v } = analyser(saisie);
      setBrouillon(
        decimales === 0
          ? // A euro amount reads better with its separators, including while
            // it is being typed.
            chiffres === ''
            ? ''
            : formater(Number(chiffres))
          : chiffres.replace('.', ','),
      );
      onChange(Math.min(max, Math.max(min, v)));
    },
    quitter: () => setBrouillon(formater(valeur)),
  };
}
