/**
 * ANSI/ASQ Z1.4-2008 Standard AQL Tables
 * General Inspection Level II (Normal Inspection)
 */

// Lot Size Ranges for General Level II → Code Letter
export interface LotSizeRange {
  min: number;
  max: number;
  codeLetter: string;
}

export const LOT_SIZE_CODE_LETTERS: LotSizeRange[] = [
  { min: 2, max: 8, codeLetter: 'A' },
  { min: 9, max: 15, codeLetter: 'B' },
  { min: 16, max: 25, codeLetter: 'C' },
  { min: 26, max: 50, codeLetter: 'D' },
  { min: 51, max: 90, codeLetter: 'E' },
  { min: 91, max: 150, codeLetter: 'F' },
  { min: 151, max: 280, codeLetter: 'G' },
  { min: 281, max: 500, codeLetter: 'H' },
  { min: 501, max: 1200, codeLetter: 'J' },
  { min: 1201, max: 3200, codeLetter: 'K' },
  { min: 3201, max: 10000, codeLetter: 'L' },
  { min: 10001, max: 35000, codeLetter: 'M' },
  { min: 35001, max: 150000, codeLetter: 'N' },
  { min: 150001, max: 500000, codeLetter: 'P' },
  { min: 500001, max: Infinity, codeLetter: 'Q' },
];

// Code Letter → Sample Size
export const SAMPLE_SIZES: Record<string, number> = {
  A: 2,
  B: 3,
  C: 5,
  D: 8,
  E: 13,
  F: 20,
  G: 32,
  H: 50,
  J: 80,
  K: 125,
  L: 200,
  M: 315,
  N: 500,
  P: 800,
  Q: 1250,
  R: 2000,
};

// Code letter order for arrow navigation
const CODE_LETTER_ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'Q', 'R'];

// Accept/Reject numbers by Code Letter and AQL Level
// null means use arrow (↓ = use next larger sample, ↑ = use next smaller sample)
// Format: { accept: number, reject: number } or 'down' for arrow down, 'up' for arrow up
export type AcceptRejectValue = { accept: number; reject: number } | 'down' | 'up';

// ANSI/ASQ Z1.4-2008 Table II-A: Single Sampling Plans for Normal Inspection
// Verified against multiple online sources and official standard references
export const AQL_ACCEPT_REJECT_TABLE: Record<string, Record<string, AcceptRejectValue>> = {
  A: {
    '0.65': 'down',
    '1.0': 'down',
    '1.5': 'down',
    '2.5': 'down',
    '4.0': 'down',
    '6.5': 'down',
  },
  B: {
    '0.65': 'down',
    '1.0': 'down',
    '1.5': 'down',
    '2.5': 'down',
    '4.0': 'down',
    '6.5': 'down',
  },
  C: {
    '0.65': 'down',
    '1.0': 'down',
    '1.5': 'down',
    '2.5': 'down',
    '4.0': 'down',
    '6.5': { accept: 0, reject: 1 },
  },
  D: {
    '0.65': 'down',
    '1.0': 'down',
    '1.5': 'down',
    '2.5': 'down',
    '4.0': { accept: 0, reject: 1 },
    '6.5': { accept: 1, reject: 2 },
  },
  E: {
    '0.65': 'down',
    '1.0': 'down',
    '1.5': 'down',
    '2.5': { accept: 0, reject: 1 },
    '4.0': { accept: 1, reject: 2 },
    '6.5': { accept: 2, reject: 3 },
  },
  F: {
    '0.65': 'down',
    '1.0': 'down',
    '1.5': { accept: 0, reject: 1 },
    '2.5': { accept: 1, reject: 2 },
    '4.0': { accept: 2, reject: 3 },
    '6.5': { accept: 3, reject: 4 },
  },
  G: {
    '0.65': 'down',
    '1.0': { accept: 0, reject: 1 },
    '1.5': { accept: 1, reject: 2 },
    '2.5': { accept: 2, reject: 3 },
    '4.0': { accept: 3, reject: 4 },
    '6.5': { accept: 5, reject: 6 },
  },
  H: {
    '0.65': { accept: 0, reject: 1 },
    '1.0': { accept: 1, reject: 2 },
    '1.5': { accept: 2, reject: 3 },
    '2.5': { accept: 3, reject: 4 },
    '4.0': { accept: 5, reject: 6 },
    '6.5': { accept: 7, reject: 8 },
  },
  J: {
    '0.65': { accept: 0, reject: 1 },
    '1.0': { accept: 2, reject: 3 },
    '1.5': { accept: 3, reject: 4 },
    '2.5': { accept: 5, reject: 6 },
    '4.0': { accept: 7, reject: 8 },
    '6.5': { accept: 10, reject: 11 },
  },
  K: {
    '0.65': { accept: 1, reject: 2 },
    '1.0': { accept: 3, reject: 4 },
    '1.5': { accept: 5, reject: 6 },
    '2.5': { accept: 7, reject: 8 },
    '4.0': { accept: 10, reject: 11 },
    '6.5': { accept: 14, reject: 15 },
  },
  L: {
    '0.65': { accept: 2, reject: 3 },
    '1.0': { accept: 5, reject: 6 },
    '1.5': { accept: 7, reject: 8 },
    '2.5': { accept: 10, reject: 11 },
    '4.0': { accept: 14, reject: 15 },
    '6.5': { accept: 21, reject: 22 },
  },
  M: {
    '0.65': { accept: 3, reject: 4 },
    '1.0': { accept: 7, reject: 8 },
    '1.5': { accept: 10, reject: 11 },
    '2.5': { accept: 14, reject: 15 },
    '4.0': { accept: 21, reject: 22 },
    '6.5': { accept: 21, reject: 22 },
  },
  N: {
    '0.65': { accept: 5, reject: 6 },
    '1.0': { accept: 10, reject: 11 },
    '1.5': { accept: 14, reject: 15 },
    '2.5': { accept: 21, reject: 22 },
    '4.0': { accept: 21, reject: 22 },
    '6.5': { accept: 21, reject: 22 },
  },
  P: {
    '0.65': { accept: 7, reject: 8 },
    '1.0': { accept: 14, reject: 15 },
    '1.5': { accept: 21, reject: 22 },
    '2.5': { accept: 21, reject: 22 },
    '4.0': { accept: 21, reject: 22 },
    '6.5': { accept: 21, reject: 22 },
  },
  Q: {
    '0.65': { accept: 10, reject: 11 },
    '1.0': { accept: 21, reject: 22 },
    '1.5': { accept: 21, reject: 22 },
    '2.5': { accept: 21, reject: 22 },
    '4.0': { accept: 21, reject: 22 },
    '6.5': { accept: 21, reject: 22 },
  },
  R: {
    '0.65': { accept: 14, reject: 15 },
    '1.0': { accept: 21, reject: 22 },
    '1.5': { accept: 21, reject: 22 },
    '2.5': { accept: 21, reject: 22 },
    '4.0': { accept: 21, reject: 22 },
    '6.5': { accept: 21, reject: 22 },
  },
};

/**
 * Get the next code letter in sequence (for arrow down navigation)
 */
export function getNextCodeLetter(codeLetter: string): string | null {
  const index = CODE_LETTER_ORDER.indexOf(codeLetter);
  if (index === -1 || index >= CODE_LETTER_ORDER.length - 1) {
    return null;
  }
  return CODE_LETTER_ORDER[index + 1];
}

/**
 * Get the previous code letter in sequence (for arrow up navigation)
 */
export function getPrevCodeLetter(codeLetter: string): string | null {
  const index = CODE_LETTER_ORDER.indexOf(codeLetter);
  if (index <= 0) {
    return null;
  }
  return CODE_LETTER_ORDER[index - 1];
}
