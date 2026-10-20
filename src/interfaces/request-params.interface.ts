// Route parameters for the reservation status transition routes, so handlers receive a declared
// `id` instead of the optional lookup an index signature would produce.
export interface ReservationIdParams {
  id: string;
}
