import type { FinancingField, FinancingFlow } from '../../../utils/financingQuestions';

export type SearchScenario = {
  id: string; city: string; state: string; stateCode: string; zip: string;
  propertyType: string; beds: number; baths: number; maxPrice: number; staged?: boolean;
};

export const searchScenarios: SearchScenario[] = [
  { id: 'miami-single-family', city: 'Miami', state: 'Florida', stateCode: 'FL', zip: '33150', propertyType: 'single-family home', beds: 3, baths: 2, maxPrice: 600000 },
  { id: 'miami-condo', city: 'Miami', state: 'Florida', stateCode: 'FL', zip: '33131', propertyType: 'condominium', beds: 2, baths: 2, maxPrice: 800000, staged: true },
  { id: 'atlanta-townhome', city: 'Atlanta', state: 'Georgia', stateCode: 'GA', zip: '30303', propertyType: 'townhome', beds: 3, baths: 2, maxPrice: 700000 },
  { id: 'dallas-family-home', city: 'Dallas', state: 'Texas', stateCode: 'TX', zip: '75201', propertyType: 'single-family home', beds: 4, baths: 3, maxPrice: 1000000 },
  { id: 'fort-lauderdale-condo', city: 'Fort Lauderdale', state: 'Florida', stateCode: 'FL', zip: '33301', propertyType: 'condominium', beds: 1, baths: 1, maxPrice: 500000, staged: true },
];

export const tourScenarios = [
  { id: 'miami-address-morning', search: searchScenarios[0]!, reference: 'address', slot: 'first', contactMode: 'serial', name: 'Avery Morgan', phone: '+13055550127' },
  { id: 'miami-listing-afternoon', search: searchScenarios[0]!, reference: 'link', slot: 'afternoon', contactMode: 'upfront', name: 'Jamie-Lee Carter', phone: '(305) 555-0142' },
  { id: 'atlanta-address-last-slot', search: searchScenarios[2]!, reference: 'address', slot: 'last', contactMode: 'serial', name: 'Jordan Patel', phone: '4045550136' },
  { id: 'dallas-listing-last-slot', search: searchScenarios[3]!, reference: 'link', slot: 'last', contactMode: 'upfront', name: 'Taylor Brooks', phone: '+12145550118' },
] as const;

export type FinancingScenario = {
  id: string; flow: FinancingFlow; city: string; state: string; stateCode: string; zip: string;
  locationMode: 'city-state' | 'zip' | 'city-state-zip'; propertyType: string;
  occupancy: string; foundHome: string; timeline: string; price: number;
  downPaymentPercent: number; downPaymentMode: 'percent' | 'dollars';
  credit: number; employment: string; military: string; name: string; phone: string;
  goal?: string; loanBalance?: number; interestRate?: number; rateType?: string; cashOut?: number;
};

export const financingScenarios: FinancingScenario[] = [
  { id: 'purchase-miami-primary-percent', flow: 'purchase', city: 'Miami', state: 'Florida', stateCode: 'FL', zip: '33150', locationMode: 'city-state', propertyType: 'Single family home', occupancy: 'Primary home', foundHome: 'No', timeline: 'Within next couple of months', price: 625000, downPaymentPercent: 20, downPaymentMode: 'percent', credit: 740, employment: 'Full-time', military: 'No', name: 'Avery Morgan', phone: '3055550127' },
  { id: 'purchase-atlanta-condo-zip', flow: 'purchase', city: 'Atlanta', state: 'Georgia', stateCode: 'GA', zip: '30303', locationMode: 'zip', propertyType: 'Condominium', occupancy: 'Primary home', foundHome: 'Yes', timeline: "Immediately - I'm making an offer", price: 400000, downPaymentPercent: 10, downPaymentMode: 'dollars', credit: 700, employment: 'Part-time', military: 'Yes', name: 'Jamie-Lee Carter', phone: '(404) 555-0142' },
  { id: 'purchase-dallas-rental-self-employed', flow: 'purchase', city: 'Dallas', state: 'Texas', stateCode: 'TX', zip: '75201', locationMode: 'city-state-zip', propertyType: 'Townhome', occupancy: 'Rental property', foundHome: 'Yes', timeline: 'Already under contract', price: 850000, downPaymentPercent: 25, downPaymentMode: 'percent', credit: 780, employment: 'Self-employed', military: 'No', name: 'Jordan Patel', phone: '+12145550136' },
  { id: 'purchase-florida-secondary-home', flow: 'purchase', city: 'Fort Lauderdale', state: 'Florida', stateCode: 'FL', zip: '33301', locationMode: 'city-state-zip', propertyType: 'Single family home', occupancy: 'Secondary home', foundHome: 'No', timeline: "I'm shopping & am considering a few options", price: 1200000, downPaymentPercent: 30, downPaymentMode: 'dollars', credit: 800, employment: 'Full-time', military: 'No', name: 'Taylor Brooks', phone: '+19545550118' },
  { id: 'refinance-miami-lower-rate', flow: 'refinance', city: 'Miami', state: 'Florida', stateCode: 'FL', zip: '33150', locationMode: 'city-state-zip', propertyType: 'Single family home', occupancy: 'Primary home', foundHome: 'Yes', timeline: 'Within next couple of months', price: 650000, downPaymentPercent: 20, downPaymentMode: 'percent', credit: 760, employment: 'Full-time', military: 'No', name: 'Casey Rivera', phone: '3055550148', goal: 'I want to lower my interest rate and monthly payment.', loanBalance: 325000, interestRate: 7.25, rateType: 'Fixed', cashOut: 0 },
  { id: 'refinance-atlanta-cash-out-arm', flow: 'refinance', city: 'Atlanta', state: 'Georgia', stateCode: 'GA', zip: '30303', locationMode: 'zip', propertyType: 'Single family home', occupancy: 'Primary home', foundHome: 'Yes', timeline: 'Within next couple of months', price: 500000, downPaymentPercent: 20, downPaymentMode: 'percent', credit: 720, employment: 'Self-employed', military: 'No', name: 'Morgan Ellis', phone: '(404) 555-0168', goal: 'I want a cash-out refinance for home improvements.', loanBalance: 200000, interestRate: 6.5, rateType: 'Adjustable', cashOut: 50000 },
];

export function searchPrompt(scenario: SearchScenario): string {
  return `${scenario.city}, ${scenario.state}. I want to buy a ${scenario.propertyType} with at least ${scenario.beds} bedrooms and ${scenario.baths} bathrooms, and a maximum purchase budget of $${scenario.maxPrice.toLocaleString('en-US')}. Please show only homes for sale that meet these requirements.`;
}

export function financingValues(s: FinancingScenario, email: string): Record<FinancingField, string> {
  const location = s.locationMode === 'zip' ? s.zip : `${s.city}, ${s.state}${s.locationMode === 'city-state-zip' ? `, ZIP ${s.zip}` : ''}`;
  return {
    goal: s.goal || 'I want to lower my interest rate and monthly payment.', timeline: s.timeline,
    propertyType: s.propertyType, foundHome: s.foundHome, occupancy: s.occupancy, state: location,
    monthlyPayment: '2500', budget: String(s.price),
    downPayment: s.downPaymentMode === 'percent' ? `${s.downPaymentPercent}%` : String(s.price * s.downPaymentPercent / 100),
    credit: String(s.credit), militaryStatus: s.military, income: '120000', employment: s.employment,
    homeValue: String(s.price), loanBalance: String(s.loanBalance ?? s.price / 2),
    interestRate: `${s.interestRate ?? 7}%`, rateType: s.rateType || 'Fixed', existingLoanType: 'None of the above',
    latePayments: 'None', cashOut: String(s.cashOut ?? 30000), name: s.name, email, phone: s.phone,
  };
}
