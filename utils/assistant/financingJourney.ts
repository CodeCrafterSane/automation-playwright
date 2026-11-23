import { test, expect, type Page, type TestInfo } from '@playwright/test';
import AssistantPage from '../../pages/assistant/AssistantPage';
import type { FinancingField } from '../financingQuestions';
import { validFinancingQuestions } from './financingQuestions';
import { uniqueTestEmail } from '../testIdentity';
import { assistantSubmissionStatus } from './submission';
import { financingValues, searchPrompt, type FinancingScenario, type SearchScenario } from '../../common/testData/assistant/validScenarios';

type Field = FinancingField | 'serviceStatus' | 'propertyAddress';
const componentFields: Record<string, Field> = {
  property_type: 'propertyType', occupancy: 'occupancy', home_found: 'foundHome',
  purchase_timing: 'timeline', refinance_timing: 'timeline', employment_status: 'employment',
  credit_score: 'credit', military_service: 'militaryStatus', down_payment: 'downPayment',
  refinance_goal: 'goal', refinance_purpose: 'goal', rate_type: 'rateType',
  interest_rate_type: 'rateType', current_loan_type: 'existingLoanType', loan_type: 'existingLoanType',
  late_payments: 'latePayments', property_address: 'propertyAddress',
};
const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

export async function runValidFinancingJourney(page: Page, assistant: AssistantPage, discovery: AssistantPage, info: TestInfo, scenario: FinancingScenario) {
  const baseEmail = process.env.TEST_CONTACT_EMAIL;
  expect(baseEmail, 'Configure the staging financing test email').toBeTruthy();
  const email = await uniqueTestEmail(baseEmail!);
  const values: Record<Field, string> = { ...financingValues(scenario, email), serviceStatus: 'Veteran', propertyAddress: '' };
  const provided = new Set<Field>();
  let confirmed = false;
  await info.attach('valid-scenario', { body: JSON.stringify({ ...scenario, email }, null, 2), contentType: 'application/json' });
  await test.step('Open Assistant', () => assistant.open());
  await test.step('Start pre-approval and verify both loan purposes', async () => {
    await assistant.chooseStarter('preApproval');
    await expect(page.locator('button:enabled').filter({ hasText: /^Purchase$/ })).toBeVisible();
    await expect(page.locator('button:enabled').filter({ hasText: /^Refinance$/ })).toBeVisible();
  });
  let response = await test.step(`Select ${scenario.flow}`, () => assistant.chooseOption(scenario.flow === 'purchase' ? 'Purchase' : 'Refinance'));
  for (let turn = 0; turn < 40; turn++) {
    console.log(`[Assistant ${scenario.id} turn ${turn + 1}]`, response);
    await info.attach(`turn-${turn + 1}-reply`, { body: response, contentType: 'text/plain' });
    await info.attach(`turn-${turn + 1}-screenshot`, { body: await page.screenshot(), contentType: 'image/png' });
    await info.attach(`turn-${turn + 1}-components`, { body: JSON.stringify(assistant.latestAssistant?.components || []), contentType: 'application/json' });
    if (provided.has('state')) {
      expect.soft(response, 'Assistant must not contradict the location it accepted while continuing intake').not.toMatch(/(?:can.t|cannot|unable to).{0,40}(?:continue|proceed).{0,100}(?:pre.approval|location)|location.{0,100}(?:isn.t|not) recognized as a licensed/i);
    }
    const status = assistantSubmissionStatus(response);
    expect(status, `Staging rejected the ${scenario.flow} submission: ${response}`).not.toBe('failed');
    if (status === 'submitted') {
      expect(confirmed, 'A reviewed request must be confirmed before submission').toBe(true);
      await info.attach('completed-financing-request', { body: JSON.stringify({ scenario, response, conversation: assistant.conversation }), contentType: 'application/json' });
      return;
    }
    const options = await assistant.visibleOptions();
    const component = assistant.latestAssistant?.components.find(item => item.component_name === 'suggestions');
    const componentField = component?.component_props.field;
    const question = response.split(/\n\s*\n/).at(-1)!;
    let fields: (Field | 'flow' | 'confirmed')[] = componentField && componentFields[componentField]
      ? [componentFields[componentField]!]
      : [...validFinancingQuestions(response, scenario.flow, options)];
    if (/\b(?:street|property) address\b/i.test(question)) fields = ['propertyAddress'];
    if (provided.has('militaryStatus') && options.some(option => /^veteran$/i.test(option.trim()))) fields = ['serviceStatus'];
    if (fields.includes('confirmed')) {
      if (scenario.flow === 'purchase' && !provided.has('downPayment')) {
        expect.soft(false, 'Purchase intake skipped the down-payment question').toBe(true);
        provided.add('downPayment');
        response = await test.step('Correct the missing down payment before confirmation', () =>
          assistant.ask(`My down payment is ${scenario.downPaymentPercent}%, which is $${scenario.price * scenario.downPaymentPercent / 100}. Please update only the down payment and show the corrected review before submitting.`),
        );
        continue;
      }
      await test.step('Verify the review matches this scenario', async () => {
        const required: Field[] = scenario.flow === 'purchase'
          ? ['propertyType', 'occupancy', 'state', 'foundHome', 'timeline', 'budget', 'downPayment', 'employment', 'credit', 'militaryStatus', 'name', 'email', 'phone']
          : ['state', 'goal', 'homeValue', 'credit', 'loanBalance', 'interestRate', 'rateType', 'existingLoanType', 'name', 'email', 'phone'];
        for (const field of required) expect(provided.has(field), `Intake must collect ${field}`).toBe(true);
        const review = new Map(response.split('\n').flatMap(line => {
          const match = line.match(/^\s*[-*]?\s*([^:]+):\s*(.+)$/);
          return match ? [[normalized(match[1]!), match[2]!] as const] : [];
        }));
        const read = (...labels: string[]) => labels.map(label => review.get(normalized(label))).find(Boolean) || '';
        const amount = (value: string) => Number(value.replace(/[^\d.]/g, ''));
        expect(read('Loan purpose', 'Purpose', 'Mortgage service')).toMatch(new RegExp(scenario.flow, 'i'));
        const location = read('Location', 'Property location', 'State');
        expect(location, 'Review must retain the scenario location').toMatch(new RegExp(`${scenario.city}|${scenario.zip}`, 'i'));
        expect(response).toContain(email);
        expect(response).toContain(scenario.name);
        expect(amount(read('Property value', 'Home value', 'Estimated property value', 'Estimated home value', 'Purchase price'))).toBe(scenario.price);
        expect(amount(read('Credit score', 'Credit'))).toBe(scenario.credit);
        const phone = read('Phone number', 'Phone', 'Mobile number').replace(/\D/g, '');
        expect(phone.slice(-10), 'Review must retain the contact phone').toBe(scenario.phone.replace(/\D/g, '').slice(-10));
        if (scenario.flow === 'purchase') {
          const downPayment = read('Down payment');
          expect(amount(downPayment)).toBe(downPayment.includes('%') ? scenario.downPaymentPercent : scenario.price * scenario.downPaymentPercent / 100);
          expect(normalized(read('Property type'))).toBe(normalized(scenario.propertyType));
          expect(normalized(read('Property use', 'Occupancy'))).toBe(normalized(scenario.occupancy));
          expect(normalized(read('Employment', 'Employment status'))).toBe(normalized(scenario.employment));
          expect(normalized(read('Home found'))).toBe(normalized(scenario.foundHome));
          expect(normalized(read('Military service', 'Military status'))).toBe(normalized(scenario.military));
        } else {
          expect(amount(read('Loan balance', 'Mortgage balance', 'Current loan balance', 'Remaining loan balance'))).toBe(scenario.loanBalance);
          expect(amount(read('Interest rate', 'Current interest rate'))).toBe(scenario.interestRate);
        }
      });
      confirmed = true;
      response = await test.step('Confirm the reviewed details and submit', () => assistant.ask('Yes, those details are correct. Please submit my request.'));
      continue;
    }
    expect(fields.length, `Automation coverage gap: unrecognized ${scenario.flow} question: ${response}; field=${componentField}`).toBeGreaterThan(0);
    expect(fields, 'The selected purpose must be retained').not.toContain('flow');
    const requested = fields as Field[];
    for (const field of requested) expect(provided.has(field), `Assistant repeated ${field} after a valid answer: ${response}`).toBe(false);
    if (requested.includes('propertyAddress') && !values.propertyAddress) {
      values.propertyAddress = await test.step('Discover a real property for the found-home branch', async () => {
        const target: SearchScenario = { id: scenario.id, city: scenario.city, state: scenario.state, stateCode: scenario.stateCode, zip: scenario.zip, propertyType: scenario.propertyType, beds: 2, baths: 1, maxPrice: scenario.price };
        await discovery.open();
        await discovery.chooseStarter('explore');
        await discovery.ask(searchPrompt(target));
        const listing = discovery.listings(scenario.city, scenario.stateCode)[0];
        expect(listing, 'Expected a live property for the valid found-home branch').toBeTruthy();
        return listing!.address;
      });
    }
    const answer = requested.map(field => field === 'state' && /zip|postal/i.test(question)
      ? scenario.locationMode === 'zip' || !/\bcity\b|\bstate\b/i.test(question) ? scenario.zip : `${scenario.city}, ${scenario.state}, ZIP ${scenario.zip}`
      : values[field]).join(' ');
    const offered = component?.component_props.options || [];
    const chosen = requested.length === 1 ? offered.find(option => normalized(option) === normalized(answer)) : undefined;
    response = await test.step(`Provide ${requested.join(', ')}: ${chosen || answer}`, () => chosen ? assistant.chooseOption(chosen) : assistant.ask(answer));
    requested.forEach(field => provided.add(field));
  }
  throw new Error(`${scenario.id} did not reach a terminal result after 40 turns`);
}
