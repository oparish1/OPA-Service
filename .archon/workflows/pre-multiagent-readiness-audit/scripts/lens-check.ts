/**
 * Records which specialist lens reports exist.
 *
 * The lens list arrives as a binding, so the YAML stays the one place that names
 * the lenses. This node never fails on a missing report: a lens whose retries were
 * exhausted is a disclosed gap the verdict script holds against READY, not a reason
 * to discard the lenses that did finish.
 */

import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { artifactsDir, emit, refuse, trimmed } from '../../.shared/io.ts';

function nonEmptyFile(path: string): boolean {
  try {
    return statSync(path).isFile() && readFileSync(path, 'utf-8').trim() !== '';
  } catch {
    return false;
  }
}

const lenses = trimmed(process.env.INPUTS_LENSES)
  .split(',')
  .map(name => name.trim())
  .filter(name => name !== '');

if (lenses.length === 0) {
  refuse('lens-check was given no lens names to look for.');
} else {
  const directory = join(artifactsDir(), 'audit');
  const present: string[] = [];
  const missing: string[] = [];
  for (const lens of lenses) {
    (nonEmptyFile(join(directory, `${lens}.md`)) ? present : missing).push(lens);
  }
  emit({ present, missing });
}
