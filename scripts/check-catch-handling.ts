import { join } from 'node:path';
import { findCatchHandlingViolations } from '../shared/catch-handling';

const repoRoot = join(import.meta.dir, '..');
const report = findCatchHandlingViolations(repoRoot);

if (report.violations.length > 0) {
  console.error('Catch handling check failed; these catch sites neither log, rethrow, nor carry // log-exempt:');
  for (const violation of report.violations) {
    console.error(`  ${violation.file}:${violation.line}`);
  }
  process.exit(1);
}

console.log(`Catch handling check passed (${report.sites.length} sites).`);
