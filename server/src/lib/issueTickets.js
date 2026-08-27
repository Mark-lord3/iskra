import { randomUUID, randomBytes } from 'node:crypto';
import Ticket from '../models/Ticket.js';

/**
 * Mint tickets for an event. Shared by the paid checkout and by tournament
 * prize fulfilment so both produce identical, scannable tickets.
 */
export function ticketDoc({ event, buyerName, buyerEmail, tier, price = 0, orderId = null,
                            userId = null, stripeSessionId = null }){
  const reference = `ISKRA-${randomUUID().replaceAll('-','').slice(0,12).toUpperCase()}`;
  const qrSecret = randomBytes(18).toString('base64url');
  return {
    reference,
    accessToken: randomBytes(24).toString('hex'),
    qrSecret,
    qrPayload: `ISKRA:${reference}:${qrSecret}`,
    eventSlug: event.slug, eventTitle: event.title, eventDate: event.date, room: event.room,
    buyerName, buyerEmail, tier, price, orderId, userId, stripeSessionId
  };
}

export async function mintTickets({ event, quantity, buyerName, buyerEmail, tier, userId }){
  const docs = Array.from({ length: quantity }, () =>
    ticketDoc({ event, buyerName, buyerEmail, tier, price: 0, userId }));
  await Ticket.create(docs);
  return docs.map(d => ({ reference: d.reference, accessToken: d.accessToken }));
}
