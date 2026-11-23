import { expect, Locator, Page } from '@playwright/test';

type ToastRecorderWindow = Window & {
  __playwrightToastObserver?: MutationObserver;
  __playwrightToastRecorderInstalled?: boolean;
  __playwrightToastTexts?: string[];
};

export async function installToastRecorder(page: Page) {
  await page.evaluate(() => {
    const recorderWindow = window as ToastRecorderWindow;

    if (!recorderWindow.__playwrightToastTexts) {
      recorderWindow.__playwrightToastTexts = [];
    }

    const normalizeToastText = (value: string) => value.replace(/\s+/g, ' ').trim();
    const recordVisibleToasts = () => {
      const toastTexts = recorderWindow.__playwrightToastTexts!;

      for (const toast of Array.from(document.querySelectorAll('[data-sonner-toast]'))) {
        const toastText = normalizeToastText(toast.textContent || '');

        if (toastText && !toastTexts.includes(toastText)) {
          toastTexts.push(toastText);
        }
      }
    };

    recordVisibleToasts();

    if (recorderWindow.__playwrightToastRecorderInstalled) {
      return;
    }

    recorderWindow.__playwrightToastObserver = new MutationObserver(recordVisibleToasts);
    recorderWindow.__playwrightToastObserver.observe(document.body, {
      characterData: true,
      childList: true,
      subtree: true,
    });
    recorderWindow.__playwrightToastRecorderInstalled = true;
  });
}

export async function clearRecordedToasts(page: Page) {
  await installToastRecorder(page);
  await page.evaluate(() => {
    (window as ToastRecorderWindow).__playwrightToastTexts = [];
  });
}

export async function expectToastVisibleOrRecorded(
  page: Page,
  toast: Locator,
  text: RegExp,
  message: string,
) {
  await installToastRecorder(page);

  await expect
    .poll(
      async () => {
        if (await toast.isVisible().catch(() => false)) {
          return true;
        }

        return hasRecordedToast(page, text);
      },
      { message, timeout: 30000 },
    )
    .toBe(true);
}

async function hasRecordedToast(page: Page, text: RegExp) {
  return page.evaluate(
    ({ flags, source }) => {
      const toastTextPattern = new RegExp(source, flags);
      const toastTexts = (window as ToastRecorderWindow).__playwrightToastTexts || [];

      return toastTexts.some((toastText) => toastTextPattern.test(toastText));
    },
    { flags: text.flags, source: text.source },
  );
}
