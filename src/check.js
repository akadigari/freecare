import { parseForm } from './form.js';
import { checkEligibility } from './rules.js';
import { describe } from './present.js';

export const FAILED_MESSAGE = 'Something went wrong with those answers. Check them and try again.';

// Everything the page does after reading the form, kept free of the DOM so it can be tested.
// `deps` lets tests swap in a rule that throws.
export function runCheck(fields, todayIso, deps = {}) {
  const check = deps.checkEligibility ?? checkEligibility;
  const explain = deps.describe ?? describe;
  const parsed = parseForm(fields, todayIso);
  if (!parsed.ok) return Object.freeze({ status: 'invalid', errors: parsed.errors });
  try {
    const result = check(parsed.input, todayIso);
    return Object.freeze({ status: 'ok', result, view: explain(result) });
  } catch (error) {
    return Object.freeze({
      status: 'failed',
      message: FAILED_MESSAGE,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}
