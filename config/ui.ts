export const ui = {
  composerName: process.env.CHAT_COMPOSER_NAME || 'Talk with Assistant',
  launcherSelector: process.env.CHAT_LAUNCHER_SELECTOR || '[data-testid="assistant-launcher"]',
  messageSelector: process.env.CHAT_MESSAGE_SELECTOR || '[data-testid="assistant-message"]',
  greeting: process.env.CHAT_GREETING || 'Hi',
  listingOrigin: process.env.LISTING_ORIGIN || 'https://listings.example.com',
};
