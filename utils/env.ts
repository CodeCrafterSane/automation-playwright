import 'dotenv/config';
/** Public adapter: host and account values are supplied by the consumer. */
export const PREFIX = 'TEST';
export default { baseURL: process.env.BASE_URL || 'https://example.com' };
