import Footer from '../components/Footer.jsx';
import Nav from '../components/Nav.jsx';
import PromoBar from '../components/PromoBar.jsx';
import { SITE } from '../site.js';

const sections = [
  ['1. Agreement and organizer', 'These Event Terms apply to tickets sold through the official Project ISKRA website and to attendance at Project ISKRA events in Quebec. The event organizer identified in your order confirmation is the merchant for your ticket. By completing an order, you agree to these terms and the event details shown before payment.'],
  ['2. Age and identification', 'Unless an event page expressly says otherwise, Project ISKRA nightlife events are for guests 18 years of age or older. Government-issued photo identification may be checked at the door. A ticket does not override the venue’s age restrictions or liquor-permit conditions.'],
  ['3. Prices and payment', 'Prices are shown in Canadian dollars. The ticket type, quantity, applicable taxes, mandatory fees, total price, event date, time and location are presented before payment. Payments are processed securely by Stripe. Project ISKRA does not store complete payment-card numbers.'],
  ['4. Ticket delivery and use', 'After confirmed payment, QR tickets are displayed in My Tickets and sent to the purchaser’s email address. Each QR code admits one guest once and becomes invalid after successful check-in. Keep codes private. Duplicated, altered, fraudulently obtained or already-used tickets may be refused. Contact us promptly if delivery fails.'],
  ['5. Transfers and resale', 'A ticket may be given to another eligible guest unless the event page states that it is personalized. Commercial resale, resale above the permitted price, automated purchasing and unauthorized ticket brokerage are prohibited. We may ask the purchaser to verify an order when fraud is reasonably suspected.'],
  ['6. Refunds, cancellation and postponement', 'Except where these terms, the event listing or applicable law provide otherwise, completed ticket sales are final. If Project ISKRA cancels an event, the purchaser will be informed as soon as reasonably possible and the ticket price and mandatory ticket fees will be refunded to the original payment method. If an event is postponed or its schedule or location materially changes, the ticket remains valid and the organizer will communicate the available options. Nothing in these terms limits cancellation, reimbursement or chargeback rights provided by Quebec consumer-protection law.'],
  ['7. Entry and conduct', 'Admission remains subject to capacity, safety requirements and lawful venue rules. Guests must follow reasonable instructions from venue and security staff. Harassment, violence, threats, weapons, illegal substances, dangerous conduct and severe intoxication are not permitted. A guest may be removed or refused entry for a genuine safety, legal or serious conduct reason. This clause does not remove any remedy that cannot lawfully be excluded.'],
  ['8. Program changes', 'Artists, hosts, activities and running order may change. Project ISKRA will communicate material changes as soon as reasonably possible. A minor lineup or timing adjustment does not automatically cancel a ticket, but statutory rights continue to apply.'],
  ['9. Photography and recording', 'Events may be photographed or recorded for event documentation and promotion. Notices may be displayed at the venue. Guests who need a reasonable privacy accommodation should contact the team before the event or speak with staff on arrival. Focused commercial use of a person’s likeness will be handled with any consent required by law.'],
  ['10. Accessibility and accommodation', 'Accessibility differs by venue. Contact the team before purchasing or attending if you need step-free access, seating, communication support or another accommodation. We will provide accurate venue information and work in good faith on reasonable arrangements.'],
  ['11. Personal information', 'Order and attendance information is used to process payment, issue and validate tickets, prevent fraud, provide support and meet legal obligations. Marketing messages require the applicable consent and include an unsubscribe method. Personal information is retained only for legitimate operational and legal needs and is not sold.'],
  ['12. Liability and applicable law', 'Guests remain responsible for their personal property and choices. To the extent permitted by law, the organizer is not responsible for losses caused solely by a guest, an unrelated third party or an event outside reasonable control. Nothing excludes liability or consumer rights that cannot legally be excluded. These terms are governed by the laws applicable in Quebec, and disputes may be brought before a court or authority that has jurisdiction under those laws.'],
  ['13. Contact', `Questions, accessibility requests, cancellation notices and ticket-delivery issues may be sent to ${SITE.email}. Include the purchaser’s name, event and ticket reference, but never send complete card details.`]
];

export default function TermsPage({ onTickets }) {
  return <>
    <PromoBar />
    <Nav onTickets={onTickets} />
    <main className="legal-page">
      <header className="legal-hero"><div className="wrap">
        <p className="eyebrow">Legal / Event admission</p>
        <h1>EVENT TERMS<br />&amp; CONDITIONS</h1>
        <p>Plain-language conditions for official Project ISKRA tickets and events in Québec.</p>
        <span>Effective August 26, 2026 · Version 1.0</span>
      </div></header>
      <div className="wrap legal-layout">
        <aside><b>Before you enter</b><p>18+ photo ID may be required. Keep your QR private and contact us if it does not arrive.</p><a href={`mailto:${SITE.email}`}>{SITE.email}</a><a href="https://www.opc.gouv.qc.ca/en/consumer/topic/purchase/online-purchase/cancelling/condition/" target="_blank" rel="noopener noreferrer">Quebec cancellation rights ↗</a><button type="button" onClick={() => window.print()}>Print or save PDF</button></aside>
        <article className="legal-copy"><p className="legal-intro">These terms are intended to make the purchase and door rules clear before you pay. Your mandatory rights under Quebec law always remain in force.</p>{sections.map(([title,copy])=><section key={title}><h2>{title}</h2><p>{copy}</p></section>)}</article>
      </div>
    </main>
    <Footer />
  </>;
}
