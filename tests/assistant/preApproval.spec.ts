import { test } from '../../fixtures/assistant.fixture';
import { financingScenarios } from '../../common/testData/assistant/validScenarios';
import { runValidFinancingJourney } from '../../utils/assistant/financingJourney';

test.describe('Assistant pre-approval @P1 @assistant @assistantPreApproval @valid', () => {
  test.setTimeout(600_000);
  for (const scenario of financingScenarios) {
    test(`${scenario.id}: reviews the valid details and submits`, async ({ page, assistant, discoveryAssistant }, testInfo) => {
      await runValidFinancingJourney(page, assistant, discoveryAssistant, testInfo, scenario);
    });
  }
});
