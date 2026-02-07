/**
 * AQL Z1.4-2008 Calculator Utilities
 * General Inspection Level II (Normal Inspection)
 */

import {
  LOT_SIZE_CODE_LETTERS,
  SAMPLE_SIZES,
  AQL_ACCEPT_REJECT_TABLE,
  getNextCodeLetter,
  AcceptRejectValue,
} from './aqlTables';

// Re-export for use by components (avoids diamond dependency issues in production builds)
export { LOT_SIZE_CODE_LETTERS, SAMPLE_SIZES, AQL_ACCEPT_REJECT_TABLE };
export type { AcceptRejectValue };

export type InspectionLevel = 'I' | 'II' | 'III';

export interface AqlCalculationResult {
  codeLetter: string;
  sampleSize: number;
  acceptNumber: number;
  rejectNumber: number;
  effectiveCodeLetter: string; // May differ from codeLetter if arrow applies
  isValid: boolean;
  error?: string;
}

/**
 * Get the Sample Size Code Letter based on lot size
 * Currently only supports General Level II (default)
 */
export function getCodeLetter(
  lotSize: number,
  _level: InspectionLevel = 'II'
): string | null {
  if (lotSize < 2) {
    return null;
  }

  for (const range of LOT_SIZE_CODE_LETTERS) {
    if (lotSize >= range.min && lotSize <= range.max) {
      return range.codeLetter;
    }
  }

  // Should not reach here, but return null for safety
  return null;
}

/**
 * Get the sample size for a given code letter
 */
export function getSampleSize(codeLetter: string): number | null {
  return SAMPLE_SIZES[codeLetter] || null;
}

/**
 * Get Accept/Reject numbers for a given code letter and AQL level
 * Handles arrow navigation (uses next larger sample when arrow down applies)
 */
export function getAcceptReject(
  codeLetter: string,
  aql: string
): AqlCalculationResult {
  // Validate inputs
  if (!codeLetter || !SAMPLE_SIZES[codeLetter]) {
    return {
      codeLetter: codeLetter || '',
      sampleSize: 0,
      acceptNumber: 0,
      rejectNumber: 0,
      effectiveCodeLetter: '',
      isValid: false,
      error: 'Invalid code letter',
    };
  }

  // Normalize AQL value (handle both "1.0" and "1")
  const normalizedAql = normalizeAql(aql);
  if (!normalizedAql) {
    return {
      codeLetter,
      sampleSize: SAMPLE_SIZES[codeLetter],
      acceptNumber: 0,
      rejectNumber: 0,
      effectiveCodeLetter: codeLetter,
      isValid: false,
      error: 'Invalid AQL level',
    };
  }

  // Find accept/reject values, following arrows if needed
  let currentCodeLetter = codeLetter;
  let value: AcceptRejectValue | undefined;
  let iterations = 0;
  const maxIterations = 20; // Safety limit

  while (iterations < maxIterations) {
    const tableRow = AQL_ACCEPT_REJECT_TABLE[currentCodeLetter];
    if (!tableRow) {
      break;
    }

    value = tableRow[normalizedAql];
    if (!value) {
      break;
    }

    if (value === 'down') {
      // Arrow down: use next larger sample
      const nextLetter = getNextCodeLetter(currentCodeLetter);
      if (!nextLetter) {
        // Can't go further, return error
        return {
          codeLetter,
          sampleSize: SAMPLE_SIZES[codeLetter],
          acceptNumber: 0,
          rejectNumber: 0,
          effectiveCodeLetter: currentCodeLetter,
          isValid: false,
          error: 'Sample size too small for this AQL level',
        };
      }
      currentCodeLetter = nextLetter;
      iterations++;
    } else if (value === 'up') {
      // Arrow up is rarely used in normal inspection, but handle it
      // For now, just return the current level
      break;
    } else {
      // Found actual accept/reject values
      break;
    }
  }

  if (!value || value === 'down' || value === 'up') {
    return {
      codeLetter,
      sampleSize: SAMPLE_SIZES[codeLetter],
      acceptNumber: 0,
      rejectNumber: 0,
      effectiveCodeLetter: currentCodeLetter,
      isValid: false,
      error: 'Could not determine accept/reject values',
    };
  }

  return {
    codeLetter,
    sampleSize: SAMPLE_SIZES[currentCodeLetter],
    acceptNumber: value.accept,
    rejectNumber: value.reject,
    effectiveCodeLetter: currentCodeLetter,
    isValid: true,
  };
}

/**
 * Normalize AQL value to match table keys
 */
function normalizeAql(aql: string): string | null {
  const validAqls = ['0.65', '1.0', '1.5', '2.5', '4.0', '6.5'];

  // Direct match
  if (validAqls.includes(aql)) {
    return aql;
  }

  // Try parsing and matching
  const parsed = parseFloat(aql);
  if (isNaN(parsed)) {
    return null;
  }

  // Match to closest valid AQL
  if (parsed === 0.65) return '0.65';
  if (parsed === 1 || parsed === 1.0) return '1.0';
  if (parsed === 1.5) return '1.5';
  if (parsed === 2.5) return '2.5';
  if (parsed === 4 || parsed === 4.0) return '4.0';
  if (parsed === 6.5) return '6.5';

  return null;
}

/**
 * Calculate all AQL values from lot size and AQL level
 */
export function calculateAql(
  lotSize: number,
  aql: string,
  level: InspectionLevel = 'II'
): AqlCalculationResult {
  const codeLetter = getCodeLetter(lotSize, level);

  if (!codeLetter) {
    return {
      codeLetter: '',
      sampleSize: 0,
      acceptNumber: 0,
      rejectNumber: 0,
      effectiveCodeLetter: '',
      isValid: false,
      error: lotSize < 2 ? 'Lot size must be at least 2' : 'Invalid lot size',
    };
  }

  return getAcceptReject(codeLetter, aql);
}

/**
 * Determine PASS or FAIL based on rejected quantity and reject number
 */
export function determineResult(
  rejectedQty: number,
  rejectNumber: number
): 'PASS' | 'FAIL' {
  // PASS if rejected quantity is less than the reject number
  // FAIL if rejected quantity >= reject number
  return rejectedQty < rejectNumber ? 'PASS' : 'FAIL';
}

/**
 * Check if a given rejected quantity would pass inspection
 */
export function wouldPass(
  rejectedQty: number,
  acceptNumber: number,
  rejectNumber: number
): { result: 'PASS' | 'FAIL'; explanation: string } {
  if (rejectedQty <= acceptNumber) {
    return {
      result: 'PASS',
      explanation: `Rejected: ${rejectedQty} ≤ Accept: ${acceptNumber}`,
    };
  } else if (rejectedQty >= rejectNumber) {
    return {
      result: 'FAIL',
      explanation: `Rejected: ${rejectedQty} ≥ Reject: ${rejectNumber}`,
    };
  } else {
    // This shouldn't happen with standard Z1.4 tables where reject = accept + 1
    // But handle it gracefully
    return {
      result: 'FAIL',
      explanation: `Rejected: ${rejectedQty} (between accept ${acceptNumber} and reject ${rejectNumber})`,
    };
  }
}
