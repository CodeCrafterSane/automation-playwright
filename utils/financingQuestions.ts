export type FinancingFlow = 'purchase' | 'refinance';
export type FinancingField =
  | 'goal'
  | 'timeline'
  | 'propertyType'
  | 'foundHome'
  | 'occupancy'
  | 'state'
  | 'monthlyPayment'
  | 'budget'
  | 'downPayment'
  | 'credit'
  | 'militaryStatus'
  | 'income'
  | 'employment'
  | 'homeValue'
  | 'loanBalance'
  | 'interestRate'
  | 'rateType'
  | 'existingLoanType'
  | 'latePayments'
  | 'cashOut'
  | 'name'
  | 'email'
  | 'phone';
type Field = FinancingField;
type FinancingRequest = Field | 'flow' | 'confirmed';
type Attempt = { valid: string; invalid: string };

// Ignore acknowledgements and summaries so saved values are not mistaken for new questions.
function promptText(response: string): string {
  const segments = response.toLowerCase().split(/(?<=[.!?])\s+|\s+[\u2013\u2014]\s+|;\s*/);
  const requests = segments.filter(segment => /\?|\b(?:what|which|where|when|how|please|share|provide|tell me|choose|select|do you|are you|(?:still )?need your)\b/.test(segment));
  return (requests.length ? requests : segments).join(' ');
}

export function financingLocationAnswer(
  response: string,
  location: Attempt & { zip: Attempt },
  invalid = false,
) {
  const answer = invalid ? 'invalid' : 'valid';
  const prompt = promptText(response);
  if (!/\b(?:zip|postal)\b/.test(prompt)) return location[answer];
  // An optional ZIP mention must not discard the city/state needed for recovery.
  if (/\b(?:city|state|location)\b/.test(prompt)) {
    return `${location[answer]} ZIP code ${location.zip[answer]}.`;
  }
  return location.zip[answer];
}

export function financingRequestedFields(response: string, flow: FinancingFlow, options: readonly string[] = []): FinancingRequest[] {
  const text = promptText(response);
  if (/details look correct|does this look correct|is this correct|quick review of what i have|here.s (?:what|a .*review)/i.test(response)) return ['confirmed'];
  if (/buy(?:ing)? (?:a )?(?:new )?home.*refinanc|refinanc.*buy(?:ing)? (?:a )?(?:new )?home|what brings you here today|select a loan purpose|purchase or (?:a )?refinance/.test(text)) return ['flow'];
  if (options.some(option => /fha loan/i.test(option)) && options.some(option => /va loan/i.test(option))) return ['existingLoanType'];
  if (/current.{0,25}(?:loan type|loan program)|existing loan type|fha loan.*va loan/.test(text)) return ['existingLoanType'];
  const fields: FinancingRequest[] = [];
  const add = (field: Field, pattern: RegExp) => {
    if (pattern.test(text) && !fields.includes(field)) fields.push(field);
  };
  if (flow === 'refinance') {
    add('goal', /(?:primary|main|refinanc\w*) goal|goal (?:with|for)|(?:why|reason).*refinanc|what.*(?:accomplish|achieve)|by refinancing.*would like/);
    add('homeValue', /(?:property|home|house).{0,30}(?:value|worth)|(?:value|worth).{0,30}(?:property|home|house)/);
    add('loanBalance', /(?:mortgage|loan|remaining|outstanding|current).{0,30}balance|how much.{0,40}(?:owe|remaining)|balance.{0,30}(?:mortgage|loan)/);
    add('interestRate', /(?:current|existing|mortgage|interest).{0,25}rate|rate.{0,25}(?:current|mortgage|interest)/);
    add('rateType', /what kind of rate|rate type|fixed.{0,30}(?:adjustable|arm)|(?:fixed|adjustable).{0,20}rate/);
    add('cashOut', /(?:how much|amount).{0,30}cash|cash.?out amount/);
    add('latePayments', /late.{0,30}(?:mortgage )?payments?|(?:mortgage )?payments?.{0,30}late/);
  }
  add('timeline', /\b(?:timeframe|timeline|when|how soon)\b|within 30 days|in 2-3 months/);
  add('propertyType', /(?:kind|type) of (?:home|property)|(?:home|property) type|single.family.*(?:condo|townhouse)/);
  add('foundHome', /(?:already|have you).{0,25}found.{0,25}(?:home|property)|found your new home/);
  add('occupancy', /what is this loan for|\boccupancy\b|primary residence.*(?:rental|second home)|(?:how|what).{0,30}(?:use|using).{0,30}(?:home|property)|how.{0,30}(?:property|home).{0,30}(?:used|use)/);
  add('state', /\b(?:city|state|zip|postal|location|licensed market)\b|where.{0,60}(?:buy|home|property|located|live)/);
  add('monthlyPayment', /\bmonthly\b|per month|pay each month|payment range/);
  add('downPayment', /down payment|put down|planning to put|deposit/);
  add('credit', /\bcredit\b|credit score/);
  add('militaryStatus', /va loan|va benefits|loan benefits|veteran|military|active (?:duty|service)|service member/);
  add('employment', /are you.{0,20}employed|employment status|do you.{0,20}(?:job|employed)/);
  add('income', /\b(?:income|salary)\b/);
  add('budget', /purchase (?:price|budget)|\bbudget\b|price range/);
  if (flow === 'purchase') add('budget', /(?:property|home|house).{0,30}(?:value|worth)|(?:value|worth).{0,30}(?:property|home|house)/);
  add('name', /\b(?:name|full name)\b/);
  add('email', /\b(?:email|e-mail)\b/);
  add('phone', /\b(?:phone|mobile)\b/);
  return fields;
}

