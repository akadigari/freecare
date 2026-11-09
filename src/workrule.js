// Maryland's new Medicaid work rule, as published on Maryland Health Connection's "Medicaid
// Check-In" page and read on the date below. These functions say which published test a month's
// numbers meet. They never say whether a person is exempt or in compliance; Maryland Health
// Connection decides that. Re-read the page before each build and update `verified`.

export const RULES = Object.freeze({
  earningsFloorCents: 58000, // "Earn at least $580 a month from a job"
  hoursFloor: 80, // "Complete 80 hours a month of any mix of these activities"
  minAge: 19,
  maxAge: 64,
  starts: '2027-01-01',
  verified: '2026-11-06',
  source: 'https://www.marylandhealthconnection.gov/checkin/',
  toolUrl: 'https://www.marylandhealthconnection.gov/checkin/',
  phone: '1-855-642-8572',
});

export const ACTIVITIES = Object.freeze(['work', 'school', 'training', 'volunteer']);

export const EXEMPTION_GROUPS = Object.freeze(['general', 'special', 'health', 'hardship', 'local']);

// Kinds of document people usually bring. Maryland has not published its own list.
export const PROOF_TYPES = Object.freeze([
  'idWithBirthdate', 'medicareCard', 'releasePapers', 'facilityLetter', 'fosterLetter', 'tribalId',
  'childBirthCertificate', 'disabilityLetter', 'dd214', 'doctorLetter', 'benefitsLetter',
  'hospitalDischarge', 'travelRecords', 'stateLetter',
]);

const exemption = (id, group, proof) => Object.freeze({ id, group, proof: Object.freeze(proof) });

// In the order Maryland lists them. The words live in strings.js under WORKRULE.
export const EXEMPTIONS = Object.freeze([
  exemption('under19', 'general', ['idWithBirthdate']),
  exemption('over64', 'general', ['idWithBirthdate']),
  exemption('medicare', 'general', ['medicareCard']),
  exemption('jailLast90', 'general', ['releasePapers']),
  exemption('fosterUnder26', 'special', ['fosterLetter', 'idWithBirthdate']),
  exemption('aian', 'special', ['tribalId']),
  exemption('childUnder14', 'special', ['childBirthCertificate']),
  exemption('caresDisabled', 'special', ['disabilityLetter']),
  exemption('veteranDisabled', 'special', ['dd214', 'disabilityLetter']),
  exemption('pregnantOrPostpartum', 'special', ['doctorLetter', 'childBirthCertificate']),
  exemption('tanfWorkRules', 'special', ['benefitsLetter']),
  exemption('snapWorkRules', 'special', ['benefitsLetter']),
  exemption('inJail', 'special', ['facilityLetter']),
  exemption('physicalDisability', 'health', ['doctorLetter', 'disabilityLetter']),
  exemption('mentalHealth', 'health', ['doctorLetter']),
  exemption('substanceUse', 'health', ['doctorLetter']),
  exemption('complexMedical', 'health', ['doctorLetter']),
  exemption('hospitalStay', 'hardship', ['hospitalDischarge']),
  exemption('medicalTravel', 'hardship', ['travelRecords']),
  exemption('localException', 'local', ['stateLetter']),
]);

// Anything that is not a finite number at or above zero counts as zero.
const num = (value) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0);

const pad = (n) => String(n).padStart(2, '0');

// Hours are kept to the hundredth, which is what time clocks print, so 0.1 + 64.1 + 15.8 is 80, not 79.999.
const round2 = (n) => Math.round(n * 100) / 100;

// "2027-01-09" reads as "2027-01". Anything that is not a real calendar date reads as nothing.
export function monthOf(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${pad(month)}`;
}

// The month before the one `todayIso` is in: the most recent full month.
export function previousMonth(todayIso) {
  const m = /^(\d{4})-(\d{2})/.exec(String(todayIso ?? ''));
  if (!m) return null;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 2, 1));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}

// One month's numbers against the three published tests. `jobs` is [{ employer, grossCents, hours }];
// `otherHours` is { school, training, volunteer } in hours. Earnings are gross, summed across jobs.
export function monthTest({ month, jobs = [], otherHours = {}, halfTimeSchool = false } = {}) {
  const grossCents = jobs.reduce((sum, job) => sum + num(job?.grossCents), 0);
  const jobHours = round2(jobs.reduce((sum, job) => sum + num(job?.hours), 0));
  const hoursTotal = round2(jobHours + num(otherHours.school) + num(otherHours.training) + num(otherHours.volunteer));
  const metAll = [];
  if (grossCents >= RULES.earningsFloorCents) metAll.push('earnings');
  if (halfTimeSchool === true) metAll.push('school');
  if (hoursTotal >= RULES.hoursFloor) metAll.push('hours');
  return Object.freeze({
    month,
    grossCents,
    jobHours,
    hoursTotal,
    met: metAll[0] ?? null,
    metAll: Object.freeze(metAll),
    shortfall: Object.freeze({
      cents: Math.max(0, RULES.earningsFloorCents - grossCents),
      hours: round2(Math.max(0, RULES.hoursFloor - hoursTotal)),
    }),
  });
}

// The exemptions for the given ids, in Maryland's order. Unknown ids are dropped.
export function exemptionsById(ids) {
  const wanted = new Set(Array.isArray(ids) ? ids : []);
  return EXEMPTIONS.filter((e) => wanted.has(e.id));
}

// The jobs whose pay date falls in a different month than the one being proved. Jobs with no
// pay date are left alone. Used to warn before a cover sheet contradicts its own dates.
export function jobsOutsideMonth(month, jobs) {
  if (!month) return [];
  return (Array.isArray(jobs) ? jobs : []).filter((job) => {
    const paid = job?.payDate ? monthOf(job.payDate) : null;
    return paid !== null && paid !== month;
  });
}
