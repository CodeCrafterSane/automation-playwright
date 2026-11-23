import { test, expect } from '../../fixtures/base.fixture';
import LoginPage from '../../pages/auth/LoginPage';
import SignupPage from '../../pages/auth/SignupPage';
import { uniqueTestEmail } from '../../utils/testIdentity';
function configured(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`Configure ${key} for the historical authentication examples.`);
  return value;
}
test('email login reaches an authenticated destination @reference', async ({ page }) => {
  await test.step('Authenticate a dedicated account', () => new LoginPage(page).fullLogin(configured('TEST_BUYER_EMAIL'), configured('TEST_BUYER_PASSWORD')));
  await expect(page).not.toHaveURL(/\/(login|register|error)(?:\/|$)/);
});
test('valid signup form retains entered fields @reference', async ({ page }) => {
  const signup = new SignupPage(page);
  const email = await uniqueTestEmail(configured('TEST_BUYER_EMAIL'));
  await signup.goto();
  await signup.openSignup();
  await signup.fillEmailSignupForm('Avery Morgan', email, configured('TEST_BUYER_PASSWORD'));
  await signup.expectEmailSignupFormVisible();
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Avery Morgan');
  await expect(page.getByRole('textbox', { name: 'Email', exact: true })).toHaveValue(email);
});
