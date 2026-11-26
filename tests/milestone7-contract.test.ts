import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
  REFERENCE_COVERAGE_LEDGER,
  summarizeReferenceCoverage,
} from '../src/content/reference-coverage';

describe('Milestone 7.0 — Discrepancy Contract & Reference Coverage Ledger', () => {
  test('retains all 158 coverage IDs, separates evidence dimensions, and documents every approximation', () => {
    const summary = summarizeReferenceCoverage();
    expect(summary.totalEntries).toBe(158);
    expect(summary.byStatus.unimplemented).toBe(0);
    expect(summary.approximationsWithoutDeviationNote).toBe(0);

    const ids = new Set<string>();
    for (const entry of REFERENCE_COVERAGE_LEDGER) {
      expect(ids.has(entry.id)).toBe(false);
      ids.add(entry.id);
      expect(entry.patch).toBe('26.18');
      expect(entry.implementationEvidence).toBeTruthy();
      expect(entry.referenceEvidence).toBeTruthy();
      expect(entry.presentationEvidence).toBeTruthy();
      if (entry.status === 'approximation') {
        expect(entry.playerDeviationNote).toBeTruthy();
        expect(entry.playerDeviationNote!.trim().length).toBeGreaterThan(15);
      }
    }

    const implTotal = Object.values(summary.byImplementationEvidence).reduce((a, b) => a + b, 0);
    const refTotal = Object.values(summary.byReferenceEvidence).reduce((a, b) => a + b, 0);
    const presTotal = Object.values(summary.byPresentationEvidence).reduce((a, b) => a + b, 0);
    expect(implTotal).toBe(summary.totalEntries);
    expect(refTotal).toBe(summary.totalEntries);
    expect(presTotal).toBe(summary.totalEntries);
  });

  test('versioned Milestone 7 discrepancy register conforms to Increment 7.0 schema', () => {
    const register = JSON.parse(
      readFileSync('docs/reference/milestone7-discrepancy-register.json', 'utf8')
    );
    expect(register.format).toBe(1);
    expect(register.milestone).toBe(7);
    expect(register.patch).toBe('26.18');
    expect(register.baselineVitestInventory.totalFiles).toBe(619);
    expect(Array.isArray(register.discrepancies)).toBe(true);
    expect(register.discrepancies.length).toBeGreaterThanOrEqual(8);

    const seenIds = new Set<string>();
    for (const d of register.discrepancies) {
      expect(seenIds.has(d.id)).toBe(false);
      seenIds.add(d.id);
      expect(d.patch).toBe('26.18');
      expect(typeof d.clientBuild).toBe('string');
      expect(typeof d.sourceOrCaptureHash).toBe('string');
      expect(typeof d.implementationLocation).toBe('string');
      expect(typeof d.measuredResult).toBe('string');
      expect(typeof d.uncertainty).toBe('string');
      expect(['P0', 'P1', 'P2', 'P3']).toContain(d.severity);
      expect(typeof d.owner).toBe('string');
      expect(Array.isArray(d.dependencies)).toBe(true);
      expect(typeof d.acceptanceScenario).toBe('string');
      expect(['open', 'fixed', 'accepted-deviation', 'blocked-external']).toContain(d.disposition);
    }
  });
});
