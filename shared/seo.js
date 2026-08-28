export const SEO_SITE_URL = 'https://project-iskra.com';
export const SEO_IMAGE_PATH = '/og/project-iskra-social.jpg';
export const SEO_IMAGE_URL = `${SEO_SITE_URL}${SEO_IMAGE_PATH}`;

const localized = (en, uk, ru) => ({ en, uk, ru });

const pages = {
  '/': {
    title: localized(
      'Project ISKRA Montreal | Ukrainian Nightlife & Events',
      'Project ISKRA Montreal | Українські вечірки та події',
      'Project ISKRA Montreal | Украинские вечеринки и события'
    ),
    description: localized(
      'Project ISKRA creates Ukrainian nightlife, music events, games, and community experiences in Montreal. Explore upcoming events, offers, and tickets.',
      'Project ISKRA створює українські вечірки, музичні події, ігри та спільноту в Монреалі. Дізнавайтеся про нові події, пропозиції та квитки.',
      'Project ISKRA создаёт украинские вечеринки, музыкальные события, игры и сообщество в Монреале. Узнавайте о новых событиях, предложениях и билетах.'
    ),
    label: localized('Home', 'Головна', 'Главная')
  },
  '/schedule': {
    title: localized('Upcoming ISKRA Events & Tickets | Montreal', 'Майбутні події ISKRA та квитки | Montreal', 'Предстоящие события ISKRA и билеты | Montreal'),
    description: localized(
      'See the official Project ISKRA event schedule in Montreal. Find announced dates, venues, ticket options, and event details.',
      'Офіційний розклад подій Project ISKRA у Монреалі: анонсовані дати, локації, квитки та деталі подій.',
      'Официальное расписание событий Project ISKRA в Монреале: даты, площадки, билеты и подробности событий.'
    ),
    label: localized('Schedule', 'Розклад', 'Расписание')
  },
  '/gallery': {
    title: localized('Project ISKRA Event Gallery | Montreal', 'Галерея подій Project ISKRA | Montreal', 'Галерея событий Project ISKRA | Montreal'),
    description: localized(
      'Photos from Project ISKRA nights in Montreal: the people, energy, music, and moments that define the community.',
      'Фото з вечірок Project ISKRA у Монреалі: люди, енергія, музика та моменти нашої спільноти.',
      'Фото с вечеринок Project ISKRA в Монреале: люди, энергия, музыка и моменты нашего сообщества.'
    ),
    label: localized('Gallery', 'Галерея', 'Галерея')
  },
  '/offers': {
    title: localized('ISKRA Ticket Offers & Group Deals | Montreal', 'Пропозиції ISKRA та групові знижки | Montreal', 'Предложения ISKRA и групповые скидки | Montreal'),
    description: localized(
      'Discover current Project ISKRA ticket offers, group discounts, early access, VIP tables, and game rewards for Montreal events.',
      'Актуальні пропозиції Project ISKRA: групові знижки, ранній доступ, VIP-столи та ігрові нагороди для подій у Монреалі.',
      'Актуальные предложения Project ISKRA: групповые скидки, ранний доступ, VIP-столы и игровые награды для событий в Монреале.'
    ),
    label: localized('Offers', 'Пропозиції', 'Предложения')
  },
  '/play': {
    title: localized('ISKRA Play | Games, Tournaments & Ticket Rewards', 'ISKRA Play | Ігри, турніри та квиткові нагороди', 'ISKRA Play | Игры, турниры и билетные награды'),
    description: localized(
      'Enter Project ISKRA games and free tournaments. Practice, compete on live leaderboards, and qualify for event ticket rewards.',
      'Грайте в ігри та безкоштовні турніри Project ISKRA, змагайтеся в рейтингах і вигравайте нагороди на квитки.',
      'Играйте в игры и бесплатные турниры Project ISKRA, соревнуйтесь в рейтингах и выигрывайте билетные награды.'
    ),
    label: localized('Play', 'Грати', 'Играть')
  },
  '/play/spark-rush': {
    title: localized('Spark Rush | Play for ISKRA Ticket Rewards', 'Spark Rush | Грайте за нагороди ISKRA', 'Spark Rush | Играйте за награды ISKRA'),
    description: localized(
      'Play Spark Rush, Project ISKRA\'s event-linked arcade competition. Catch sparks, climb the leaderboard, and compete for ticket offers.',
      'Грайте у Spark Rush, аркадне змагання Project ISKRA: ловіть іскри, піднімайтеся в рейтингу та змагайтеся за квиткові пропозиції.',
      'Играйте в Spark Rush, аркадное соревнование Project ISKRA: ловите искры, поднимайтесь в рейтинге и соревнуйтесь за билетные предложения.'
    ),
    label: localized('Spark Rush', 'Spark Rush', 'Spark Rush')
  },
  '/play/poker': {
    title: localized('ISKRA Poker | Free Montreal Event Tournaments', 'ISKRA Poker | Безкоштовні турніри в Montreal', 'ISKRA Poker | Бесплатные турниры в Montreal'),
    description: localized(
      'Join free Project ISKRA Texas Hold\'em tournaments, practice in demo mode, and compete for event ticket prizes. No purchase necessary.',
      'Беріть участь у безкоштовних турнірах Project ISKRA з Texas Hold\'em, тренуйтеся в деморежимі та змагайтеся за квитки.',
      'Участвуйте в бесплатных турнирах Project ISKRA по Texas Hold\'em, тренируйтесь в деморежиме и соревнуйтесь за билеты.'
    ),
    label: localized('Poker', 'Покер', 'Покер')
  },
  '/about': {
    title: localized('About Project ISKRA | Montreal Nightlife Community', 'Про Project ISKRA | Спільнота Montreal', 'О Project ISKRA | Сообщество Montreal'),
    description: localized(
      'Meet Project ISKRA, a Montreal event community built around Ukrainian culture, music, connection, and unforgettable nights.',
      'Познайомтеся з Project ISKRA, монреальською спільнотою подій навколо української культури, музики, знайомств і незабутніх вечорів.',
      'Познакомьтесь с Project ISKRA, монреальским сообществом событий вокруг украинской культуры, музыки, знакомств и незабываемых вечеров.'
    ),
    label: localized('About', 'Про нас', 'О нас')
  },
  '/partners': {
    title: localized('Project ISKRA Partners | Montreal', 'Партнери Project ISKRA | Montreal', 'Партнёры Project ISKRA | Montreal'),
    description: localized(
      'Meet the venues, creators, community organizations, and technology partners helping Project ISKRA bring Montreal together.',
      'Познайомтеся з локаціями, авторами, організаціями та технологічними партнерами, які розвивають Project ISKRA у Монреалі.',
      'Познакомьтесь с площадками, авторами, организациями и технологическими партнёрами, развивающими Project ISKRA в Монреале.'
    ),
    label: localized('Partners', 'Партнери', 'Партнёры')
  },
  '/contact': {
    title: localized('Contact Project ISKRA | Bookings & Partnerships', 'Контакти Project ISKRA | Бронювання та партнерства', 'Контакты Project ISKRA | Бронирования и партнёрства'),
    description: localized(
      'Contact Project ISKRA for event questions, VIP tables, partnerships, press, and accessibility support in Montreal.',
      'Звʼяжіться з Project ISKRA щодо подій, VIP-столів, партнерств, медіа та доступності в Монреалі.',
      'Свяжитесь с Project ISKRA по вопросам событий, VIP-столов, партнёрств, прессы и доступности в Монреале.'
    ),
    label: localized('Contact', 'Контакти', 'Контакты')
  },
  '/newsletter': {
    title: localized('Project ISKRA Presale & Event Newsletter', 'Розсилка Project ISKRA | Події та передпродаж', 'Рассылка Project ISKRA | События и предпродажа'),
    description: localized(
      'Join the Project ISKRA mailing list for event announcements, presale access, ticket offers, and Montreal community updates.',
      'Підпишіться на Project ISKRA, щоб першими отримувати анонси подій, доступ до передпродажу, квиткові пропозиції та новини спільноти.',
      'Подпишитесь на Project ISKRA, чтобы первыми получать анонсы событий, доступ к предпродаже, билетные предложения и новости сообщества.'
    ),
    label: localized('Newsletter', 'Розсилка', 'Рассылка')
  },
  '/terms': {
    title: localized('Project ISKRA Event Terms & Conditions', 'Умови подій Project ISKRA', 'Условия мероприятий Project ISKRA'),
    description: localized(
      'Read the terms for Project ISKRA event admission, tickets, refunds, conduct, privacy, promotions, and venue policies.',
      'Ознайомтеся з умовами Project ISKRA щодо входу, квитків, повернень, поведінки, конфіденційності, акцій та правил локацій.',
      'Ознакомьтесь с условиями Project ISKRA по входу, билетам, возвратам, поведению, конфиденциальности, акциям и правилам площадок.'
    ),
    label: localized('Terms', 'Умови', 'Условия')
  }
};

const privatePrefixes = ['/admin', '/staff', '/account', '/tickets'];

export function normalizeSeoPath(pathname = '/') {
  const clean = pathname.split('?')[0].replace(/\/+$/, '') || '/';
  if (clean.startsWith('/play/poker/')) return '/play/poker';
  return clean;
}

export function getSeo(pathname = '/', language = 'en') {
  const requestedPath = pathname.split('?')[0].replace(/\/+$/, '') || '/';
  const normalizedPath = normalizeSeoPath(requestedPath);
  const locale = ['en', 'uk', 'ru'].includes(language) ? language : 'en';
  const page = pages[normalizedPath];
  const isPrivate = privatePrefixes.some(prefix => requestedPath === prefix || requestedPath.startsWith(`${prefix}/`));
  const isPokerSubpage = requestedPath.startsWith('/play/poker/');
  const indexable = Boolean(page) && !isPrivate && !isPokerSubpage;

  return {
    known: Boolean(page) || isPrivate,
    indexable,
    path: normalizedPath,
    canonical: `${SEO_SITE_URL}${normalizedPath === '/' ? '/' : normalizedPath}`,
    title: page?.title[locale] || 'Project ISKRA',
    description: page?.description[locale] || 'Project ISKRA events, tickets, games, and community experiences in Montreal.',
    label: page?.label[locale] || 'Project ISKRA'
  };
}

export function indexableSeoPaths() {
  return Object.keys(pages);
}
