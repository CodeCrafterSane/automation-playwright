import { test, expect } from '@playwright/test';
import { tourContactFields } from '../../utils/assistant/tourQuestions';

for (const [response, expected] of [
  ['What’s your first and last name for the tour request?', ['name']],
  ['What email address should I use?', ['email']],
  ['What’s the phone number to include with your tour request?', ['phone']],
  ['Please provide your name, email, and phone number.', ['name', 'email', 'phone']],
  ['Thanks, I saved your name and email. What is your phone number?', ['phone']],
  ['Which date and time would you prefer?', []],
] as const) {
  test(`identifies tour contact fields: ${response}`, () => expect(tourContactFields(response)).toEqual(expected));
}
