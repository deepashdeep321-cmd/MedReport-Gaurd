import type { RulesBundle } from '../types/medreport';
import { DISPLAY_NAMES } from './rulesData';

export interface ParsedRange {
  ref_low: number | null;
  ref_high: number | null;
}

export function normalizeTestName(rawName: string, aliases: Record<string, string>): string {
  const cleaned = rawName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (aliases[cleaned]) {
    return aliases[cleaned];
  }
  const beforeParen = cleaned.replace(/\s*\([^)]*\)/g, '').trim();
  if (beforeParen && aliases[beforeParen]) {
    return aliases[beforeParen];
  }
  const insideParenMatch = cleaned.match(/\(([^)]+)\)/);
  if (insideParenMatch) {
    const inside = insideParenMatch[1].trim();
    if (aliases[inside]) {
      return aliases[inside];
    }
  }
  const stripped = cleaned.replace(/[()[\]]/g, '').trim();
  if (aliases[stripped]) {
    return aliases[stripped];
  }
  return stripped.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function getDisplayName(testNameStd: string, fallbackRaw: string): string {
  return DISPLAY_NAMES[testNameStd] || fallbackRaw.trim();
}

export function parseReferenceRange(refText: string): ParsedRange {
  if (!refText || !refText.trim()) {
    return { ref_low: null, ref_high: null };
  }

  const cleaned = refText
    .replace(/[()[\]]/g, ' ')
    .replace(/–|—/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  // Pattern: "13.5 - 17.5" or "13.5 to 17.5"
  const betweenMatch = cleaned.match(/(-?\d+(?:\.\d+)?)\s*(?:-|to)\s*(-?\d+(?:\.\d+)?)/i);
  if (betweenMatch) {
    const low = Number.parseFloat(betweenMatch[1]);
    const high = Number.parseFloat(betweenMatch[2]);
    if (Number.isFinite(low) && Number.isFinite(high)) {
      return { ref_low: Math.min(low, high), ref_high: Math.max(low, high) };
    }
  }

  // Pattern: "< 200" or "<= 200" or "up to 200"
  const upperMatch = cleaned.match(/(?:<=?|up\s+to|below|under)\s*(-?\d+(?:\.\d+)?)/i);
  if (upperMatch) {
    const high = Number.parseFloat(upperMatch[1]);
    if (Number.isFinite(high)) {
      return { ref_low: null, ref_high: high };
    }
  }

  // Pattern: "> 40" or ">= 60" or "above 60"
  const lowerMatch = cleaned.match(/(?:>=?|above|over)\s*(-?\d+(?:\.\d+)?)/i);
  if (lowerMatch) {
    const low = Number.parseFloat(lowerMatch[1]);
    if (Number.isFinite(low)) {
      return { ref_low: low, ref_high: null };
    }
  }

  return { ref_low: null, ref_high: null };
}

export function convertUnit(
  testNameStd: string,
  value: number,
  unitRaw: string,
  rules: RulesBundle,
): { value: number; unit_std: string; converted: boolean } {
  const normalizedUnit = unitRaw.trim();
  const match = rules.unit_conversions.find(
    (rule) =>
      rule.test_name_std === testNameStd &&
      rule.from_unit.toLowerCase() === normalizedUnit.toLowerCase(),
  );
  if (!match) {
    return { value, unit_std: normalizedUnit, converted: false };
  }
  const convertedValue = Number((value * match.factor).toFixed(2));
  return {
    value: convertedValue,
    unit_std: match.to_unit,
    converted: true,
  };
}

export function roundClean(value: number): number {
  return Number(value.toFixed(2));
}
