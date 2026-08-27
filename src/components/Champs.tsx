import { useId } from 'react';
import { useChampNumerique } from '../lib/champNumerique';
import {
  POSITION_MAX,
  POSITION_MIN,
  positionDeValeur,
  valeurDePosition,
} from '../lib/echelle';

/**
 * The four controls the whole page is built from.
 *
 * Every slider doubles as a field, rather than sitting beside one: the value
 * shown *is* the input. Two controls for one number would double the width and
 * halve the confidence that they agree.
 */

// ---------------------------------------------------------------------------
// Slider
// ---------------------------------------------------------------------------

type CurseurProps = {
  label: string;
  valeur: number;
  min: number;
  max: number;
  pas: number;
  onChange: (v: number) => void;
  rendu: (v: number) => string;
  /** Turns the displayed value into an editable field, in the slider's own unit. */
  saisie?: { suffixe: string; decimales?: number };
  reperes?: { valeur: number; label: string }[];
  hint?: string;
  labelMasque?: boolean;
};

export function Curseur({
  label,
  valeur,
  min,
  max,
  pas,
  onChange,
  rendu,
  saisie,
  reperes = [],
  hint,
  labelMasque = false,
}: CurseurProps) {
  const id = useId();
  const idSaisie = useId();
  const progression = max > min ? ((valeur - min) / (max - min)) * 100 : 0;

  const champ = useChampNumerique(
    valeur,
    { min, max, decimales: saisie?.decimales ?? 0 },
    onChange,
  );

  return (
    <div>
      {labelMasque ? (
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
      ) : (
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <label
            htmlFor={saisie ? idSaisie : id}
            className="text-sm font-medium text-ink-700"
          >
            {label}
          </label>
          {saisie ? (
            <span className="flex items-baseline gap-1 rounded-lg border border-transparent px-1.5 py-0.5 transition focus-within:border-brand-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-brand-100">
              <input
                id={idSaisie}
                inputMode="decimal"
                autoComplete="off"
                value={champ.brouillon}
                onChange={(e) => champ.saisir(e.target.value)}
                onBlur={champ.quitter}
                // Sized on its content: a rate needs four characters and an
                // amount ten, and a fixed width would leave a hole either way.
                size={Math.max(2, champ.brouillon.length)}
                className="tabular w-auto bg-transparent text-right text-xl font-semibold text-ink-900 outline-none sm:text-2xl"
              />
              <span className="text-base text-ink-400">{saisie.suffixe}</span>
            </span>
          ) : (
            <output htmlFor={id} className="tabular text-xl font-semibold text-ink-900 sm:text-2xl">
              {rendu(valeur)}
            </output>
          )}
        </div>
      )}

      <input
        id={id}
        type="range"
        className="brand-range"
        min={min}
        max={max}
        step={pas}
        value={valeur}
        // Without this the browser restores the field value on reload and it
        // drifts away from the React state.
        autoComplete="off"
        aria-label={labelMasque || saisie ? label : undefined}
        onChange={(e) => onChange(Number(e.target.value))}
        // Scrolling the page over a slider must not change its value: the wheel
        // is neutralised by dropping focus and letting the event through.
        onWheel={(e) => e.currentTarget.blur()}
        style={{
          ['--range-track' as string]: `linear-gradient(to right, var(--color-brand-500) ${progression}%, var(--color-ink-200) ${progression}%)`,
        }}
      />

      {reperes.length > 0 && (
        <div className="relative mt-1 h-9">
          {reperes.map((r) => {
            const position = ((r.valeur - min) / (max - min)) * 100;
            if (position < 0 || position > 100) return null;
            // A tick at either end would be clipped if it stayed centred on its
            // own value.
            const bord = position <= 3 ? 'debut' : position >= 97 ? 'fin' : 'centre';
            return (
              <button
                key={`${r.valeur}-${r.label}`}
                type="button"
                onClick={() => onChange(r.valeur)}
                className={[
                  'absolute top-0 whitespace-nowrap rounded px-1 py-0.5 text-[11px] text-ink-400 transition hover:text-brand-600',
                  bord === 'debut' ? '' : bord === 'fin' ? '-translate-x-full' : '-translate-x-1/2',
                ].join(' ')}
                style={{ left: `${position}%` }}
              >
                <span
                  className={[
                    'mb-1 block h-1.5 w-px bg-ink-300',
                    bord === 'debut' ? 'mr-auto' : bord === 'fin' ? 'ml-auto' : 'mx-auto',
                  ].join(' ')}
                />
                {r.label}
              </button>
            );
          })}
        </div>
      )}

      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Logarithmic slider
// ---------------------------------------------------------------------------

type CurseurLogProps = {
  label: string;
  /** In euros: the logarithmic position stays an implementation detail. */
  valeur: number;
  onChange: (v: number) => void;
  reperes?: { valeur: number; label: string }[];
};

export function CurseurLog({ label, valeur, onChange, reperes = [] }: CurseurLogProps) {
  return (
    <Curseur
      label={label}
      valeur={positionDeValeur(valeur)}
      min={POSITION_MIN}
      max={POSITION_MAX}
      pas={1}
      onChange={(p) => onChange(valeurDePosition(p))}
      rendu={() => ''}
      labelMasque
      reperes={reperes.map((r) => ({ ...r, valeur: positionDeValeur(r.valeur) }))}
    />
  );
}

// ---------------------------------------------------------------------------
// Amount input
// ---------------------------------------------------------------------------

type MontantProps = {
  label: string;
  valeur: number;
  onChange: (v: number) => void;
  suffixe?: string;
  hint?: string;
  min?: number;
  max?: number;
  decimales?: number;
  /**
   * Shown greyed out when the field is empty. Declaring one also makes the
   * field optional: zero renders as an empty field rather than as a "0" to be
   * erased before anything can be typed.
   */
  placeholder?: string;
};

export function Montant({
  label,
  valeur,
  onChange,
  suffixe = '€',
  hint,
  min = 0,
  max = 100_000_000,
  decimales = 0,
  placeholder,
}: MontantProps) {
  const id = useId();
  const champ = useChampNumerique(
    valeur,
    { min, max, decimales, videSiZero: placeholder !== undefined },
    onChange,
  );

  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className="flex items-center rounded-xl border border-ink-200 bg-white transition focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100">
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          placeholder={placeholder}
          className="tabular w-full rounded-xl bg-transparent px-3.5 py-2.5 text-base font-semibold text-ink-900 outline-none placeholder:font-normal placeholder:text-ink-300"
          value={champ.brouillon}
          onChange={(e) => champ.saisir(e.target.value)}
          onBlur={champ.quitter}
        />
        <span className="shrink-0 pr-3.5 text-sm text-ink-400">{suffixe}</span>
      </div>
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Segmented control
// ---------------------------------------------------------------------------

type SegmentProps<T extends string | number | boolean> = {
  label?: string;
  valeur: T;
  options: { valeur: T; label: string }[];
  onChange: (v: T) => void;
  hint?: string;
};

export function Segments<T extends string | number | boolean>({
  label,
  valeur,
  options,
  onChange,
  hint,
}: SegmentProps<T>) {
  return (
    <div>
      {label && <span className="field-label">{label}</span>}
      <div className="flex rounded-xl border border-ink-200 bg-ink-100/60 p-1">
        {options.map((o) => {
          const actif = o.valeur === valeur;
          return (
            <button
              key={String(o.valeur)}
              type="button"
              aria-pressed={actif}
              onClick={() => onChange(o.valeur)}
              className={[
                'flex-1 rounded-lg px-2.5 py-2 text-sm font-medium transition',
                actif ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800',
              ].join(' ')}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}
