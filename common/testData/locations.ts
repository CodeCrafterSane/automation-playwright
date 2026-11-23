/** Illustrative fixtures, not a representation of any company's service coverage. */
export type AvailabilityType = 'REALTY_AVAILABLE' | 'MORTGAGE_ONLY' | 'UNAVAILABLE';
export interface LocationData {
  search: string; suggestion: RegExp; shortName: string; state: string; availability: AvailabilityType;
}
export const locations: LocationData[] = [
  { search: 'miami', suggestion: /Miami.*FL/i, shortName: 'Miami, FL', state: 'Florida', availability: 'REALTY_AVAILABLE' },
  { search: 'atlanta', suggestion: /Atlanta.*GA/i, shortName: 'Atlanta, GA', state: 'Georgia', availability: 'REALTY_AVAILABLE' },
  { search: 'denver', suggestion: /Denver.*CO/i, shortName: 'Denver, CO', state: 'Colorado', availability: 'MORTGAGE_ONLY' },
  { search: 'anchorage', suggestion: /Anchorage.*AK/i, shortName: 'Anchorage, AK', state: 'Alaska', availability: 'UNAVAILABLE' },
];
