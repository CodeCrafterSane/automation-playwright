/** Illustrative network contracts. Map these to an authorized target before using references. */
export const contracts = {
  properties: process.env.PROPERTIES_API_PATH || '/api/properties/',
  buyerProfile: process.env.BUYER_PROFILE_API_PATH || '/api/buyer-profile/',
  savedProperty: process.env.SAVED_PROPERTY_API_PATH || '/api/saved-properties/',
  tourBooking: process.env.TOUR_BOOKING_API_PATH || '/api/tour-bookings/',
};
