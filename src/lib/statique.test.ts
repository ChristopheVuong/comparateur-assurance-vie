/**
 * The property that makes this application what it is, guarded by a test.
 *
 * The page is static: it fetches nothing, it stores nothing, and it does not
 * know what day it is except where it is handed the date. That is not a
 * performance choice — it is what makes the tool work offline, track nobody,
 * and keep answering the same thing to a shared link a year later.
 *
 * It is also exactly the kind of property that erodes one reasonable-sounding
 * commit at a time. "It would be better to refresh the rate on load" is how a
 * static page acquires a dependency on a third party that answers 403, and how
 * a comparison that used to be reproducible starts drifting. So the rule is not
 * a sentence in the README: it is here, and it fails the build.
 *
 * If one of these ever has to be relaxed, the fix is to argue it in a commit
 * message and delete the assertion deliberately — not to notice afterwards.
 */

import { describe, expect, it } from 'vitest';

/*
 * Sources read through Vite rather than through `node:fs`, on purpose: the
 * application's tsconfig deliberately carries DOM types and not Node's, so that
 * nobody can reach for `process` inside a component. A guard that forced Node's
 * globals into that scope would weaken the very discipline it exists to defend.
 */
const SOURCES = Object.entries(
  import.meta.glob('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<
    string,
    string
  >,
)
  .filter(([chemin]) => !chemin.endsWith('.test.ts'))
  .map(([chemin, contenu]) => ({
    // '../App.tsx' and './format.ts' both name a file the reader can open.
    chemin: chemin.replace(/^\.\.\//, '').replace(/^\.\//, 'lib/'),
    contenu,
  }));

/**
 * The shell too, and not only the modules.
 *
 * `index.html` is the one file that can reach a third party without a single
 * line of TypeScript, and it did: a Google Fonts stylesheet sent every
 * visitor's address to Google before the first pixel, on a page whose footer
 * promised that nothing left their browser. The guard scanned `src/` and
 * declared victory.
 */
const PAGE: string = import.meta.glob('../../index.html', {
  query: '?raw',
  import: 'default',
  eager: true,
})['../../index.html'] as string;

describe('the shipped page reaches nobody', () => {
  it('finds the page to check', () => {
    expect(PAGE).toContain('<html');
  });

  it('names no host but its own', () => {
    const externes = [...PAGE.matchAll(/(?:href|src)\s*=\s*"(https?:)?\/\/([^"/]+)/gi)].map(
      (m) => m[2],
    );
    expect(externes, `index.html appelle ${externes.join(', ')}`).toEqual([]);
  });

  it('preconnects to nothing, which is the same promise stated earlier', () => {
    expect(PAGE).not.toMatch(/rel\s*=\s*"(preconnect|dns-prefetch|preload)"/i);
  });
});

describe('the page stays static', () => {
  it('has sources to check in the first place', () => {
    // Guards the guard: a path change that silently emptied this list would
    // make every assertion below pass for the wrong reason.
    expect(SOURCES.length).toBeGreaterThan(10);
  });

  it('never reaches the network at runtime', () => {
    for (const { chemin, contenu } of SOURCES) {
      expect(contenu, `${chemin} appelle le réseau`).not.toMatch(
        /\bfetch\s*\(|XMLHttpRequest|new WebSocket|navigator\.sendBeacon/,
      );
    }
  });

  it('never stores anything in the browser', () => {
    // The address carries the whole plan. Nothing else needs to remember it,
    // and nothing that remembers it can be handed to somebody else.
    for (const { chemin, contenu } of SOURCES) {
      expect(contenu, `${chemin} écrit dans le navigateur`).not.toMatch(
        /localStorage|sessionStorage|indexedDB|document\.cookie/,
      );
    }
  });

  it('reads the clock in one place only, and never inside the engine', () => {
    // `lib/` must be pure: two runs of the same plan have to agree, and a
    // shared link has to project the same figures next year. Where the day
    // genuinely matters — has this campaign closed? — it arrives as an
    // argument, from the edge of the application.
    const horloge = /new Date\s*\(\s*\)|Date\.now\s*\(/;
    const lecteurs = SOURCES.filter((s) => horloge.test(s.contenu)).map((s) => s.chemin);
    expect(lecteurs).toEqual(['App.tsx']);
  });
});
