import {useI18n} from '../i18n.jsx';
export default function TicketCategory({ticket}){
  const {t}=useI18n();
  if(!['women','men'].includes(ticket.category))return null;
  const counts=ticket.orderCategoryCounts;
  return <div className="ticket-category-block">
    <span className={`ticket-category ticket-category--${ticket.category}`}>{t(`event.${ticket.category}`)}</span>
    {counts&&<p className="ticket-category-counts">{t('tickets.orderCategories',{women:counts.women,men:counts.men})}</p>}
  </div>;
}
