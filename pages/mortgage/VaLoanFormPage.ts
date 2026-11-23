import { random } from '../../utils/random';
import { expect, Page } from '@playwright/test';
import { PREFIX } from '../../utils/env';

export const VA_LOAN_FORM_OPTIONS = {
  mortgageService: ['Buy a new home', 'Refinance my current home'],
  primaryGoal: [
    'Lower rates/monthly payments',
    'Take cash out',
    'Change my loan term',
    'Other reason',
  ],
  buyTimeline: ['Within 30 days', 'In 2-3 months', 'In 3-6 months', 'More than 6 months'],
  propertyType: [
    'Single-family home',
    'Multi-family property',
    'Condo/townhouse',
    'Manufactured home',
    'Other',
  ],
  states: [
    'Alabama',
    'Arizona',
    'Arkansas',
    'California',
    'Colorado',
    'Florida',
    'Georgia',
    'Idaho',
    'Indiana',
    'Iowa',
    'Kansas',
    'Kentucky',
    'Louisiana',
    'Maryland',
    'Michigan',
    'Mississippi',
    'Missouri',
    'Montana',
    'Nevada',
    'New Mexico',
    'North Carolina',
    'Oklahoma',
    'Oregon',
    'Pennsylvania',
    'South Carolina',
    'Tennessee',
    'Texas',
    'Utah',
    'Virginia',
    'Washington',
    'Wyoming',
  ],
  loanFor: ['Primary residence', 'Rental home', 'Second home'],
  militaryInvolvement: ['Yes, Veteran', 'Yes, active service member', 'No military involvement'],
  monthlyPayment: ['1850', '2400', '3100', '4250'],
  downPaymentAmount: ['15000', '30000', '50000', '75000'],
  creditScore: ['640', '700', '760', '810'],
  contact: {
    fullNames: ['Morgan Reed', 'Taylor Parker', 'Jordan Ellis', 'Casey Morgan'],
  },
} as const;

export default class VaLoanFormPage {
  constructor(private page: Page) {}

  async expectReady() {
    await expect(this.page).toHaveURL(/\/mortgage\/form\/va-loan-1(?:\/|\?|$)/);
    await this.page.waitForTimeout(1000);
    await this.installActiveStepHelper();
    await this.expectActiveStepTitle('What are you looking to do?', 5000);
  }

  async completeWithRandomInputs() {
    await this.expectReady();

    const mortgageService = await this.chooseMortgageService();

    if (mortgageService === 'Refinance my current home') {
      await this.completeRefinanceFlow();
      return;
    }

    await this.completeBuyHomeFlow();
  }

  private async completeBuyHomeFlow() {
    await this.chooseBuyTimeline();
    await this.choosePropertyType();
    await this.chooseState();
    await this.enterMonthlyPayment();
    await this.enterDownPayment();
    await this.completeSharedFinalSteps();
  }

  private async completeRefinanceFlow() {
    await this.choosePrimaryGoal('Where is your current home?');
    await this.chooseCurrentHomeState();
    await this.chooseLoanPurpose('What is your credit score?');
    await this.completeSharedFinalSteps();
  }

  private async completeSharedFinalSteps() {
    await this.setCreditScore();
    await this.chooseMilitaryInvolvement();
    await this.completeContactStep();
  }

  private async chooseMortgageService() {
    await this.expectActiveStep(
      'What are you looking to do?',
      VA_LOAN_FORM_OPTIONS.mortgageService,
    );
    const mortgageService = randomItem([...VA_LOAN_FORM_OPTIONS.mortgageService]);

    await this.clickOption(
      'What are you looking to do?',
      VA_LOAN_FORM_OPTIONS.mortgageService,
      mortgageService,
    );
    await this.expectActiveStepTitle(
      mortgageService === 'Buy a new home'
        ? 'When do you plan to buy?'
        : 'What is your primary goal?',
    );

    return mortgageService;
  }

  private async choosePrimaryGoal(nextTitle: string) {
    await this.expectActiveStep('What is your primary goal?', VA_LOAN_FORM_OPTIONS.primaryGoal);
    await this.clickRandomOptionAndExpectNext(
      'What is your primary goal?',
      VA_LOAN_FORM_OPTIONS.primaryGoal,
      nextTitle,
    );
  }

  private async chooseBuyTimeline() {
    await this.expectActiveStep('When do you plan to buy?', VA_LOAN_FORM_OPTIONS.buyTimeline);
    await this.clickRandomOptionAndExpectNext(
      'When do you plan to buy?',
      VA_LOAN_FORM_OPTIONS.buyTimeline,
      'What kind of home would you like to buy?',
    );
  }

  private async choosePropertyType() {
    await this.expectActiveStep(
      'What kind of home would you like to buy?',
      VA_LOAN_FORM_OPTIONS.propertyType,
    );
    await this.clickRandomOptionAndExpectNext(
      'What kind of home would you like to buy?',
      VA_LOAN_FORM_OPTIONS.propertyType,
      'Where do you want to buy?',
    );
  }

  private async chooseState() {
    await this.expectActiveStateStep('Where do you want to buy?');
    await this.selectRandomState();
    await this.expectActiveStepTitle('How much would you like to pay per month?');
  }

  private async chooseCurrentHomeState() {
    await this.expectActiveStateStep('Where is your current home?');
    await this.selectRandomState();
    await this.expectActiveStepTitle('What is this loan for?');
  }

  private async chooseLoanPurpose(nextTitle: string) {
    await this.expectActiveStep('What is this loan for?', VA_LOAN_FORM_OPTIONS.loanFor);
    await this.clickRandomOptionAndExpectNext(
      'What is this loan for?',
      VA_LOAN_FORM_OPTIONS.loanFor,
      nextTitle,
    );
  }

  private async enterMonthlyPayment() {
    await this.expectActiveStepTitle('How much would you like to pay per month?');
    await this.fillActiveInput(
      'monthly_payment',
      randomItem([...VA_LOAN_FORM_OPTIONS.monthlyPayment]),
    );
    await this.clickContinueAndExpectNext('How much do you want to put down?');
  }

  private async enterDownPayment() {
    await this.expectActiveStepTitle('How much do you want to put down?');
    await this.fillActiveInput(
      'down_payment',
      randomItem([...VA_LOAN_FORM_OPTIONS.downPaymentAmount]),
    );
    await this.clickContinueAndExpectNext('What is your credit score?');
  }

  private async setCreditScore() {
    await this.expectActiveStepTitle('What is your credit score?');
    await this.fillActiveInput('credit_score', randomItem([...VA_LOAN_FORM_OPTIONS.creditScore]));
    await this.clickContinueAndExpectNext(
      'Do you or your spouse potentially qualify for VA Loan benefits?',
    );
  }

  private async chooseMilitaryInvolvement() {
    await this.expectActiveStep(
      'Do you or your spouse potentially qualify for VA Loan benefits?',
      VA_LOAN_FORM_OPTIONS.militaryInvolvement,
    );
    await this.clickRandomOptionAndExpectNext(
      'Do you or your spouse potentially qualify for VA Loan benefits?',
      VA_LOAN_FORM_OPTIONS.militaryInvolvement,
      'How can we get in touch?',
    );
  }

  private async completeContactStep() {
    await this.expectActiveStepTitle('How can we get in touch?');
    await this.fillActiveInput(
      'full_name',
      randomItem([...VA_LOAN_FORM_OPTIONS.contact.fullNames]),
    );
    await this.fillActiveInput('phone_number', randomTenDigitPhoneNumber());
    await this.fillActiveInput('email', createVaLoanEmail());
    await this.page.evaluate(() => {
      const checkbox = window.__getActiveVaLoanStep!().querySelector<HTMLInputElement>(
        'input[name="Contact-Consent-Checkbox"]',
      );

      if (!checkbox) {
        throw new Error('Expected consent checkbox on active VA loan step.');
      }

      if (!checkbox.checked) {
        checkbox.click();
      }
    });
    await expect
      .poll(
        () =>
          this.page.evaluate(
            () =>
              !!window.__getActiveVaLoanStep!().querySelector<HTMLInputElement>(
                'input[type="submit"][value="Submit"]',
              ),
          ),
        { message: 'Expected Submit on active VA loan consent step.', timeout: 5000 },
      )
      .toBe(true);
  }

  private async clickRandomOptionAndExpectNext(
    currentTitle: string,
    options: readonly string[],
    nextTitle: string,
  ) {
    const clickedOption = randomItem([...options]);

    await this.clickOption(currentTitle, options, clickedOption);
    await this.expectActiveStepTitle(nextTitle);
    return clickedOption;
  }

  private async clickOption(currentTitle: string, options: readonly string[], option: string) {
    await this.expectActiveStep(currentTitle, options);
    await this.page.waitForTimeout(500);
    await this.page.getByText(option, { exact: true }).click({ force: true });
  }

  private async selectRandomState() {
    const selected = randomItem([...VA_LOAN_FORM_OPTIONS.states]);
    const combobox = this.page.getByRole('combobox').first();

    await combobox.click({ force: true });
    await this.page.getByRole('option', { name: selected, exact: true }).click({ force: true });
  }

  private async fillActiveInput(name: string, value: string) {
    const filled = await this.page.evaluate(
      ({ inputName, inputValue }) => {
        const input = window.__getActiveVaLoanStep!().querySelector<HTMLInputElement>(
          `input[name="${inputName}"]`,
        );

        if (!input) {
          return false;
        }

        input.value = inputValue;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      },
      { inputName: name, inputValue: value },
    );

    expect(filled, `Expected active step input "${name}" to be present.`).toBe(true);
  }

  private async clickContinueAndExpectNext(nextTitle: string) {
    const clicked = await this.page.evaluate(() => {
      const button = [...window.__getActiveVaLoanStep!().querySelectorAll('button')].find(
        (candidate) => (candidate.textContent || '').trim().toLowerCase() === 'continue',
      ) as HTMLButtonElement | undefined;

      if (!button) {
        return false;
      }

      button.click();
      return true;
    });

    expect(clicked, 'Expected active VA loan step to show Continue.').toBe(true);
    await this.expectActiveStepTitle(nextTitle);
  }

  private async expectActiveStep(title: string, options: readonly string[]) {
    await this.expectActiveStepTitle(title);

    const visibleOptions = await this.page.evaluate(() =>
      [...window.__getActiveVaLoanStep!().querySelectorAll('label')]
        .map((label) => (label.textContent || '').trim())
        .filter(Boolean),
    );

    for (const option of options) {
      expect(
        visibleOptions,
        `Expected active step "${title}" to show option "${option}".`,
      ).toContain(option);
    }
  }

  private async expectActiveStateStep(title: string) {
    await this.expectActiveStepTitle(title);

    const stateOptions = await this.page.evaluate(() =>
      [...window.__getActiveVaLoanStep!().querySelectorAll('select[name="state"] option')]
        .map((option) => (option.textContent || '').trim())
        .filter(Boolean),
    );
    const actualStates = [
      ...new Set(stateOptions.filter((option) => option !== 'Select a state')),
    ].sort();
    const expectedStates = [...VA_LOAN_FORM_OPTIONS.states].sort();

    expect(
      actualStates,
      `Expected active step "${title}" to show exactly ${expectedStates.length} supported states.`,
    ).toEqual(expectedStates);
  }

  private async expectActiveStepTitle(title: string): Promise<void>;
  private async expectActiveStepTitle(title: string, timeout: number): Promise<void>;
  private async expectActiveStepTitle(title: string, timeout = 5000) {
    await expect
      .poll(() => this.activeStepText(), {
        message: `Expected active VA loan step title: ${title}`,
        timeout,
      })
      .toContain(title);
  }

  private async activeStepText() {
    return this.page.evaluate(() => {
      try {
        return window.__getActiveVaLoanStep?.()?.innerText.trim() ?? '';
      } catch {
        return '';
      }
    });
  }

  private async installActiveStepHelper() {
    await this.page.evaluate(() => {
      window.__getActiveVaLoanStep = () => {
        const steps = [...document.querySelectorAll<HTMLElement>('form .form-step')];
        const step = steps.find((candidate) => {
          const style = window.getComputedStyle(candidate);
          const rect = candidate.getBoundingClientRect();

          return style.display !== 'none' && rect.width > 0 && rect.height > 0;
        });

        if (!step) {
          throw new Error('No active VA loan form step found.');
        }

        return step;
      };

      window.__getActiveVaLoanStepByTitle = (title: string) => {
        const step = window.__getActiveVaLoanStep?.();

        if (step?.innerText.includes(title)) {
          return step;
        }

        throw new Error(`Expected active VA loan form step title "${title}".`);
      };
    });
  }
}

function randomItem<T>(items: T[]) {
  return items[Math.floor(random() * items.length)]!;
}

function randomTenDigitPhoneNumber() {
  return `20255501${String(Math.floor(random() * 100)).padStart(2, '0')}`;
}

function createVaLoanEmail() {
  const envName = `${PREFIX}_QA_EMAIL`;
  const baseEmail = process.env[envName]
    ?.split(/[,\n]/)
    .map((email) => email.trim())
    .filter(Boolean)[0];

  if (!baseEmail) {
    throw new Error(`Missing ${envName} for VA loan contact email.`);
  }

  const match = baseEmail.match(/^([^+@]+)(?:\+([^@]+))?@(.+)$/);

  if (!match) {
    throw new Error(`Invalid ${envName} base email: ${baseEmail}`);
  }

  const [, localPart, tag = '', domain] = match;

  return `${localPart}+${tag}${Date.now()}valoan@${domain}`;
}

declare global {
  interface Window {
    __getActiveVaLoanStep?: () => HTMLElement;
    __getActiveVaLoanStepByTitle?: (title: string) => HTMLElement;
  }
}
