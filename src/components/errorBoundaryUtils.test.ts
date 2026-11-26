import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSafeReports, formatSafeErrorMessage } from './errorBoundaryUtils';

test('formatSafeErrorMessage handles Error instances, strings, and unknown values', () => {
  assert.equal(formatSafeErrorMessage(new Error('Render failed')), 'Render failed');
  assert.equal(formatSafeErrorMessage('Custom error text'), 'Custom error text');
  assert.match(formatSafeErrorMessage(null), /unexpected rendering error/i);
  assert.equal(formatSafeErrorMessage(new Error('x'.repeat(300))).length, 220);
});

test('extractSafeReports returns empty array safely on malformed API responses', () => {
  assert.deepEqual(extractSafeReports(null), { reports: [], valid: false });
  assert.deepEqual(extractSafeReports({ error: 'Server HTML' }), { reports: [], valid: false });
  assert.deepEqual(extractSafeReports({ reports: 'not-an-array' }), { reports: [], valid: false });

  const good = extractSafeReports({
    reports: [{ id: 'rep-1' }, { bad: true }],
  });
  assert.equal(good.valid, true);
  assert.equal(good.reports.length, 1);
  assert.equal(good.reports[0].id, 'rep-1');
});
