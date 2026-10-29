// What each hospital's own financial assistance policy gives, read from the state's copies
// (the links in hospitals.js) on the date below. The state rule in rules.js is the floor;
// a hospital can only add to it, so the page shows whichever is better at your income.
//
// Bands are [up to this percent of the poverty line, percent off]. standardBands need nothing
// else; hardshipBands need medical bills over a quarter of income. partialUpTo means the
// policy promises some help to that percent without saying how much. catches are keys into
// RESULT.catches in strings.js: asset tests and other things the hospital adds.
// Four of the state's copies are scanned images; those were read with OCR and checked by eye.

export const POLICIES_READ_ON = '2026-10-28';

const band = ([maxPercent, discount]) => Object.freeze({ maxPercent, discount });
const policy = ({ freeUpTo, standardBands = [], hardshipBands = [], partialUpTo = null, policyDate = null, catches = [] }) => Object.freeze({
  known: true,
  freeUpTo,
  standardBands: Object.freeze(standardBands.map(band)),
  hardshipBands: Object.freeze(hardshipBands.map(band)),
  partialUpTo,
  policyDate,
  catches: Object.freeze([...catches]),
});

// Exactly the state minimum: free to 200%, 75% and 60% to 300%, hardship bands to 500%.
const STATE_MINIMUM = {
  freeUpTo: 200,
  standardBands: [[250, 75], [300, 60]],
  hardshipBands: [[350, 50], [400, 45], [450, 40], [500, 35]],
};

export const POLICIES = Object.freeze({
  adventist: policy({ freeUpTo: 200, partialUpTo: 600, policyDate: '2025-04-30' }),
  'ascension-st-agnes': policy({ freeUpTo: 250, partialUpTo: 500, policyDate: '2025-12', catches: ['assetsOverFpl250'] }),
  calverthealth: policy({ freeUpTo: 200, standardBands: [[250, 80], [300, 60], [350, 40], [400, 20], [500, 10]], policyDate: '2019-07-01', catches: ['old2019'] }),
  'union-hospital': policy({ freeUpTo: 400, hardshipBands: [[450, 40], [500, 35]], policyDate: '2026-02-01' }),
  'frederick-health': policy({ freeUpTo: 200, partialUpTo: 500, policyDate: '2026-03' }),
  'garrett-regional': policy({ freeUpTo: 200, standardBands: [[300, 75], [400, 50], [500, 25]], policyDate: '2025-11-10', catches: ['assetExclusion10k'] }),
  gbmc: policy({ freeUpTo: 300, standardBands: [[500, 50]], policyDate: '2025-10', catches: ['assetTest'] }),
  'holy-cross': policy({ freeUpTo: 200, standardBands: [[250, 75], [300, 60], [350, 50], [400, 45], [450, 40], [500, 35]], policyDate: '2025-10-02', catches: ['hardship20'] }),
  'johns-hopkins': policy({ freeUpTo: 200, standardBands: [[250, 75], [300, 60], [400, 35]], hardshipBands: [[350, 50], [400, 45], [450, 40], [500, 35]], policyDate: '2026', catches: ['assets100k'] }),
  lifebridge: policy({ freeUpTo: 300, hardshipBands: [[350, 50], [400, 45], [450, 40], [500, 35]], policyDate: '2026-01-22', catches: ['assetTest'] }),
  luminis: policy({ ...STATE_MINIMUM, policyDate: '2024-07' }),
  medstar: policy({ freeUpTo: 200, standardBands: [[250, 75], [300, 60], [350, 50], [400, 45]], hardshipBands: [[450, 40], [500, 35]], policyDate: '2026-03-16' }),
  mercy: policy({ ...STATE_MINIMUM, policyDate: '2025-10', catches: ['assets100k'] }),
  meritus: policy({ freeUpTo: 200, standardBands: [[300, 75], [400, 50], [500, 40]], policyDate: '2026-01' }),
  'mt-washington-pediatric': policy({ ...STATE_MINIMUM, policyDate: '2026-05' }),
  'sheppard-pratt': policy({ ...STATE_MINIMUM }),
  tidalhealth: policy({ ...STATE_MINIMUM, policyDate: '2025-01' }),
  umms: policy({ ...STATE_MINIMUM, policyDate: '2026-05' }),
  // The state's copy for UPMC Western Maryland is its billing and collection policy, with no income rules.
  'upmc-western-maryland': Object.freeze({ known: false }),
});

function bestBand(bands, percent) {
  const hit = bands.find((b) => percent <= b.maxPercent);
  return hit ? hit.discount : 0;
}

// Percent off under the hospital's own policy: 100 for free care, 0 for nothing,
// null when the policy promises help without a number, undefined when the policy was not read.
export function hospitalDiscount(hospitalId, percent, hardship) {
  const p = POLICIES[hospitalId];
  if (!p || p.known === false) return undefined;
  if (percent <= p.freeUpTo) return 100;
  const discount = Math.max(bestBand(p.standardBands, percent), hardship ? bestBand(p.hardshipBands, percent) : 0);
  if (discount > 0) return discount;
  if (p.partialUpTo !== null && percent <= p.partialUpTo) return null;
  return 0;
}

// The extra things a hospital looks at, as keys into the strings file.
export function catchesFor(hospitalId) {
  const p = POLICIES[hospitalId];
  return p && p.known !== false ? p.catches : Object.freeze([]);
}

// The state result against the hospital's own policy. Whichever gives more wins.
export function compareWithState(hospitalId, { discount, percentOfPovertyLine, hardship }) {
  if (!hospitalId) return null;
  const p = POLICIES[hospitalId];
  if (!p || p.known === false) return Object.freeze({ kind: 'unknown' });
  const own = hospitalDiscount(hospitalId, percentOfPovertyLine, hardship);
  if (own === null) {
    return discount > 0
      ? Object.freeze({ kind: 'same', discount, policyDate: p.policyDate })
      : Object.freeze({ kind: 'partial', upTo: p.partialUpTo, policyDate: p.policyDate });
  }
  if (own > discount) return Object.freeze({ kind: 'better', discount: own, policyDate: p.policyDate });
  return Object.freeze({ kind: 'same', discount, policyDate: p.policyDate });
}
