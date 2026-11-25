import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
  REFERENCE_COVERAGE_LEDGER,
  summarizeReferenceCoverage,
} from '../src/content/reference-coverage';

interface DiscrepancyItem {
  id: string;
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  evidenceClass: string;
  title: string;
  status:
    | 'resolved'
    | 'documented-intentional'
    | 'open-external-compute'
    | 'open-external-environment';
  affectedCoverageIds: string[];
  files: string[];
  description: string;
  verification: string;
}

interface DiscrepancyRegister {
  schema: string;
  patch: string;
  milestone: number;
  items: DiscrepancyItem[];
}

const register: DiscrepancyRegister = JSON.parse(
  readFileSync('docs/reference/milestone7-discrepancy-register.json', 'utf8')
);

describe('Milestone 7.0 — Reference Coverage Truth Contract & Discrepancy Register', () => {
  test('retains all 158 Patch 26.18 coverage IDs with separated evidence classes and zero undocumented approximations', () => {
    const summary = summarizeReferenceCoverage();
    expect(summary.totalEntries).toBe(158);
    expect(summary.undocumentedApproximations).toBe(0);

    const ids = new Set<string>();
    for (const entry of REFERENCE_COVERAGE_LEDGER) {
      expect(ids.has(entry.id)).toBe(false);
      ids.add(entry.id);
      expect(entry.implementationEvidence).toBeTruthy();
      expect(entry.referenceEvidence).toBeTruthy();
      expect(entry.presentationEvidence).toBeTruthy();
      if (entry.status === 'approximation') {
        expect(
          entry.playerDeviationNote && entry.playerDeviationNote.trim().length > 15,
          `Missing concrete playerDeviationNote on ${entry.id}`
        ).toBe(true);
      }
    }

    // Voidgrubs and Rift Herald are honestly marked approximation with exact 06:00 / 15:00 & Siege Charge notes
    const grubs = REFERENCE_COVERAGE_LEDGER.find((e) => e.id === 'objective:voidgrubs')!;
    const herald = REFERENCE_COVERAGE_LEDGER.find((e) => e.id === 'objective:rift-herald')!;
    expect(grubs.status).toBe('approximation');
    expect(grubs.playerDeviationNote).toContain('06:00');
    expect(herald.status).toBe('approximation');
    expect(herald.playerDeviationNote).toContain('15:00');
    expect(herald.playerDeviationNote).toContain('Siege Charge');
  });

  test('discrepancy register cross-references valid coverage IDs and leaves zero open P1 simulation bugs', () => {
    expect(register.schema).toBe('milestone7-discrepancy-register-v1');
    expect(register.patch).toBe('26.18');
    expect(register.items.length).toBeGreaterThanOrEqual(11);

    const coverageIds = new Set(REFERENCE_COVERAGE_LEDGER.map((e) => e.id));
    const registerIds = new Set<string>();

    for (const item of register.items) {
      expect(registerIds.has(item.id)).toBe(false);
      registerIds.add(item.id);
      for (const cid of item.affectedCoverageIds) {
        expect(coverageIds.has(cid), `Unknown coverage ID ${cid} in ${item.id}`).toBe(true);
      }
      if (item.severity === 'P1') {
        expect(item.status, `Open P1 discrepancy ${item.id}: ${item.title}`).toBe('resolved');
      }
    }

    for (const entry of REFERENCE_COVERAGE_LEDGER) {
      for (const did of entry.discrepancyIds) {
        expect(registerIds.has(did), `Unknown discrepancy ID ${did} on ${entry.id}`).toBe(true);
      }
    }
  });
});
