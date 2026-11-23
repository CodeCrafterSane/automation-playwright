import { expect, type Locator, type Page } from '@playwright/test';
import { ui } from '../../config/ui';

export const assistantStarterOptions = {
  tour: 'I have a property in mind and I want to book a tour',
  preApproval: 'I want to get pre-approved',
  explore: 'Explore homes',
} as const;

export type AssistantStarter = keyof typeof assistantStarterOptions;
export type AssistantListing = { address: string; url: string; linkText?: string; text: string; price: number; beds?: number; baths?: number };

type ConversationMessage = {
  role: string;
  content: string;
  components: { component_name: string; component_props: { field?: string; options?: string[]; [key: string]: unknown } }[];
};

export default class AssistantPage {
  readonly composer: Locator;
  readonly send: Locator;
  readonly assistantMessages: Locator;
  conversation?: { conversation_id: string; status: string; phase: string; saved_values: Record<string, unknown>; messages: ConversationMessage[] };

  get latestAssistant() {
    return this.conversation?.messages.filter(message => message.role === 'assistant').at(-1);
  }

  constructor(private readonly page: Page) {
    this.composer = page.getByRole('textbox', { name: ui.composerName, exact: true });
    this.send = page.getByRole('button', { name: 'Send', exact: true });
    this.assistantMessages = page.locator(ui.messageSelector);
  }

  async open() {
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
    const privacy = this.page.getByRole('button', { name: 'Reject optional', exact: true });
    // Webflow leaves the dismissed banner mounted under page content on later tabs.
    if (await privacy.isVisible()) await privacy.click({ force: true });

    // The decorative SVG covers the background image; click its containing control.
    await this.page.locator(ui.launcherSelector).click();
    await expect(this.composer).toBeEditable();
    await expect(this.assistantMessages).toHaveCount(1);
    await expect(this.assistantMessages.first()).toContainText(ui.greeting);
    await expect(this.send).toBeDisabled();
    for (const label of Object.values(assistantStarterOptions)) {
      await expect(this.page.getByRole('button', { name: label, exact: true })).toBeEnabled();
    }
  }

  async ask(question: string): Promise<string> {
    await this.composer.fill(question);
    await expect(this.send).toBeEnabled();
    return this.sendAndWaitForReply(() => this.send.click(), question);
  }

  async chooseStarter(starter: AssistantStarter): Promise<string> {
    return this.chooseOption(assistantStarterOptions[starter]);
  }

  async chooseOption(label: string): Promise<string> {
    const button = this.page.getByRole('button', {
      name: label,
      exact: true,
    }).and(this.page.locator('button:enabled'));
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
    return this.sendAndWaitForReply(() => button.click(), label);
  }

  async visibleOptions(): Promise<string[]> {
    return this.page.locator('button:visible:enabled').allTextContents();
  }

  listings(city: string, stateCode: string): AssistantListing[] {
    const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b\\d{1,6}\\s+[^\\n,]+,\\s*${escape(city)},\\s*${escape(stateCode)}\\s+\\d{5}`, 'i');
    return (this.latestAssistant?.content || '').split('\n').flatMap(line => {
      const text = line.replace(/\*\*/g, '');
      const url = text.match(/https?:\/\/[^/\s)]+\/listings\/[^\s)]+/)?.[0];
      const fullAddress = text.match(pattern)?.[0];
      const linkText = text.match(/\[([^\]]+)\]\(https?:\/\/[^/\s)]+\/listings\//)?.[1];
      const street = fullAddress?.split(',')[0] || (linkText?.match(/^\d/) ? linkText : text.match(/\b\d{1,6}\s+[^\n[\]—·]+(?=\s*[—·])/i)?.[0]?.trim());
      const zip = url?.match(new RegExp(`-${escape(stateCode)}-(\\d{5})(?:-|$)`, 'i'))?.[1];
      const address = fullAddress || (street && zip ? `${street}, ${city}, ${stateCode} ${zip}` : undefined);
      const price = text.match(/\$([\d,]+)/)?.[1];
      if (!address || !url || !price || new URL(url).origin !== ui.listingOrigin) return [];
      return [{ address, url, linkText, text, price: Number(price.replace(/,/g, '')), beds: Number(text.match(/(\d+(?:\.\d+)?)\s*(?:beds?|bedrooms?)/i)?.[1]) || undefined, baths: Number(text.match(/(\d+(?:\.\d+)?)\s*(?:baths?|bathrooms?)/i)?.[1]) || undefined }];
    });
  }

  async openListing(address: string, expectedUrl?: string, linkText?: string): Promise<Page> {
    // Property address buttons open a confirmation, rather than sending a chat message.
    const addressLink = this.assistantMessages.getByRole('button', { name: linkText && /^\d/.test(linkText) ? linkText : address, exact: true });
    const viewLink = this.assistantMessages.getByRole('listitem').filter({ hasText: address.split(',')[0]! })
      .getByRole('button', { name: /view listing/i });
    await addressLink.or(viewLink).first().click();
    await expect(this.page.getByText('Open external link?', { exact: true })).toBeVisible();
    const target = (await this.page.getByText(/^https?:\/\/[^/\s)]+\/listings\/\S+$/).innerText()).trim();
    expect(new URL(target).origin).toBe(ui.listingOrigin);
    if (expectedUrl) expect(target, 'The confirmation must point to the selected listing').toBe(expectedUrl);
    const popupPromise = this.page.waitForEvent('popup');
    const navigationPromise = this.page.context().waitForEvent('response', {
      predicate: response => response.request().isNavigationRequest() && response.url() === target,
      timeout: 30_000,
    });
    const [popup, navigation] = await Promise.all([
      popupPromise,
      navigationPromise,
      this.page.getByRole('button', { name: 'Open link', exact: true }).click(),
    ]);
    expect(navigation.status(), `The selected listing returned HTTP ${navigation.status()}: ${target}`).toBeLessThan(400);
    await expect(popup).toHaveURL(target);
    await expect(popup.locator('body'), 'The destination must display the selected property').toContainText(address.split(',')[0]!);
    return popup;
  }

  private async sendAndWaitForReply(send: () => Promise<void>, message: string): Promise<string> {
    const previousCount = await this.assistantMessages.count();
    const previousTexts = await this.assistantMessages.allTextContents();

    await send();
    await expect(this.composer).toHaveValue('');
    await expect(this.assistantMessages).toHaveCount(previousCount + 1, { timeout: 90_000 });
    // The refactored widget can place a new response before the greeting in DOM order.
    const reply = previousTexts.reduce(
      (messages, text) => messages.filter({ hasNotText: text }),
      this.assistantMessages,
    );
    await expect(reply).toHaveCount(1);
    await expect(reply).toContainText(/\S/, { timeout: 90_000 });
    await expect(reply).not.toContainText('This request cannot be fulfilled.');
    const content = (await reply.innerText()).trim();
    this.conversation = { conversation_id: 'ui-session', status: '', phase: '', saved_values: {}, messages: [{ role: 'assistant', content, components: [{ component_name: 'suggestions', component_props: { options: await this.visibleOptions() } }] }] };
    return content;
  }
}
