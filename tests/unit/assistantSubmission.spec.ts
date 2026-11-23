import { test, expect } from '@playwright/test';
import { assistantSubmissionStatus } from '../../utils/assistant/submission';

for (const [reply, status] of [
  ['Your information has been submitted. A loan officer will be contacting you.', 'submitted'],
  ['Your tour request has been submitted successfully.', 'submitted'],
  ['Your request could not be submitted. Please contact a support team member for help.', 'failed'],
  ["Your request couldn't be submitted.", 'failed'],
  ['Your application has not yet been submitted.', 'failed'],
  ['Your request has not been successfully submitted.', 'failed'],
  ['Your request was never submitted.', 'failed'],
  ['I cannot submit your request.', 'failed'],
  ['Tour booking was unsuccessful.', 'failed'],
  ['Your request will be submitted after you confirm.', 'pending'],
  ['Please complete the tour submission from the UI below.', 'pending'],
  ['Do these details look correct?', 'pending'],
  ['Has my request been submitted?', 'pending'],
  ['Would you like your tour booked?', 'pending'],
  ['Your information has been submitted. Would you like to explore homes?', 'submitted'],
] as const) {
  test(`identifies ${status}: ${reply}`, () => {
    expect(assistantSubmissionStatus(reply)).toBe(status);
  });
}
