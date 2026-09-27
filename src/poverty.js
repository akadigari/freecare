// 2026 HHS poverty guidelines for the 48 contiguous states and DC.
// Published in the Federal Register on January 15, 2026. Update every January.
export const POVERTY_GUIDELINES = Object.freeze({
  year: 2026,
  firstPerson: 15960,
  eachExtraPerson: 5680,
  published: '2026-01-15',
  region: '48 contiguous states and DC',
  sourceUrl: 'https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines',
});

export const MIN_HOUSEHOLD = 1;
export const MAX_HOUSEHOLD = 20;

export function povertyLine(householdSize) {
  const isValid = Number.isInteger(householdSize)
    && householdSize >= MIN_HOUSEHOLD
    && householdSize <= MAX_HOUSEHOLD;
  if (!isValid) {
    throw new RangeError(`Household size must be a whole number from ${MIN_HOUSEHOLD} to ${MAX_HOUSEHOLD}.`);
  }
  return POVERTY_GUIDELINES.firstPerson + POVERTY_GUIDELINES.eachExtraPerson * (householdSize - 1);
}

export function percentOfPovertyLine(income, householdSize) {
  if (typeof income !== 'number' || !Number.isFinite(income) || income < 0) {
    throw new RangeError('Income must be a number that is 0 or more.');
  }
  return (income / povertyLine(householdSize)) * 100;
}
