import { test, expect } from '@playwright/test';
import { financingRequestedFields } from '../../utils/financingQuestions';

test.describe('Assistant financing question regressions (offline)', () => {
  test('recognizes the new loan-purpose question', () => {
    expect(financingRequestedFields('Please select a loan purpose.', 'purchase')).toEqual(['flow']);
  });

  test('uses FHA and VA choices to identify the implicit refinance question', () => {
    expect(financingRequestedFields('Thanks — got it. Do you currently have:', 'refinance', [
      'FHA Loan', 'VA Loan', 'None of the above',
    ])).toEqual(['existingLoanType']);
  });

  test('keeps employment separate from income', () => {
    expect(financingRequestedFields('Thanks — got that. Are you currently employed?', 'purchase')).toEqual(['employment']);
    expect(financingRequestedFields('What is your annual income?', 'purchase')).toEqual(['income']);
  });

  test('recognizes the purchase discovery and usage questions', () => {
    expect(financingRequestedFields('Have you already found your new home?', 'purchase')).toEqual(['foundHome']);
    expect(financingRequestedFields('What is this loan for?', 'purchase')).toEqual(['occupancy']);
  });

  test('maps property value to the selected flow', () => {
    const prompt = "What's the property value? Let us know the exact price or estimate a range.";
    expect(financingRequestedFields(prompt, 'purchase')).toEqual(['budget']);
    expect(financingRequestedFields(prompt, 'refinance')).toEqual(['homeValue']);
  });

  test('recognizes the remaining first mortgage and rate questions', () => {
    expect(financingRequestedFields('What is the remaining 1st mortgage balance?', 'refinance')).toEqual(['loanBalance']);
    expect(financingRequestedFields('What is your 1st mortgage interest rate?', 'refinance')).toEqual(['interestRate']);
    expect(financingRequestedFields('What kind of rate do you have?', 'refinance')).toEqual(['rateType']);
  });

  test('ignores acknowledged values when finding the next question', () => {
    expect(financingRequestedFields('Thanks, your credit score is 740. What is your full name?', 'purchase')).toEqual(['name']);
  });

  test('recognizes location corrections and confirmation', () => {
    expect(financingRequestedFields('Please enter a valid ZIP code.', 'refinance')).toEqual(['state']);
    expect(financingRequestedFields('Here is a quick review. Loan purpose: Purchase. Do these details look correct?', 'purchase')).toEqual(['confirmed']);
  });

  test('preserves the required field before generic formatting guidance', () => {
    expect(financingRequestedFields(
      'Sorry — I still need your 1st mortgage interest rate. Please enter it in a format like 6.500% or 7.000%.',
      'refinance',
    )).toEqual(['interestRate']);
  });

  test('recognizes mortgage payment history without confusing monthly payment amounts', () => {
    expect(financingRequestedFields(
      'Thanks. Any late mortgage payments in the last 12 months?', 'refinance',
    )).toEqual(['latePayments']);
    expect(financingRequestedFields(
      'Please select the number of late mortgage payments in the last 12 months.', 'refinance',
    )).toEqual(['latePayments']);
    expect(financingRequestedFields(
      'What is your monthly payment?', 'refinance',
    )).toEqual(['monthlyPayment']);
  });
});
