// Turns what someone gets paid into a yearly figure for the income box.
// Plain arithmetic: 52 weeks, 26 two-week pay periods, 12 months.

export const PAY_PERIODS = Object.freeze(['hour', 'week', 'twoWeeks', 'month', 'year']);

const WEEKS_IN_A_YEAR = 52;
const HOURS_IN_A_WEEK = 168;
const PER_YEAR = Object.freeze({ week: 52, twoWeeks: 26, month: 12, year: 1 });

// "$1,300.50" reads as 1300.5. Anything else, including a minus sign, reads as nothing.
function toNumber(text) {
  const cleaned = String(text ?? '').replace(/[$,\s]/g, '');
  if (cleaned === '' || !/^\d*\.?\d+$/.test(cleaned)) return null;
  return Number(cleaned);
}

// Whole dollars a year, or null when the pieces don't add up.
export function yearlyIncome({ amount, period, hoursPerWeek } = {}) {
  const pay = toNumber(amount);
  if (pay === null) return null;
  if (period === 'hour') {
    const hours = toNumber(hoursPerWeek);
    if (hours === null || hours <= 0 || hours > HOURS_IN_A_WEEK) return null;
    return Math.round(pay * hours * WEEKS_IN_A_YEAR);
  }
  if (!Object.hasOwn(PER_YEAR, period)) return null;
  return Math.round(pay * PER_YEAR[period]);
}
