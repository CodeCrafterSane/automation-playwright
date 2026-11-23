import { test, expect } from '../../fixtures/assistant.fixture';
import { uniqueTestEmail } from '../../utils/testIdentity';
import { assistantSubmissionStatus } from '../../utils/assistant/submission';
import { tourContactFields } from '../../utils/assistant/tourQuestions';
import { tourScenarios, searchPrompt } from '../../common/testData/assistant/validScenarios';

test.describe('Assistant tour booking @P1 @assistant @assistantTour @valid', () => {
  test.setTimeout(600_000);
  for (const scenario of tourScenarios) {
    test(`${scenario.id}: collects valid details and completes the tour request`, async ({ page, assistant, discoveryAssistant }, testInfo) => {
      await testInfo.attach('valid-scenario', { body: JSON.stringify(scenario, null, 2), contentType: 'application/json' });
      const listing = await test.step('Discover a live property for this scenario', async () => {
        await discoveryAssistant.open();
        await discoveryAssistant.chooseStarter('explore');
        await discoveryAssistant.ask(searchPrompt(scenario.search));
        const property = discoveryAssistant.listings(scenario.search.city, scenario.search.stateCode)[0];
        expect(property, 'Expected an active listing for this valid tour scenario').toBeTruthy();
        return property!;
      });
      const contact = await test.step('Allocate a unique staging tour contact', async () => {
        const baseEmail = process.env.TEST_CONTACT_EMAIL;
        expect(baseEmail, 'Configure the staging tour test email').toBeTruthy();
        return { name: scenario.name, phone: scenario.phone, email: await uniqueTestEmail(baseEmail!) };
      });
      await testInfo.attach('tour-property-and-contact', { body: JSON.stringify({ listing, contact }), contentType: 'application/json' });
      await test.step('Open Assistant', () => assistant.open());
      await test.step('Start Book a tour', () => assistant.chooseStarter('tour'));
      const reference = scenario.reference === 'link' ? listing.url : listing.address;
      const upfront = scenario.contactMode === 'upfront' ? ` My name is ${contact.name}. My email is ${contact.email}. My phone number is ${contact.phone}.` : '';
      let response = await test.step(`Provide the property ${scenario.reference}${upfront ? ' and all contact details' : ''}`, () => assistant.ask(`I want to tour ${reference}.${upfront}`));
      let selectedSlot: string | undefined;
      let emailProvided = scenario.contactMode === 'upfront';
      let confirmed = false;
      let requestedAppointments = false;
      const supplied = new Set<string>();
      for (let turn = 0; turn < 18; turn++) {
        console.log(`[Assistant ${scenario.id} turn ${turn + 1}]`, response);
        await testInfo.attach(`tour-turn-${turn + 1}-reply`, { body: response, contentType: 'text/plain' });
        await testInfo.attach(`tour-turn-${turn + 1}-screenshot`, { body: await page.screenshot(), contentType: 'image/png' });
        const submission = page.getByRole('dialog', { name: 'Request a tour', exact: true });
        if (/complete the tour submission|complete tour submission/i.test(response)) {
          await test.step('Complete the tour submission dialog', async () => {
            expect(emailProvided, 'Provide the contact email before submission').toBe(true);
            expect(selectedSlot, 'Choose an offered appointment before submission').toBeTruthy();
            if (!(await submission.isVisible())) await page.getByRole('button', { name: 'Complete tour submission', exact: true }).click();
            await expect(submission).toBeVisible();
            await testInfo.attach('tour-submission-dialog', { body: await submission.ariaSnapshot(), contentType: 'text/plain' });
            await submission.getByRole('button', { name: 'Continue', exact: true }).click();
            await expect(submission.getByText('Network Error', { exact: true }), 'the listing provider tour submission must succeed without a network error').toBeHidden();
          });
          await test.step('Verify the final tour submission confirmation', async () => {
            await expect(page.getByText(/tour (?:request )?(?:has been |was )?(?:submitted|scheduled|booked)|tour request received/i).filter({ visible: true }).first()).toBeVisible({ timeout: 60_000 });
          });
          return;
        }
        const status = assistantSubmissionStatus(response);
        expect(status, `Staging rejected the tour submission: ${response}`).not.toBe('failed');
        if (status === 'submitted') {
          await test.step('Verify the completed tour request', async () => {
            expect(emailProvided).toBe(true);
            expect(selectedSlot).toBeTruthy();
            expect(confirmed, 'Confirm the tour request before submission').toBe(true);
            await testInfo.attach('completed-tour-request', { body: JSON.stringify({ listing, selectedSlot, response, conversation: assistant.conversation }), contentType: 'application/json' });
          });
          return;
        }
        const offeredSlots = assistant.latestAssistant?.components.find(component => component.component_name === 'suggestions')?.component_props.options || [];
        const slots = [...new Set([...offeredSlots, ...await assistant.visibleOptions()])].filter(option => /\d{4}-\d{2}-\d{2} at \d{1,2}:\d{2}/.test(option));
        if (slots.length) {
          expect(selectedSlot, 'Assistant must retain the selected appointment').toBeUndefined();
          selectedSlot = scenario.slot === 'last' ? slots.at(-1)! : scenario.slot === 'afternoon'
            ? slots.find(slot => /at \d{1,2}:\d{2} PM/i.test(slot)) || slots.at(-1)! : slots[0]!;
          const slot = selectedSlot;
          await testInfo.attach('selected-appointment', { body: JSON.stringify({ offered: slots, selected: slot }), contentType: 'application/json' });
          response = await test.step(`Select an available appointment: ${slot}`, () => assistant.chooseOption(slot));
          continue;
        }
        if (/\bdate\b.{0,25}\btime\b|available (?:tour )?(?:times?|appointments?)/i.test(response.split(/\n\s*\n/).at(-1)!)) {
          expect(requestedAppointments, 'Assistant must offer appointments after being asked for available times').toBe(false);
          requestedAppointments = true;
          response = await test.step('Request actual available appointments after listing details', () => assistant.ask('Please show the available date and time options for this property so I can select one.'));
          continue;
        }
        if (/please confirm|does (?:this|that|everything) look (?:correct|right)|confirm (?:the |your )?(?:tour|booking|details)|shall i (?:submit|book|schedule)/i.test(response)) {
          confirmed = true;
          response = await test.step('Confirm the collected tour details', () => assistant.ask('Yes, those details are correct. Please submit my tour request.'));
          continue;
        }
        const fields = tourContactFields(response);
        expect(fields.length, `Automation coverage gap: unrecognized tour question: ${response}`).toBeGreaterThan(0);
        for (const field of fields) expect(supplied.has(field), `Assistant repeated ${field} after a valid answer`).toBe(false);
        const reply = fields.map(field => field === 'name' ? `My name is ${contact.name}.` : field === 'email' ? `My email is ${contact.email}.` : `My phone number is ${contact.phone}.`).join(' ');
        response = await test.step(`Provide valid ${fields.join(', ')}`, () => assistant.ask(reply));
        fields.forEach(field => supplied.add(field));
        if (fields.includes('email')) emailProvided = true;
      }
      throw new Error(`${scenario.id} did not reach a terminal result after 18 turns`);
    });
  }
});
