import { test, expect } from '@playwright/test';
import { validFinancingQuestions } from '../../utils/assistant/financingQuestions';

for (const [reply, flow, expected] of [
  ['Thanks. I still need the 5-digit ZIP code for your existing mortgage. What is it?', 'refinance', ['state']],
  ['About how much do you expect the property to cost? An exact amount or estimated range is fine.', 'purchase', ['budget']],
  ['I still need your current interest rate. What is it?', 'refinance', ['interestRate']],
  ['What is your full name?', 'purchase', ['name']],
  ["I cannot continue for this location.\n\nWhat's the best phone number to reach you?", 'purchase', ['phone']],
  ["Here's what I've collected so far:\nLoan purpose: Purchase\nDo these details look correct?", 'purchase', ['confirmed']],
] as const) {
  test(`recognizes valid ${flow} question: ${reply}`, () => expect(validFinancingQuestions(reply, flow)).toEqual(expected));
}
