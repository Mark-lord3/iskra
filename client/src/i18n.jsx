import {createContext,useContext,useEffect,useState} from 'react';

import fr from './i18n-fr.json';
import {additions} from './i18n-additions.js';

const STORAGE_KEY='iskra_language';
const LOCALES={en:'en-CA',uk:'uk-UA',ru:'ru-RU',fr:'fr-CA'};

const en={
  'sale.noneTitle':'Nothing on sale right now.','sale.noneCopy':'The next night has not been published yet. Join the mailing list and you will get the link before it goes public.','sale.seeSchedule':'See the schedule','sale.joinList':'Join the mailing list',
  'nl.incoming':'Incoming transmission','nl.title':'Catch the next signal','nl.lead':'Subscribers get event announcements, private locations and presale codes before anyone else.','nl.emailLabel':'Email address','nl.placeholder':'you@email.com','nl.subscribe':'Open channel','nl.sending':'Transmitting…','nl.okTitle':'Transmission received.','nl.okCopy':'{email} is on the channel. The next signal reaches you before the public release.','nl.okAgain':'Add another address','nl.dupTitle':'Already on the channel.','nl.dupCopy':'{email} is receiving ISKRA transmissions. Nothing else to do.','nl.errEmail':'That address will not receive a signal. Check it and try again.','nl.errOffline':'No connection to the relay. Your address was kept, try again.','nl.errRate':'Too many transmissions. Wait a moment and try again.','nl.errServer':'The relay dropped the signal. Your address was kept, try again.','nl.statusIdle':'Channel ready','nl.signal':'Signal','nl.channel':'Channel','nl.coords':'Coordinates','nl.freq':'Frequency','nl.live':'Live','nl.locked':'Locked','nl.receiveTitle':'Intercepted from the channel','nl.receiveLead':'Five kinds of signal go out to subscribers. This is what they look like.','nl.r1':'Presale codes','nl.r1c':'Discount codes reach the channel before the poster is public.','nl.r2':'Private locations','nl.r2c':'Addresses for unlisted nights, sent only to the list.','nl.r3':'Event announcements','nl.r3c':'Lineups and dates the moment the team locks them.','nl.r4':'Birthday offers','nl.r4c':'Table and group pricing for your night, quoted privately.','nl.r5':'Lineup drops','nl.r5c':'Guest selectors and b2b sets, announced on the channel first.','nl.timelineTitle':'When the signal reaches you','nl.timelineLead':'The same night, three different moments.','nl.tl1':'Channel','nl.tl1c':'You hear first, with the code attached.','nl.tl2':'Instagram','nl.tl2c':'The poster goes public.','nl.tl3':'Public release','nl.tl3c':'Tickets open to everyone, at full price.','nl.tlNow':'Now','nl.tlLater':'+48 hours','nl.tlLast':'+72 hours','nl.privateTitle':'Still outside the channel?','nl.privateCopy':'One address is all it takes. No noise, two transmissions a month.','nl.soundOn':'Enable ambience','nl.soundOff':'Mute ambience','nl.skipToForm':'Skip to the signup form',
  'ct.kicker':'Talk to ISKRA','ct.title':'Tell us what the night needs.','ct.lead':'Tables, birthdays, bookings and partnerships all start with a message here.','ct.reply':'We reply within one working day','ct.replyCopy':'Monday to Friday, and same night for door questions before 22:00.','ct.pick':'What is it about?','ct.form':'Send a message','ct.optional':'optional','ct.date':'Preferred event date','ct.group':'Group size','ct.groupHint':'People in your party','ct.send':'Send message','ct.sending':'Sending…','ct.sentTitle':'Message received.','ct.sentCopy':'A member of the ISKRA team will answer at {email}. Keep an eye on your spam folder for the first reply.','ct.sentAnother':'Send another message','ct.errName':'Please enter your name.','ct.errEmail':'That email does not look right.','ct.errMessage':'Please write a little more, at least a sentence.','ct.errDate':'That date is not valid.','ct.errGroup':'Enter a group size between 1 and 500.','ct.errRate':'Too many messages just now. Try again in a minute.','ct.errNetwork':'No connection. Your message was kept, try sending again.','ct.errServer':'Something broke on our side. Your message was kept, try again.','ct.direct':'Direct','ct.follow':'Follow','ct.cat.general':'General questions','ct.cat.birthday':'Birthday and groups','ct.cat.table':'Table reservations','ct.cat.booking':'Artist and DJ booking','ct.cat.venue':'Venue partnership','ct.cat.brand':'Brand collaboration','ct.cat.press':'Press and media','ct.sub.general':'General question','ct.sub.birthday':'Birthday / group request','ct.sub.table':'Table reservation','ct.sub.booking':'Artist / DJ booking','ct.sub.venue':'Venue partnership','ct.sub.brand':'Brand collaboration','ct.sub.press':'Press and media','ct.faq':'Before you write','ct.faqTables':'How do I book a table?','ct.faqTablesA':'Pick Table reservations above, tell us the date and how many people. VIP tables seat four and bottles are 20% off.','ct.faqBirthday':'Do you host birthdays?','ct.faqBirthdayA':'Yes. Choose Birthday and groups, give us the date and party size, and we send private group pricing.','ct.faqDress':'Is there a dress code?','ct.faqDressA':'No formal code. Come as you are, but the door may turn away anything that spoils the room.','ct.faqAge':'What is the age limit?','ct.faqAgeA':'18 and over, photo ID checked at the door every night.','ct.faqRefund':'Can I refund a ticket?','ct.faqRefundA':'Tickets are transferable up to the day of the event. Write to us with your QR reference and we will move it.','ct.faqAccess':'Is the venue accessible?','ct.faqAccessA':'Step-free entry and an accessible washroom. Message us in advance and the door team will meet you.','ct.faqPartner':'How do partnerships work?','ct.faqPartnerA':'Use Venue partnership or Brand collaboration with a short description. We answer with a deck and available dates.','ct.altDoor':'Guests arriving at the door of a Project ISKRA night in Montréal','ct.altBar':'Bartender pouring at the bar during a Project ISKRA night','ct.altTable':'Friends around a table at a Project ISKRA night',
  'of.kicker':'Campaigns','of.title':'Cheaper ways through the door.','of.lead':'Live promo codes, group deals and resident nights. Every discount is applied and recalculated at Stripe checkout.','of.howTitle':'How the codes work','of.how1':'Copy a code from this page.','of.how2':'Open any ticket on the schedule.','of.how3':'Paste it at checkout, the price updates before you pay.','of.serverNote':'Discounts are validated and recalculated on our server at checkout, never in your browser.','of.copy':'Copy code','of.copied':'Code copied','of.apply':'Apply at checkout','of.status.live':'Live','of.status.scheduled':'Starting soon','of.status.expired':'Expired','of.off':'{percent}% off','of.limit':'Up to {count} tickets','of.until':'Until {date}','of.from':'From {date}','of.allEvents':'All nights','of.loading':'Loading campaigns…','of.empty':'No public campaigns right now.','of.emptyCopy':'Join the promo list and the next code lands in your inbox before it goes public.','of.error':'Campaigns could not load.','of.retry':'Try again','of.expiredNote':'This campaign has ended.','of.kind.early':'Early tickets','of.kind.group':'Groups','of.kind.resident':'Resident nights','of.kind.table':'Tables and birthdays','of.kind.reward':'Spark Rush','of.privateTitle':'Private offers','of.privateCopy':'Birthdays, booths and group rates are quoted per party. Write to the team and we answer with a price.','of.privateCta':'Ask about a private offer','of.sparkTitle':'Win your own code','of.sparkCopy':'Spark Rush rewards are unique to the player who earned them and never appear on this page.','of.sparkCta':'Play for tickets','of.altHero':'The bar during a Project ISKRA night at Muzique, Montréal','of.altEarly':'Door host welcoming guests at a Project ISKRA night','of.altGroup':'A group of friends together at a Project ISKRA night','of.altResident':'Bottles behind the bar on a resident night','of.altTable':'Friends celebrating around a table at Project ISKRA','of.altSpark':'Dancing at a Project ISKRA night','of.altNewsletter':'Late night on the terrace outside a Project ISKRA night',
  'arcade.enter':'Enter the spark','arcade.subtitle':'Sixty seconds. Catch the sparks, hold the multiplier, take the board.','arcade.start':'Start game','arcade.insert':'Insert credit','arcade.credits':'Credits','arcade.today':'today','arcade.reward':'Your tier','arcade.noReward':'Not qualified yet','arcade.liveBoard':'Live board','arcade.rank':'Rank','arcade.you':'You','arcade.unranked':'Unranked','arcade.attractHint':'Press start','arcade.pause':'Pause','arcade.resume':'Resume','arcade.soundOn':'Sound on','arcade.soundOff':'Sound off','arcade.paused':'Paused','arcade.combo':'Combo','arcade.boardEmpty':'No scores yet.','arcade.boardEmptyCopy':'The board is open. The first finished round takes rank one.','arcade.boardError':'Leaderboard unavailable.','arcade.retry':'Try again','arcade.offline':'You are offline. Scores will not save.','arcade.updated':'Updated','arcade.nameBlocked':'Choose another display name.','arcade.nameLength':'Use 3 to 18 characters.','arcade.nameLetters':'Use at least one letter.','arcade.checking':'Checking…','arcade.newBest':'New personal best','arcade.rewardUnlocked':'Reward unlocked','arcade.targets':'Targets hit','arcade.accuracy':'Accuracy',
  'language.label':'Choose language','language.en':'English','language.uk':'Ukrainian','language.ru':'Russian',
  'nav.schedule':'Schedule','nav.gallery':'Gallery','nav.offers':'Offers','nav.play':'Play','nav.about':'About','nav.contact':'Contact','nav.dating':'Dating','nav.account':'Account','nav.tickets':'My tickets','nav.getTickets':'Get tickets','nav.open':'Open menu','nav.close':'Close menu',
  'common.viewSchedule':'View schedule','common.joinList':'Join promo list','common.loading':'Loading','common.sending':'Sending','common.send':'Send message','common.reserved':'Reserved','common.free':'Free','common.copy':'Copy',
  'home.latest':'Latest event: August 28','home.venue':'Muzique Nightclub · Montreal','home.doors':'18+ · Doors 23:00','home.title1':'Nights that','home.title2':'catch fire','home.lead':"ISKRA is a spark, a room, and a sound system that refuses to behave. Raw techno, deep house and the residents who built this city's floor — until the lights come up.",'home.lastEvent':'Last event','home.next':'Next up','home.opening':'Grand Opening','home.recap':'Recap live','home.sale':'On sale','home.selling':'Selling fast','home.signup':'Sign up','home.days':'Days','home.hours':'Hrs','home.minutes':'Min','home.seconds':'Sec',
  'home.eventEyebrow':'Latest ISKRA night','home.eventTitle':'Grand opening at Muzique','home.eventLead':'August 28 was the first public spark: DJ MLNK, Slavic Music, and a full room at 3781 Boulevard Saint-Laurent. The next schedule will be posted by the team from admin.','home.eventChip':'28 August · Muzique Nightclub','home.eventSignal':'Last event, first signal.','home.eventCopy':'Real photos from the room now carry the site. The public schedule stays quiet until the team posts the next night.','home.posterAlt':'Project ISKRA grand opening poster','home.photoAlt':'Project ISKRA event photo {number}',
  'stats.capacity':'Capacity','stats.rig':'Funktion-One rig','stats.record':'Last record','stats.nights':'Nights a year','marquee.machines':'Live machines','marquee.doors':'Doors 23:00','marquee.phones':'No phones on the floor','marquee.six':'Open till six',
  'schedule.eyebrow':'Schedule','schedule.title':'Next nights post here.','schedule.lead':'The public page shows only schedule items the team is ready to promote.','schedule.latest':'Latest event','schedule.empty':'New schedule coming soon.','schedule.emptyCopy':'The grand opening was August 28 at Muzique. Join the promo list for the next announcement.','events.title':'Upcoming nights','events.all':'All','events.techno':'Techno','events.house':'House','events.live':'Live','events.freeEntry':'Free entry','events.empty':'Nothing on sale in that category yet. Try another filter.','events.soldOut':'Sold out','events.none':'Nothing left','events.now':'On sale now','events.gone':'{percent}% gone','events.tickets':'Get tickets','events.till':'till 03:00','events.hot':'Selling fast','events.new':'Just announced',
  'about.kicker':'Project ISKRA · Montréal','about.title':'A night built around people.','about.lead':'Slavic energy, Montréal hospitality, and a room where strangers become the crowd.','about.story':'Our story','about.why':'Why we started','about.flyer':'More than a name on a flyer.','about.spark':'ISKRA means spark. For us, it is the exact moment a room stops feeling like a venue and starts feeling like it belongs to everyone in it.','about.copy':'We started Project ISKRA to make social nights with care in every layer: the music, the welcome at the door, the people behind the bar, and the visual world around it. Each edition responds to its venue and its crowd.','about.welcome':'The welcome starts before the music.','about.inside':'Inside the last night','about.this':'This is ISKRA.','about.real':'Not staged. Not stock. Photographs from the people and places that made our first chapter.','about.guides':'What guides every night','about.room':'The room','about.roomCopy':'We choose spaces with character, then let their mood shape the night.','about.sound':'The sound','about.soundCopy':'Selectors who read a crowd, move with it, and never play on autopilot.','about.people':'The people','about.peopleCopy':'A warm door, an open floor, and a crowd that makes room for one another.','about.next':'The next chapter','about.invite':'Come as you are.\nLeave part of the story.','about.guest':'Join the guest list','about.work':'Work with us',
  'contact.eyebrow':'Contact','contact.title':'Talk to the team.','contact.lead':'Bookings, birthdays, table requests, brand partnerships, media, and venue ideas.','contact.name':'Name','contact.email':'Email','contact.subject':'Subject','contact.message':'Message','contact.promo':'For promotion offers','contact.promoCopy':'Use the form and mention your group size, date, and preferred venue area. Messages appear in the admin inbox.','contact.sent':'Message sent. The ISKRA team will reply from the inbox.','contact.defaultSubject':'Booking / promotion',
  'offers.eyebrow':'Offers','offers.title':'Promos before the door.','offers.lead':'Presale codes, group offers, birthday lists, and first-access drops.','newsletter.eyebrow':'Mailing list','newsletter.title':'Get the next spark first.','newsletter.lead':'Promo letters, early links, and private group offers from Project ISKRA.','newsletter.heading':'Get the drops\nbefore the algorithm','newsletter.copy':'Lineups, presale codes and the occasional secret address. Two emails a month, no filler.','newsletter.email':'Email address','newsletter.adding':'Adding','newsletter.subscribe':'Subscribe','newsletter.success':'You are on the list. Presale codes land in your inbox first.','newsletter.promotion':'Promotion','newsletter.presale':'Presale codes before Instagram','newsletter.presaleCopy':'Join the list and get the first ticket window before the poster goes public.','newsletter.birthday':'Birthday and group tables','newsletter.birthdayCopy':'Leave your email and we will send private offers for birthdays, crews, and early arrivals.','newsletter.offers':'Get offers',
  'gallery.eyebrow':'Moments from the room','gallery.title':'After the spark.','gallery.lead':'Real people, warm light, and the frames that stayed with us after the doors closed.','gallery.alt':'Project ISKRA event moment {number}',
  'tickets.saved':'Saved on this device','tickets.title':'My tickets.','tickets.lead':'Your QR codes stay here after reservation. Have the active ticket open when you reach the door.','tickets.loading':'Loading your tickets…','tickets.failed':'Tickets could not load.','tickets.none':'No saved tickets','tickets.first':'Your first QR will appear here.','tickets.firstCopy':'Reserve from the schedule on this device and the ticket will be stored automatically.','tickets.feedback':'Share feedback','tickets.overall':'Overall','tickets.music':'Music','tickets.venue':'Venue','tickets.comment':'What should we keep or change?','tickets.saving':'Saving','tickets.sendFeedback':'Send feedback','tickets.feedbackSaved':'Feedback saved. Thank you for being part of the night.','tickets.qrAlt':'QR code for {reference}',
  'checkout.holder':'Ticket holder','checkout.name':'Full name','checkout.receipt':'Email receipt','checkout.quantity':'Quantity','checkout.quantityHint':'Discounts apply to the selected tickets','checkout.youSave':'You save {amount}','checkout.ticketEquivalent':'That saving equals {count} ticket(s) at this price','checkout.code':'Promo code','checkout.apply':'Apply','checkout.total':'Total','checkout.issuing':'Issuing QR…','checkout.redirecting':'Opening secure checkout…','checkout.reserve':'Reserve & issue QR →','checkout.pay':'Pay securely with Stripe →','checkout.secureNote':'SECURE PAYMENT POWERED BY STRIPE · QR ISSUED AFTER PAYMENT','checkout.freeNote':'NO PAYMENT REQUIRED · QR ISSUED IMMEDIATELY','checkout.ready':'Ticket ready','checkout.oneReady':'Your QR is ready.','checkout.manyReady':'{count} tickets are ready.','checkout.saved':'The tickets are saved on this device. Open My tickets whenever you need them at the door.','checkout.open':'Open my tickets','checkout.close':'Close',
  'play.eyebrow':'Play','play.title':'Win cheaper tickets.','play.lead':'Spark Rush stays on its own page, so the landing page can stay focused.',
  'promo.first':'NEXT NIGHT ANNOUNCEMENTS GO TO THE MAILING LIST FIRST','promo.wallet':'YOUR QR TICKETS STAY SAVED ON THIS DEVICE','promo.groups':'GROUP AND BIRTHDAY REQUESTS ARE OPEN THROUGH CONTACT','promo.gallery':'REAL MOMENTS FROM THE LAST ISKRA NIGHT ARE NOW IN THE GALLERY','promo.paused':'ISKRA EVENTS ARE PAUSED · THE NEXT UPDATE WILL BE POSTED HERE',
  'footer.nights':'Nights','footer.visit':'Visit','footer.follow':'Follow','footer.decent':'Be decent to each other.','footer.rights':'ISKRA. All nights reserved.','footer.about':'About us','footer.play':'Play for tickets','footer.list':'Mailing list'
  ,'offers.section':'Cheaper ways through the door','offers.ends':'Ends Sunday 23:59','offers.early':'Early bird burns first','offers.earlyCopy':'Reserve early before door pricing takes over.','offers.four':'Four in, one free','offers.fourCopy':'Come with four and one ticket is on us.','offers.resident':'Resident night offer','offers.residentCopy':'Special pricing for selected resident nights.','offers.copied':'Code {code} copied','play.section':'Play for tickets','play.sectionCopy':'Sixty seconds of Spark Rush. Catch the embers and climb into the prize zone.','play.first':'First place','play.firstHead':'10 dollar ticket','play.firstCopy':'Any single night this season, any tier.','play.top':'Second to fifth','play.topHead':'Half price','play.topCopy':'Fifty percent off up to two tickets.','play.all':'Everyone else','play.allHead':'Ten percent off','play.allCopy':'For showing up and playing.','play.loading':'Loading the board','play.saving':'Saving your score','play.cheap':'Play for cheap tickets','play.signupCopy':'Sign up, take your three shots, land in the top five.','play.name':'Display name','play.namePlaceholder':'How the board should know you','play.consent':'I am 18 or over and want lineup news and my prize code by email.','play.checking':'Checking','play.enter':'Enter the leaderboard','play.instructions':'Catch orange embers. Pale ones pay triple and dark ones cost you.','play.attempts':'{name}, {count} attempt(s) left today','play.start':'Start round','play.spent':'Out of attempts','play.spentCopy':'All three shots are used today. The board resets at midnight.','play.other':'See other offers','play.final':'Final score','play.rank':'Rank {rank}, best {best}','play.again':'Again ({count})','play.use':'Use my code','play.orange':'Orange, 100 points','play.pale':'Pale, triple','play.dark':'Dark, penalty','play.miss':'Missing resets the multiplier','play.board':'Leaderboard','play.topWin':'Top 5 win','play.empty':'No scores yet. Be the first.','play.you':'You','play.left':'{count} of 3 attempts left today','play.signUpAttempts':'Sign up to take your three attempts','play.season':'Season closes 20 September. Ties go to the earliest score.','play.signOut':'Sign out on this device','play.score':'Score','play.multiplier':'Multiplier','play.time':'Time'
};

const uk={
  'sale.noneTitle':'Зараз немає квитків у продажу.','sale.noneCopy':'Наступний вечір ще не опубліковано. Приєднуйтесь до розсилки — отримаєте посилання раніше за публічний анонс.','sale.seeSchedule':'Переглянути розклад','sale.joinList':'Приєднатися до розсилки',
  'nl.incoming':'Вхідна передача','nl.title':'Спіймайте наступний сигнал','nl.lead':'Підписники отримують анонси подій, приватні адреси та коди передпродажу раніше за всіх.','nl.emailLabel':'Електронна пошта','nl.placeholder':'you@email.com','nl.subscribe':'Відкрити канал','nl.sending':'Передаємо…','nl.okTitle':'Передачу отримано.','nl.okCopy':'{email} на каналі. Наступний сигнал прийде до вас раніше за публічний реліз.','nl.okAgain':'Додати іншу адресу','nl.dupTitle':'Ви вже на каналі.','nl.dupCopy':'{email} уже отримує передачі ISKRA. Більше нічого робити не треба.','nl.errEmail':'На цю адресу сигнал не дійде. Перевірте її та спробуйте ще раз.','nl.errOffline':'Немає звʼязку з ретранслятором. Адресу збережено, спробуйте ще раз.','nl.errRate':'Забагато передач. Зачекайте трохи та спробуйте знову.','nl.errServer':'Ретранслятор загубив сигнал. Адресу збережено, спробуйте ще раз.','nl.statusIdle':'Канал готовий','nl.signal':'Сигнал','nl.channel':'Канал','nl.coords':'Координати','nl.freq':'Частота','nl.live':'В ефірі','nl.locked':'Закрито','nl.receiveTitle':'Перехоплено з каналу','nl.receiveLead':'Пʼять типів сигналу йдуть підписникам. Ось як вони виглядають.','nl.r1':'Коди передпродажу','nl.r1c':'Коди зі знижкою приходять на канал раніше за публічний постер.','nl.r2':'Приватні локації','nl.r2c':'Адреси вечорів без анонсу — тільки для списку.','nl.r3':'Анонси подій','nl.r3c':'Лайнапи й дати щойно команда їх затверджує.','nl.r4':'Пропозиції на день народження','nl.r4c':'Ціни на столики та групи для вашого вечора, приватно.','nl.r5':'Оновлення лайнапу','nl.r5c':'Запрошені селектори та b2b-сети — спершу на каналі.','nl.timelineTitle':'Коли сигнал дійде до вас','nl.timelineLead':'Той самий вечір, три різні моменти.','nl.tl1':'Канал','nl.tl1c':'Ви дізнаєтесь першими, разом із кодом.','nl.tl2':'Instagram','nl.tl2c':'Постер стає публічним.','nl.tl3':'Публічний реліз','nl.tl3c':'Квитки відкриті для всіх, за повною ціною.','nl.tlNow':'Зараз','nl.tlLater':'+48 годин','nl.tlLast':'+72 години','nl.privateTitle':'Досі поза каналом?','nl.privateCopy':'Достатньо однієї адреси. Без шуму, дві передачі на місяць.','nl.soundOn':'Увімкнути ембієнт','nl.soundOff':'Вимкнути ембієнт','nl.skipToForm':'Перейти до форми підписки',
  'ct.kicker':'Напиши ISKRA','ct.title':'Розкажи, якою має бути ніч.','ct.lead':'Столики, дні народження, бронювання та партнерства починаються з повідомлення тут.','ct.reply':'Відповідаємо протягом одного робочого дня','ct.replyCopy':'З понеділка до пʼятниці, а на питання про вхід — того ж вечора до 22:00.','ct.pick':'Про що йдеться?','ct.form':'Надіслати повідомлення','ct.optional':'необовʼязково','ct.date':'Бажана дата події','ct.group':'Кількість гостей','ct.groupHint':'Скільки вас буде','ct.send':'Надіслати','ct.sending':'Надсилаємо…','ct.sentTitle':'Повідомлення отримано.','ct.sentCopy':'Команда ISKRA відповість на {email}. Перевірте також теку зі спамом.','ct.sentAnother':'Написати ще раз','ct.errName':'Вкажіть імʼя.','ct.errEmail':'Ця пошта виглядає некоректно.','ct.errMessage':'Напишіть трохи більше, хоча б одне речення.','ct.errDate':'Ця дата некоректна.','ct.errGroup':'Вкажіть від 1 до 500 гостей.','ct.errRate':'Забагато повідомлень. Спробуйте за хвилину.','ct.errNetwork':'Немає зʼєднання. Текст збережено, спробуйте ще раз.','ct.errServer':'Помилка на нашому боці. Текст збережено, спробуйте ще раз.','ct.direct':'Напряму','ct.follow':'Ми в мережі','ct.cat.general':'Загальні питання','ct.cat.birthday':'День народження та групи','ct.cat.table':'Бронювання столика','ct.cat.booking':'Букінг артистів і діджеїв','ct.cat.venue':'Партнерство з майданчиком','ct.cat.brand':'Бренд-колаборація','ct.cat.press':'Преса та медіа','ct.sub.general':'Загальне питання','ct.sub.birthday':'День народження / група','ct.sub.table':'Бронювання столика','ct.sub.booking':'Букінг артиста','ct.sub.venue':'Партнерство з майданчиком','ct.sub.brand':'Бренд-колаборація','ct.sub.press':'Преса та медіа','ct.faq':'Перед тим як писати','ct.faqTables':'Як забронювати столик?','ct.faqTablesA':'Оберіть «Бронювання столика», вкажіть дату й кількість гостей. VIP-стіл розрахований на чотирьох, пляшки зі знижкою 20%.','ct.faqBirthday':'Ви проводите дні народження?','ct.faqBirthdayA':'Так. Оберіть «День народження та групи», вкажіть дату й кількість гостей — надішлемо приватні ціни.','ct.faqDress':'Чи є дрес-код?','ct.faqDressA':'Формального немає. Приходьте як є, але вхід може відмовити, якщо вигляд псує атмосферу.','ct.faqAge':'Яке вікове обмеження?','ct.faqAgeA':'18+, документ перевіряють на вході щоночі.','ct.faqRefund':'Чи можна повернути квиток?','ct.faqRefundA':'Квиток можна передати іншій людині до дня події. Напишіть нам номер QR — перенесемо.','ct.faqAccess':'Чи доступний майданчик?','ct.faqAccessA':'Вхід без сходів і доступна вбиральня. Напишіть заздалегідь — команда зустріне вас.','ct.faqPartner':'Як працюють партнерства?','ct.faqPartnerA':'Оберіть «Партнерство» або «Бренд-колаборація» з коротким описом. Відповідаємо презентацією й вільними датами.','ct.altDoor':'Гості біля входу на вечір Project ISKRA у Монреалі','ct.altBar':'Бармен наливає напій під час вечора Project ISKRA','ct.altTable':'Друзі за столом на вечорі Project ISKRA',
  'of.kicker':'Кампанії','of.title':'Дешевші шляхи всередину.','of.lead':'Активні промокоди, групові пропозиції та вечори резидентів. Кожна знижка застосовується й перераховується під час оплати Stripe.','of.howTitle':'Як працюють коди','of.how1':'Скопіюйте код із цієї сторінки.','of.how2':'Відкрийте будь-який квиток у розкладі.','of.how3':'Вставте код при оплаті — ціна оновиться до платежу.','of.serverNote':'Знижки перевіряються й перераховуються на нашому сервері під час оплати, а не у браузері.','of.copy':'Копіювати код','of.copied':'Код скопійовано','of.apply':'Застосувати при оплаті','of.status.live':'Активна','of.status.scheduled':'Скоро старт','of.status.expired':'Завершена','of.off':'-{percent}%','of.limit':'До {count} квитків','of.until':'До {date}','of.from':'Від {date}','of.allEvents':'Усі вечори','of.loading':'Завантаження кампаній…','of.empty':'Публічних кампаній зараз немає.','of.emptyCopy':'Приєднайтесь до розсилки — наступний код прийде раніше за публікацію.','of.error':'Не вдалося завантажити кампанії.','of.retry':'Спробувати ще','of.expiredNote':'Ця кампанія завершилася.','of.kind.early':'Ранні квитки','of.kind.group':'Групи','of.kind.resident':'Вечори резидентів','of.kind.table':'Столики й дні народження','of.kind.reward':'Spark Rush','of.privateTitle':'Приватні пропозиції','of.privateCopy':'Дні народження, ложі та групові тарифи рахуємо окремо. Напишіть команді — відповімо з ціною.','of.privateCta':'Запитати приватну пропозицію','of.sparkTitle':'Виграй власний код','of.sparkCopy':'Нагороди Spark Rush належать лише гравцю, який їх здобув, і ніколи не зʼявляються на цій сторінці.','of.sparkCta':'Грати за квитки','of.altHero':'Бар під час вечора Project ISKRA у Muzique, Монреаль','of.altEarly':'Хост зустрічає гостей на вечорі Project ISKRA','of.altGroup':'Компанія друзів на вечорі Project ISKRA','of.altResident':'Пляшки за барною стійкою на вечорі резидентів','of.altTable':'Друзі святкують за столом на Project ISKRA','of.altSpark':'Танці на вечорі Project ISKRA','of.altNewsletter':'Пізня ніч на терасі біля Project ISKRA',
  'arcade.enter':'Увійди в іскру','arcade.subtitle':'Шістдесят секунд. Лови іскри, тримай множник, забирай таблицю.','arcade.start':'Почати гру','arcade.insert':'Вкинь жетон','arcade.credits':'Спроби','arcade.today':'сьогодні','arcade.reward':'Твій рівень','arcade.noReward':'Ще без нагороди','arcade.liveBoard':'Жива таблиця','arcade.rank':'Місце','arcade.you':'Ти','arcade.unranked':'Поза таблицею','arcade.attractHint':'Натисни старт','arcade.pause':'Пауза','arcade.resume':'Продовжити','arcade.soundOn':'Звук увімкнено','arcade.soundOff':'Звук вимкнено','arcade.paused':'Пауза','arcade.combo':'Комбо','arcade.boardEmpty':'Ще немає результатів.','arcade.boardEmptyCopy':'Таблиця відкрита. Перший завершений раунд бере перше місце.','arcade.boardError':'Таблиця недоступна.','arcade.retry':'Спробувати ще','arcade.offline':'Немає зʼєднання. Результат не збережеться.','arcade.updated':'Оновлено','arcade.nameBlocked':'Оберіть інше імʼя.','arcade.nameLength':'Використайте від 3 до 18 символів.','arcade.nameLetters':'Додайте хоча б одну літеру.','arcade.checking':'Перевірка…','arcade.newBest':'Новий особистий рекорд','arcade.rewardUnlocked':'Нагороду відкрито','arcade.targets':'Влучань','arcade.accuracy':'Точність',
  'language.label':'Оберіть мову','language.en':'Англійська','language.uk':'Українська','language.ru':'Російська',
  'nav.schedule':'Розклад','nav.gallery':'Галерея','nav.offers':'Пропозиції','nav.play':'Грати','nav.about':'Про нас','nav.contact':'Контакти','nav.dating':'Dating','nav.account':'Акаунт','nav.tickets':'Мої квитки','nav.getTickets':'Купити квитки','nav.open':'Відкрити меню','nav.close':'Закрити меню',
  'common.viewSchedule':'Переглянути розклад','common.joinList':'Приєднатися до списку','common.loading':'Завантаження','common.sending':'Надсилання','common.send':'Надіслати','common.reserved':'Заброньовано','common.free':'Безкоштовно','common.copy':'Копіювати',
  'home.latest':'Остання подія: 28 серпня','home.venue':'Muzique Nightclub · Монреаль','home.doors':'18+ · Двері о 23:00','home.title1':'Ночі, що','home.title2':'запалюють','home.lead':'ISKRA — це іскра, простір і звук, який неможливо приборкати. Сирий техно, deep house та резиденти Монреаля — до самого світанку.','home.lastEvent':'Остання подія','home.next':'Далі','home.opening':'Grand Opening','home.recap':'Дивитися звіт','home.sale':'У продажу','home.selling':'Швидко продається','home.signup':'Підписатися','home.days':'Дні','home.hours':'Год','home.minutes':'Хв','home.seconds':'Сек',
  'home.eventEyebrow':'Остання ніч ISKRA','home.eventTitle':'Grand Opening у Muzique','home.eventLead':'28 серпня відбулася перша публічна ISKRA: DJ MLNK, Slavic Music і повна зала за адресою 3781 Boulevard Saint-Laurent. Наступну подію команда опублікує через адмінпанель.','home.eventChip':'28 серпня · Muzique Nightclub','home.eventSignal':'Остання подія. Перший сигнал.','home.eventCopy':'Сайт наповнений справжніми фото з події. Публічний розклад залишається порожнім, доки команда не оголосить наступну ніч.','home.posterAlt':'Афіша відкриття Project ISKRA','home.photoAlt':'Фото з події Project ISKRA {number}',
  'stats.capacity':'Місткість','stats.rig':'Система Funktion-One','stats.record':'Останній трек','stats.nights':'Ночей на рік','marquee.machines':'Живі машини','marquee.doors':'Двері о 23:00','marquee.phones':'Без телефонів на танцполі','marquee.six':'Відкрито до шостої',
  'schedule.eyebrow':'Розклад','schedule.title':'Наступні ночі з’являться тут.','schedule.lead':'Тут показані лише події, які команда вже готова анонсувати.','schedule.latest':'Остання подія','schedule.empty':'Новий розклад незабаром.','schedule.emptyCopy':'Grand Opening відбулося 28 серпня у Muzique. Підпишіться, щоб першими дізнатися про наступну подію.','events.title':'Майбутні події','events.all':'Усі','events.techno':'Техно','events.house':'Хаус','events.live':'Лайв','events.freeEntry':'Вільний вхід','events.empty':'У цій категорії поки немає квитків. Оберіть інший фільтр.','events.soldOut':'Продано','events.none':'Місць немає','events.now':'У продажу','events.gone':'Продано {percent}%','events.tickets':'Купити квитки','events.till':'до 03:00','events.hot':'Швидко продається','events.new':'Щойно оголошено',
  'about.kicker':'Project ISKRA · Монреаль','about.title':'Ніч, створена навколо людей.','about.lead':'Слов’янська енергія, монреальська гостинність і простір, де незнайомці стають однією компанією.','about.story':'Наша історія','about.why':'Чому ми почали','about.flyer':'Більше, ніж назва на афіші.','about.spark':'ISKRA означає іскру. Для нас це мить, коли простір перестає бути просто закладом і стає спільним для всіх у ньому.','about.copy':'Ми створили Project ISKRA, щоб кожна деталь соціальної ночі була продумана: музика, зустріч на вході, команда бару та візуальний світ. Кожна подія реагує на свій простір і свою публіку.','about.welcome':'Атмосфера починається ще до музики.','about.inside':'Усередині останньої ночі','about.this':'Це ISKRA.','about.real':'Не постановка. Не сток. Справжні кадри людей і місць, що створили наш перший розділ.','about.guides':'Що визначає кожну ніч','about.room':'Простір','about.roomCopy':'Ми обираємо місця з характером і дозволяємо їхньому настрою формувати ніч.','about.sound':'Звук','about.soundCopy':'Діджеї, які відчувають публіку, рухаються разом із нею і не грають на автопілоті.','about.people':'Люди','about.peopleCopy':'Тепла зустріч, відкритий танцпол і публіка, що залишає місце одне для одного.','about.next':'Наступний розділ','about.invite':'Приходьте такими, як є.\nСтаньте частиною історії.','about.guest':'До списку гостей','about.work':'Працювати з нами',
  'contact.eyebrow':'Контакти','contact.title':'Поговоріть із командою.','contact.lead':'Бронювання, дні народження, столики, партнерства, медіа та ідеї для локацій.','contact.name':'Ім’я','contact.email':'Email','contact.subject':'Тема','contact.message':'Повідомлення','contact.promo':'Щодо промопропозицій','contact.promoCopy':'Вкажіть у формі розмір групи, дату та бажану зону. Повідомлення з’явиться в адмінпанелі.','contact.sent':'Повідомлення надіслано. Команда ISKRA відповість електронною поштою.','contact.defaultSubject':'Бронювання / промо',
  'offers.eyebrow':'Пропозиції','offers.title':'Промо до входу.','offers.lead':'Коди передпродажу, групові пропозиції, дні народження та ранній доступ.','newsletter.eyebrow':'Розсилка','newsletter.title':'Отримайте наступну іскру першими.','newsletter.lead':'Промолисти, ранні посилання та приватні групові пропозиції від Project ISKRA.','newsletter.heading':'Отримуйте анонси\nраніше за алгоритм','newsletter.copy':'Лайнапи, коди передпродажу та іноді секретна адреса. Два листи на місяць, без зайвого.','newsletter.email':'Електронна адреса','newsletter.adding':'Додаємо','newsletter.subscribe':'Підписатися','newsletter.success':'Ви у списку. Коди передпродажу спершу надійдуть на вашу пошту.','newsletter.promotion':'Промо','newsletter.presale':'Коди передпродажу до Instagram','newsletter.presaleCopy':'Приєднуйтесь і отримайте перше вікно продажу до публікації афіші.','newsletter.birthday':'Дні народження та групові столи','newsletter.birthdayCopy':'Залиште email, і ми надішлемо приватні пропозиції для свят, компаній та раннього входу.','newsletter.offers':'Отримати пропозиції',
  'gallery.eyebrow':'Моменти з події','gallery.title':'Після іскри.','gallery.lead':'Справжні люди, тепле світло й кадри, що залишилися з нами після закриття дверей.','gallery.alt':'Момент із події Project ISKRA {number}',
  'tickets.saved':'Збережено на цьому пристрої','tickets.title':'Мої квитки.','tickets.lead':'QR-коди залишаються тут після бронювання. Відкрийте активний квиток перед входом.','tickets.loading':'Завантажуємо квитки…','tickets.failed':'Не вдалося завантажити квитки.','tickets.none':'Немає збережених квитків','tickets.first':'Ваш перший QR з’явиться тут.','tickets.firstCopy':'Забронюйте квиток із розкладу на цьому пристрої, і він збережеться автоматично.','tickets.feedback':'Залишити відгук','tickets.overall':'Загалом','tickets.music':'Музика','tickets.venue':'Локація','tickets.comment':'Що нам варто зберегти або змінити?','tickets.saving':'Зберігаємо','tickets.sendFeedback':'Надіслати відгук','tickets.feedbackSaved':'Відгук збережено. Дякуємо, що були частиною ночі.','tickets.qrAlt':'QR-код квитка {reference}',
  'checkout.holder':'Власник квитка','checkout.name':'Ім’я та прізвище','checkout.receipt':'Email для підтвердження','checkout.quantity':'Кількість','checkout.quantityHint':'Знижка діє на вибрані квитки','checkout.youSave':'Ви заощаджуєте {amount}','checkout.ticketEquivalent':'Ця економія дорівнює {count} квитка(м) за цією ціною','checkout.code':'Промокод','checkout.apply':'Застосувати','checkout.total':'Разом','checkout.issuing':'Створюємо QR…','checkout.redirecting':'Відкриваємо безпечну оплату…','checkout.reserve':'Забронювати й отримати QR →','checkout.pay':'Безпечно оплатити через Stripe →','checkout.secureNote':'БЕЗПЕЧНА ОПЛАТА ЧЕРЕЗ STRIPE · QR ПІСЛЯ ПІДТВЕРДЖЕННЯ','checkout.freeNote':'ОПЛАТА НЕ ПОТРІБНА · QR СТВОРЮЄТЬСЯ ОДРАЗУ','checkout.ready':'Квиток готовий','checkout.oneReady':'Ваш QR готовий.','checkout.manyReady':'Готово квитків: {count}.','checkout.saved':'Квитки збережені на цьому пристрої. Відкрийте «Мої квитки» перед входом.','checkout.open':'Відкрити мої квитки','checkout.close':'Закрити',
  'play.eyebrow':'Гра','play.title':'Виграйте дешевші квитки.','play.lead':'Spark Rush має окрему сторінку, щоб головна залишалася сфокусованою.','promo.first':'АНОНСИ НАСТУПНИХ ПОДІЙ СПОЧАТКУ З’ЯВЛЯЮТЬСЯ В РОЗСИЛЦІ','promo.wallet':'ВАШІ QR-КВИТКИ ЗБЕРІГАЮТЬСЯ НА ЦЬОМУ ПРИСТРОЇ','promo.groups':'ГРУПОВІ ЗАПИТИ ТА ДНІ НАРОДЖЕННЯ — ЧЕРЕЗ СТОРІНКУ КОНТАКТІВ','promo.gallery':'СПРАВЖНІ МОМЕНТИ З ОСТАННЬОЇ ISKRA ВЖЕ В ГАЛЕРЕЇ','promo.paused':'ПОДІЇ ISKRA ПРИЗУПИНЕНО · НАСТУПНЕ ОНОВЛЕННЯ З’ЯВИТЬСЯ ТУТ','footer.nights':'Події','footer.visit':'Відвідати','footer.follow':'Стежити','footer.decent':'Поважайте одне одного.','footer.rights':'ISKRA. Усі ночі захищено.','footer.about':'Про нас','footer.play':'Грати за квитки','footer.list':'Розсилка'
  ,'offers.section':'Дешевший шлях на подію','offers.ends':'До неділі 23:59','offers.early':'Ранній квиток згорає першим','offers.earlyCopy':'Бронюйте заздалегідь, поки не почала діяти ціна на вході.','offers.four':'Четверо заходять — один безкоштовно','offers.fourCopy':'Приходьте вчотирьох, і один квиток за наш рахунок.','offers.resident':'Пропозиція резидентської ночі','offers.residentCopy':'Спеціальна ціна для вибраних ночей.','offers.copied':'Код {code} скопійовано','play.section':'Грайте за квитки','play.sectionCopy':'Шістдесят секунд Spark Rush. Ловіть іскри та піднімайтеся в призову зону.','play.first':'Перше місце','play.firstHead':'Квиток за 10 доларів','play.firstCopy':'Будь-яка ніч сезону та будь-який рівень.','play.top':'Друге–п’яте місця','play.topHead':'Пів ціни','play.topCopy':'Знижка 50% на два квитки.','play.all':'Усі інші','play.allHead':'Знижка 10%','play.allCopy':'За участь у грі.','play.loading':'Завантажуємо таблицю','play.saving':'Зберігаємо результат','play.cheap':'Грайте за дешеві квитки','play.signupCopy':'Зареєструйтесь, зробіть три спроби та потрапте в топ-5.','play.name':'Ім’я в таблиці','play.namePlaceholder':'Як вас показувати в таблиці','play.consent':'Мені виповнилося 18 років, і я хочу отримувати анонси та призовий код email.','play.checking':'Перевіряємо','play.enter':'Увійти до таблиці','play.instructions':'Ловіть помаранчеві іскри. Світлі дають потрійні бали, темні забирають їх.','play.attempts':'{name}, сьогодні залишилося спроб: {count}','play.start':'Почати раунд','play.spent':'Спроби закінчилися','play.spentCopy':'Сьогодні використані всі три спроби. Таблиця оновиться опівночі.','play.other':'Інші пропозиції','play.final':'Фінальний рахунок','play.rank':'Місце {rank}, найкращий {best}','play.again':'Ще раз ({count})','play.use':'Використати код','play.orange':'Помаранчева — 100 балів','play.pale':'Світла — утричі більше','play.dark':'Темна — штраф','play.miss':'Промах скидає множник','play.board':'Таблиця лідерів','play.topWin':'Топ-5 виграє','play.empty':'Результатів ще немає. Будьте першими.','play.you':'Ви','play.left':'Сьогодні залишилося {count} із 3 спроб','play.signUpAttempts':'Зареєструйтесь, щоб отримати три спроби','play.season':'Сезон завершується 20 вересня. За рівності перемагає ранній результат.','play.signOut':'Вийти на цьому пристрої','play.score':'Рахунок','play.multiplier':'Множник','play.time':'Час'
};

const ru={...uk,
  'sale.noneTitle':'Сейчас билетов в продаже нет.','sale.noneCopy':'Следующий вечер ещё не опубликован. Подпишитесь на рассылку — получите ссылку раньше публичного анонса.','sale.seeSchedule':'Посмотреть расписание','sale.joinList':'Подписаться на рассылку',
  'nl.incoming':'Входящая передача','nl.title':'Поймайте следующий сигнал','nl.lead':'Подписчики получают анонсы событий, приватные адреса и коды предпродажи раньше всех.','nl.emailLabel':'Электронная почта','nl.placeholder':'you@email.com','nl.subscribe':'Открыть канал','nl.sending':'Передаём…','nl.okTitle':'Передача получена.','nl.okCopy':'{email} на канале. Следующий сигнал придёт к вам раньше публичного релиза.','nl.okAgain':'Добавить другой адрес','nl.dupTitle':'Вы уже на канале.','nl.dupCopy':'{email} уже получает передачи ISKRA. Больше ничего делать не нужно.','nl.errEmail':'На этот адрес сигнал не дойдёт. Проверьте его и попробуйте снова.','nl.errOffline':'Нет связи с ретранслятором. Адрес сохранён, попробуйте снова.','nl.errRate':'Слишком много передач. Подождите немного и попробуйте снова.','nl.errServer':'Ретранслятор потерял сигнал. Адрес сохранён, попробуйте снова.','nl.statusIdle':'Канал готов','nl.signal':'Сигнал','nl.channel':'Канал','nl.coords':'Координаты','nl.freq':'Частота','nl.live':'В эфире','nl.locked':'Закрыт','nl.receiveTitle':'Перехвачено с канала','nl.receiveLead':'Пять типов сигнала уходят подписчикам. Вот как они выглядят.','nl.r1':'Коды предпродажи','nl.r1c':'Коды со скидкой приходят на канал раньше публичного постера.','nl.r2':'Приватные локации','nl.r2c':'Адреса вечеров без анонса — только для списка.','nl.r3':'Анонсы событий','nl.r3c':'Лайнапы и даты, как только команда их утверждает.','nl.r4':'Предложения на день рождения','nl.r4c':'Цены на столики и группы для вашего вечера, приватно.','nl.r5':'Обновления лайнапа','nl.r5c':'Приглашённые селекторы и b2b-сеты — сначала на канале.','nl.timelineTitle':'Когда сигнал дойдёт до вас','nl.timelineLead':'Тот же вечер, три разных момента.','nl.tl1':'Канал','nl.tl1c':'Вы узнаёте первыми, вместе с кодом.','nl.tl2':'Instagram','nl.tl2c':'Постер становится публичным.','nl.tl3':'Публичный релиз','nl.tl3c':'Билеты открыты для всех, по полной цене.','nl.tlNow':'Сейчас','nl.tlLater':'+48 часов','nl.tlLast':'+72 часа','nl.privateTitle':'Всё ещё вне канала?','nl.privateCopy':'Достаточно одного адреса. Без шума, две передачи в месяц.','nl.soundOn':'Включить эмбиент','nl.soundOff':'Выключить эмбиент','nl.skipToForm':'Перейти к форме подписки',
  'ct.kicker':'Напиши ISKRA','ct.title':'Расскажи, какой должна быть ночь.','ct.lead':'Столики, дни рождения, бронирования и партнёрства начинаются с сообщения здесь.','ct.reply':'Отвечаем в течение одного рабочего дня','ct.replyCopy':'С понедельника по пятницу, а на вопросы о входе — в тот же вечер до 22:00.','ct.pick':'О чём речь?','ct.form':'Отправить сообщение','ct.optional':'необязательно','ct.date':'Желаемая дата события','ct.group':'Количество гостей','ct.groupHint':'Сколько вас будет','ct.send':'Отправить','ct.sending':'Отправляем…','ct.sentTitle':'Сообщение получено.','ct.sentCopy':'Команда ISKRA ответит на {email}. Проверьте также папку со спамом.','ct.sentAnother':'Написать ещё раз','ct.errName':'Укажите имя.','ct.errEmail':'Эта почта выглядит некорректно.','ct.errMessage':'Напишите чуть больше, хотя бы одно предложение.','ct.errDate':'Эта дата некорректна.','ct.errGroup':'Укажите от 1 до 500 гостей.','ct.errRate':'Слишком много сообщений. Попробуйте через минуту.','ct.errNetwork':'Нет соединения. Текст сохранён, попробуйте снова.','ct.errServer':'Ошибка на нашей стороне. Текст сохранён, попробуйте снова.','ct.direct':'Напрямую','ct.follow':'Мы в сети','ct.cat.general':'Общие вопросы','ct.cat.birthday':'День рождения и группы','ct.cat.table':'Бронь столика','ct.cat.booking':'Букинг артистов и диджеев','ct.cat.venue':'Партнёрство с площадкой','ct.cat.brand':'Бренд-коллаборация','ct.cat.press':'Пресса и медиа','ct.sub.general':'Общий вопрос','ct.sub.birthday':'День рождения / группа','ct.sub.table':'Бронь столика','ct.sub.booking':'Букинг артиста','ct.sub.venue':'Партнёрство с площадкой','ct.sub.brand':'Бренд-коллаборация','ct.sub.press':'Пресса и медиа','ct.faq':'Прежде чем писать','ct.faqTables':'Как забронировать столик?','ct.faqTablesA':'Выберите «Бронь столика», укажите дату и число гостей. VIP-стол рассчитан на четверых, бутылки со скидкой 20%.','ct.faqBirthday':'Вы проводите дни рождения?','ct.faqBirthdayA':'Да. Выберите «День рождения и группы», укажите дату и число гостей — пришлём частные цены.','ct.faqDress':'Есть ли дресс-код?','ct.faqDressA':'Формального нет. Приходите как есть, но вход может отказать, если вид портит атмосферу.','ct.faqAge':'Какое возрастное ограничение?','ct.faqAgeA':'18+, документ проверяют на входе каждую ночь.','ct.faqRefund':'Можно ли вернуть билет?','ct.faqRefundA':'Билет можно передать другому человеку до дня события. Напишите нам номер QR — перенесём.','ct.faqAccess':'Доступна ли площадка?','ct.faqAccessA':'Вход без ступеней и доступная уборная. Напишите заранее — команда встретит вас.','ct.faqPartner':'Как работают партнёрства?','ct.faqPartnerA':'Выберите «Партнёрство» или «Бренд-коллаборация» с кратким описанием. Отвечаем презентацией и свободными датами.','ct.altDoor':'Гости у входа на вечер Project ISKRA в Монреале','ct.altBar':'Бармен наливает напиток во время вечера Project ISKRA','ct.altTable':'Друзья за столом на вечере Project ISKRA',
  'of.kicker':'Кампании','of.title':'Дешевле попасть внутрь.','of.lead':'Активные промокоды, групповые предложения и вечера резидентов. Каждая скидка применяется и пересчитывается при оплате Stripe.','of.howTitle':'Как работают коды','of.how1':'Скопируйте код с этой страницы.','of.how2':'Откройте любой билет в расписании.','of.how3':'Вставьте код при оплате — цена обновится до платежа.','of.serverNote':'Скидки проверяются и пересчитываются на нашем сервере при оплате, а не в браузере.','of.copy':'Копировать код','of.copied':'Код скопирован','of.apply':'Применить при оплате','of.status.live':'Активна','of.status.scheduled':'Скоро старт','of.status.expired':'Завершена','of.off':'-{percent}%','of.limit':'До {count} билетов','of.until':'До {date}','of.from':'С {date}','of.allEvents':'Все вечера','of.loading':'Загрузка кампаний…','of.empty':'Публичных кампаний сейчас нет.','of.emptyCopy':'Подпишитесь на рассылку — следующий код придёт раньше публикации.','of.error':'Не удалось загрузить кампании.','of.retry':'Повторить','of.expiredNote':'Эта кампания завершилась.','of.kind.early':'Ранние билеты','of.kind.group':'Группы','of.kind.resident':'Вечера резидентов','of.kind.table':'Столики и дни рождения','of.kind.reward':'Spark Rush','of.privateTitle':'Частные предложения','of.privateCopy':'Дни рождения, ложи и групповые тарифы считаем отдельно. Напишите команде — ответим с ценой.','of.privateCta':'Запросить частное предложение','of.sparkTitle':'Выиграй свой код','of.sparkCopy':'Награды Spark Rush принадлежат только игроку, который их получил, и никогда не появляются на этой странице.','of.sparkCta':'Играть за билеты','of.altHero':'Бар во время вечера Project ISKRA в Muzique, Монреаль','of.altEarly':'Хост встречает гостей на вечере Project ISKRA','of.altGroup':'Компания друзей на вечере Project ISKRA','of.altResident':'Бутылки за барной стойкой на вечере резидентов','of.altTable':'Друзья празднуют за столом на Project ISKRA','of.altSpark':'Танцы на вечере Project ISKRA','of.altNewsletter':'Поздняя ночь на террасе у Project ISKRA',
  'arcade.enter':'Войди в искру','arcade.subtitle':'Шестьдесят секунд. Лови искры, держи множитель, забирай таблицу.','arcade.start':'Начать игру','arcade.insert':'Брось жетон','arcade.credits':'Попытки','arcade.today':'сегодня','arcade.reward':'Твой уровень','arcade.noReward':'Пока без награды','arcade.liveBoard':'Живая таблица','arcade.rank':'Место','arcade.you':'Ты','arcade.unranked':'Вне таблицы','arcade.attractHint':'Нажми старт','arcade.pause':'Пауза','arcade.resume':'Продолжить','arcade.soundOn':'Звук включён','arcade.soundOff':'Звук выключен','arcade.paused':'Пауза','arcade.combo':'Комбо','arcade.boardEmpty':'Результатов пока нет.','arcade.boardEmptyCopy':'Таблица открыта. Первый завершённый раунд забирает первое место.','arcade.boardError':'Таблица недоступна.','arcade.retry':'Повторить','arcade.offline':'Нет соединения. Результат не сохранится.','arcade.updated':'Обновлено','arcade.nameBlocked':'Выберите другое имя.','arcade.nameLength':'Используйте от 3 до 18 символов.','arcade.nameLetters':'Добавьте хотя бы одну букву.','arcade.checking':'Проверка…','arcade.newBest':'Новый личный рекорд','arcade.rewardUnlocked':'Награда открыта','arcade.targets':'Попаданий','arcade.accuracy':'Точность',
  'language.label':'Выберите язык','language.en':'Английский','language.uk':'Украинский','language.ru':'Русский',
  'nav.schedule':'Расписание','nav.gallery':'Галерея','nav.offers':'Предложения','nav.play':'Играть','nav.about':'О нас','nav.contact':'Контакты','nav.dating':'Dating','nav.account':'Аккаунт','nav.tickets':'Мои билеты','nav.getTickets':'Купить билеты','nav.open':'Открыть меню','nav.close':'Закрыть меню',
  'common.viewSchedule':'Посмотреть расписание','common.joinList':'Присоединиться к рассылке','common.loading':'Загрузка','common.sending':'Отправка','common.send':'Отправить','common.reserved':'Забронировано','common.free':'Бесплатно',
  'home.latest':'Последнее событие: 28 августа','home.venue':'Muzique Nightclub · Монреаль','home.doors':'18+ · Двери в 23:00','home.title1':'Ночи, которые','home.title2':'зажигают','home.lead':'ISKRA — это искра, пространство и звук, который невозможно приручить. Сырой техно, deep house и резиденты Монреаля — до самого рассвета.','home.lastEvent':'Последнее событие','home.next':'Далее','home.recap':'Смотреть отчет','home.sale':'В продаже','home.selling':'Быстро продается','home.signup':'Подписаться','home.days':'Дни','home.hours':'Час','home.minutes':'Мин','home.seconds':'Сек',
  'home.eventEyebrow':'Последняя ночь ISKRA','home.eventTitle':'Grand Opening в Muzique','home.eventLead':'28 августа состоялась первая публичная ISKRA: DJ MLNK, Slavic Music и полный зал по адресу 3781 Boulevard Saint-Laurent. Следующее событие команда опубликует через админ-панель.','home.eventSignal':'Последнее событие. Первый сигнал.','home.eventCopy':'Сайт наполнен настоящими фотографиями с события. Расписание остается пустым, пока команда не объявит следующую ночь.','stats.capacity':'Вместимость','stats.rig':'Система Funktion-One','stats.record':'Последний трек','stats.nights':'Ночей в год','marquee.machines':'Живые машины','marquee.doors':'Двери в 23:00','marquee.phones':'Без телефонов на танцполе','marquee.six':'Открыто до шести',
  'schedule.eyebrow':'Расписание','schedule.title':'Следующие ночи появятся здесь.','schedule.lead':'Здесь показаны только события, которые команда уже готова анонсировать.','schedule.latest':'Последнее событие','schedule.empty':'Новое расписание скоро.','schedule.emptyCopy':'Grand Opening состоялось 28 августа в Muzique. Подпишитесь, чтобы первыми узнать о следующем событии.','events.title':'Будущие события','events.all':'Все','events.techno':'Техно','events.house':'Хаус','events.live':'Лайв','events.freeEntry':'Свободный вход','events.empty':'В этой категории пока нет билетов. Выберите другой фильтр.','events.soldOut':'Продано','events.none':'Мест нет','events.now':'В продаже','events.gone':'Продано {percent}%','events.tickets':'Купить билеты','events.till':'до 03:00','events.hot':'Быстро продается','events.new':'Только что объявлено',
  'about.kicker':'Project ISKRA · Монреаль','about.title':'Ночь, созданная вокруг людей.','about.lead':'Славянская энергия, монреальское гостеприимство и пространство, где незнакомцы становятся одной компанией.','about.story':'Наша история','about.why':'Почему мы начали','about.flyer':'Больше, чем название на афише.','about.spark':'ISKRA означает искру. Для нас это момент, когда пространство перестает быть просто заведением и становится общим для всех внутри.','about.copy':'Мы создали Project ISKRA, чтобы каждая деталь вечера была продумана: музыка, встреча на входе, команда бара и визуальный мир. Каждое событие отвечает своему пространству и своей публике.','about.welcome':'Атмосфера начинается еще до музыки.','about.inside':'Внутри последней ночи','about.this':'Это ISKRA.','about.real':'Не постановка. Не сток. Настоящие кадры людей и мест, создавших нашу первую главу.','about.guides':'Что определяет каждую ночь','about.room':'Пространство','about.roomCopy':'Мы выбираем места с характером и позволяем их настроению формировать ночь.','about.sound':'Звук','about.soundCopy':'Диджеи, которые чувствуют публику, движутся вместе с ней и не играют на автопилоте.','about.people':'Люди','about.peopleCopy':'Теплая встреча, открытый танцпол и публика, которая оставляет место друг для друга.','about.next':'Следующая глава','about.invite':'Приходите такими, как есть.\nСтаньте частью истории.','about.guest':'В список гостей','about.work':'Работать с нами',
  'contact.eyebrow':'Контакты','contact.title':'Поговорите с командой.','contact.lead':'Бронирование, дни рождения, столики, партнерства, медиа и идеи для площадок.','contact.name':'Имя','contact.email':'Email','contact.subject':'Тема','contact.message':'Сообщение','contact.promo':'О промопредложениях','contact.promoCopy':'Укажите в форме размер группы, дату и желаемую зону. Сообщение появится в админ-панели.','contact.sent':'Сообщение отправлено. Команда ISKRA ответит по электронной почте.','contact.defaultSubject':'Бронирование / промо',
  'offers.eyebrow':'Предложения','offers.title':'Промо до входа.','offers.lead':'Коды предпродажи, групповые предложения, дни рождения и ранний доступ.','newsletter.eyebrow':'Рассылка','newsletter.title':'Получите следующую искру первыми.','newsletter.lead':'Промописьма, ранние ссылки и приватные групповые предложения от Project ISKRA.','newsletter.heading':'Получайте анонсы\nраньше алгоритма','newsletter.copy':'Лайнапы, коды предпродажи и иногда секретный адрес. Два письма в месяц, без лишнего.','newsletter.email':'Электронная почта','newsletter.adding':'Добавляем','newsletter.subscribe':'Подписаться','newsletter.success':'Вы в списке. Коды предпродажи сначала придут на вашу почту.','newsletter.promotion':'Промо','newsletter.presale':'Коды предпродажи до Instagram','newsletter.presaleCopy':'Присоединяйтесь и получите первое окно продаж до публикации афиши.','newsletter.birthday':'Дни рождения и групповые столы','newsletter.birthdayCopy':'Оставьте email, и мы отправим приватные предложения для праздников, компаний и раннего входа.','newsletter.offers':'Получить предложения',
  'gallery.eyebrow':'Моменты с события','gallery.title':'После искры.','gallery.lead':'Настоящие люди, теплый свет и кадры, оставшиеся с нами после закрытия дверей.','gallery.alt':'Момент с события Project ISKRA {number}',
  'tickets.saved':'Сохранено на этом устройстве','tickets.title':'Мои билеты.','tickets.lead':'QR-коды остаются здесь после бронирования. Откройте активный билет перед входом.','tickets.loading':'Загружаем билеты…','tickets.failed':'Не удалось загрузить билеты.','tickets.none':'Нет сохраненных билетов','tickets.first':'Ваш первый QR появится здесь.','tickets.firstCopy':'Забронируйте билет из расписания на этом устройстве, и он сохранится автоматически.','tickets.feedback':'Оставить отзыв','tickets.overall':'В целом','tickets.music':'Музыка','tickets.venue':'Площадка','tickets.comment':'Что нам стоит сохранить или изменить?','tickets.saving':'Сохраняем','tickets.sendFeedback':'Отправить отзыв','tickets.feedbackSaved':'Отзыв сохранен. Спасибо, что были частью ночи.','tickets.qrAlt':'QR-код билета {reference}',
  'checkout.holder':'Владелец билета','checkout.name':'Имя и фамилия','checkout.receipt':'Email для подтверждения','checkout.quantity':'Количество','checkout.quantityHint':'Скидка применяется к выбранным билетам','checkout.youSave':'Вы экономите {amount}','checkout.ticketEquivalent':'Эта экономия равна {count} билету(ам) по этой цене','checkout.code':'Промокод','checkout.apply':'Применить','checkout.total':'Итого','checkout.issuing':'Создаем QR…','checkout.redirecting':'Открываем безопасную оплату…','checkout.reserve':'Забронировать и получить QR →','checkout.pay':'Безопасно оплатить через Stripe →','checkout.secureNote':'БЕЗОПАСНАЯ ОПЛАТА ЧЕРЕЗ STRIPE · QR ПОСЛЕ ПОДТВЕРЖДЕНИЯ','checkout.freeNote':'ОПЛАТА НЕ ТРЕБУЕТСЯ · QR СОЗДАЕТСЯ СРАЗУ','checkout.ready':'Билет готов','checkout.oneReady':'Ваш QR готов.','checkout.manyReady':'Готово билетов: {count}.','checkout.saved':'Билеты сохранены на этом устройстве. Откройте «Мои билеты» перед входом.','checkout.open':'Открыть мои билеты','checkout.close':'Закрыть',
  'play.eyebrow':'Игра','play.title':'Выиграйте билеты дешевле.','play.lead':'Spark Rush находится на отдельной странице, чтобы главная оставалась сфокусированной.','promo.first':'АНОНСЫ СЛЕДУЮЩИХ СОБЫТИЙ СНАЧАЛА ПОЯВЛЯЮТСЯ В РАССЫЛКЕ','promo.wallet':'ВАШИ QR-БИЛЕТЫ СОХРАНЯЮТСЯ НА ЭТОМ УСТРОЙСТВЕ','promo.groups':'ГРУППОВЫЕ ЗАПРОСЫ И ДНИ РОЖДЕНИЯ — ЧЕРЕЗ СТРАНИЦУ КОНТАКТОВ','promo.gallery':'НАСТОЯЩИЕ МОМЕНТЫ С ПОСЛЕДНЕЙ ISKRA УЖЕ В ГАЛЕРЕЕ','promo.paused':'СОБЫТИЯ ISKRA ПРИОСТАНОВЛЕНЫ · СЛЕДУЮЩЕЕ ОБНОВЛЕНИЕ ПОЯВИТСЯ ЗДЕСЬ','footer.nights':'События','footer.visit':'Посетить','footer.follow':'Следить','footer.decent':'Уважайте друг друга.','footer.rights':'ISKRA. Все ночи защищены.','footer.about':'О нас','footer.play':'Играть за билеты','footer.list':'Рассылка'
  ,'offers.section':'Более дешевый путь на событие','offers.ends':'До воскресенья 23:59','offers.early':'Ранний билет сгорает первым','offers.earlyCopy':'Бронируйте заранее, пока не начала действовать цена на входе.','offers.four':'Четверо входят — один бесплатно','offers.fourCopy':'Приходите вчетвером, и один билет за наш счет.','offers.resident':'Предложение резидентской ночи','offers.residentCopy':'Специальная цена для выбранных ночей.','offers.copied':'Код {code} скопирован','play.section':'Играйте за билеты','play.sectionCopy':'Шестьдесят секунд Spark Rush. Ловите искры и поднимайтесь в призовую зону.','play.first':'Первое место','play.firstHead':'Билет за 10 долларов','play.firstCopy':'Любая ночь сезона и любой уровень.','play.top':'Второе–пятое места','play.topHead':'Полцены','play.topCopy':'Скидка 50% на два билета.','play.all':'Все остальные','play.allHead':'Скидка 10%','play.allCopy':'За участие в игре.','play.loading':'Загружаем таблицу','play.saving':'Сохраняем результат','play.cheap':'Играйте за дешевые билеты','play.signupCopy':'Зарегистрируйтесь, сделайте три попытки и попадите в топ-5.','play.name':'Имя в таблице','play.namePlaceholder':'Как показать вас в таблице','play.consent':'Мне исполнилось 18 лет, и я хочу получать анонсы и призовой код по email.','play.checking':'Проверяем','play.enter':'Войти в таблицу','play.instructions':'Ловите оранжевые искры. Светлые дают тройные баллы, темные забирают их.','play.attempts':'{name}, сегодня осталось попыток: {count}','play.start':'Начать раунд','play.spent':'Попытки закончились','play.spentCopy':'Сегодня использованы все три попытки. Таблица обновится в полночь.','play.other':'Другие предложения','play.final':'Финальный счет','play.rank':'Место {rank}, лучший {best}','play.again':'Еще раз ({count})','play.use':'Использовать код','play.orange':'Оранжевая — 100 баллов','play.pale':'Светлая — втрое больше','play.dark':'Темная — штраф','play.miss':'Промах сбрасывает множитель','play.board':'Таблица лидеров','play.topWin':'Топ-5 выигрывает','play.empty':'Результатов еще нет. Будьте первыми.','play.you':'Вы','play.left':'Сегодня осталось {count} из 3 попыток','play.signUpAttempts':'Зарегистрируйтесь, чтобы получить три попытки','play.season':'Сезон завершается 20 сентября. При равенстве побеждает ранний результат.','play.signOut':'Выйти на этом устройстве','play.score':'Счет','play.multiplier':'Множитель','play.time':'Время'
};

Object.assign(en,{
  'footer.terms':'Event terms',
  'ct.faqTablesA':'Pick Table reservations above, tell us the date and how many people. VIP tables seat four and one bottle is 20% off.',
  'checkout.vipNoPromos':'Promo codes do not apply to VIP tables.',
  'checkout.chooseAdmission':'1 · Choose admission','checkout.addOns':'2 · Add extras','checkout.added':'Added','checkout.orderSummary':'Order summary','checkout.cartTickets':'{count} × {tier}','checkout.cartVip':'VIP table #{slot}','checkout.cartDiscount':'VIP admission discount · {percent}% off',
  'checkout.customOrder':'Custom order','checkout.customPlaceholder':'Enter private order code','checkout.customApplied':'Private order applied','checkout.remove':'Remove','checkout.privatePackage':'Private package','checkout.customAdmissions':'{count} admission ticket(s)','checkout.customVip':'{count} VIP table(s)',
  'checkout.vipChecking':'Checking table availability…','checkout.vipSoldOut':'Sold out · all four VIP tables are reserved','checkout.vipDescription':'Table $140 · admission tickets {discount}% off','checkout.vipTableNumber':'VIP table #{slot}','checkout.vipSeparateEntry':'Entry is not included. Add 1–4 required admission tickets below; this table receives {discount}% off admission.','checkout.vipRemaining':'{count} of 4 VIP tables remaining','checkout.vipAdmissions':'Admission tickets','checkout.vipAdmissionsHint':'Required for entry · choose 1–4 guests',
  'tickets.tableOnly':'Table reservation','tickets.tableNeedsEntry':'Not valid for entry. Every guest needs a separate admission QR.',
  'common.valid':'Valid','common.redeemed':'Checked in','common.cancelled':'Cancelled','common.dismiss':'Dismiss announcement','common.decrease':'Decrease','common.increase':'Increase','common.sound':'Toggle sound',
  'checkout.general':'Early bird','checkout.generalDesc':'Limited first-release ticket','checkout.early':'Late bird','checkout.earlyDesc':'Standard admission after early bird','checkout.booth':'VIP table','checkout.boothDesc':'Seats four, bottle 20% off',
  'tickets.paymentComplete':'Payment complete. Your QR tickets are ready.','tickets.paymentCompleteCopy':'They are saved on this device and sent to your email.','tickets.emailDelayed':'Your tickets are saved here. Email delivery is delayed, but your QR codes remain available on this device.','checkout.saved':'The tickets are saved on this device and sent to your email with QR attachments. Open My tickets whenever you need them at the door.','checkout.emailDelayed':'Your QR tickets are saved on this device. Email delivery is delayed; the team can safely retry it without creating duplicate tickets.',
  'home.latest':'Latest party · Photo recap','home.venue':'Project ISKRA · Montréal','home.doors':'Real moments · Real crowd','home.opening':'Latest party','home.eventEyebrow':'Latest ISKRA night','home.eventTitle':'Inside our latest party','home.eventLead':'These photographs are from the most recent ISKRA party: the crowd, the room, and the energy as they actually happened. The next date will be announced by the team.','home.eventChip':'Latest party · Montréal','home.eventSignal':'The night, frame by frame.','home.eventCopy':'Real moments from the latest party now carry the site. Join the list and be first to hear when the next night is ready.','home.posterAlt':'Project ISKRA event archive','schedule.emptyCopy':'The latest party is now in our photo recap. Join the promo list for the next date and venue.','of.altHero':'The bar during a Project ISKRA night in Montréal','site.title':'ISKRA - Nights That Catch Fire'
  ,'nav.partners':'Partners','footer.rights':'ISKRA. All nights reserved.','footer.developed':'Developed and maintained by','partners.title':'THE PEOPLE BEHIND THE SPARK.','partners.lead':'Project ISKRA is built through nightlife, community, and technology partnerships that turn one night into a lasting Montréal platform.','partners.orvadoraRole':'Development · technology · rights preservation','partners.orvadoraCopy':'Orvadora designed, developed, and maintains the Project ISKRA digital ecosystem. The company preserves the technical work and the rights attached to it as the platform grows.','partners.orvadoraWeb':'Website, client portal, ticketing, and event discovery','partners.orvadoraOps':'Administration, analytics, communications, and venue tools','partners.orvadoraRights':'Technical maintenance and preservation of digital work rights','partners.visitOrvadora':'Visit Orvadora','partners.venueRole':'Venue partner','partners.venueCopy':'A Montréal nightlife setting for Project ISKRA events, music, and real-world connection.','partners.muziqueAlt':'Project ISKRA hosts inside Muzique Montréal','partners.communityRole':'Community channel','partners.communityTitle':'UKRAINIAN MONTRÉAL','partners.communityCopy':'News, conversation, and a direct connection to Montréal’s Ukrainian community on Telegram.'
});
Object.assign(uk,{
  'footer.terms':'Умови подій',
  'ct.faqTablesA':'Оберіть «Бронювання столика», вкажіть дату й кількість гостей. VIP-стіл розрахований на чотирьох, одна пляшка зі знижкою 20%.',
  'checkout.vipNoPromos':'Промокоди не діють на VIP-столи.',
  'checkout.chooseAdmission':'1 · Оберіть вхід','checkout.addOns':'2 · Додайте опції','checkout.added':'Додано','checkout.orderSummary':'Підсумок замовлення','checkout.cartTickets':'{count} × {tier}','checkout.cartVip':'VIP-стіл №{slot}','checkout.cartDiscount':'Знижка VIP на вхід · {percent}%',
  'checkout.customOrder':'Індивідуальне замовлення','checkout.customPlaceholder':'Введіть приватний код','checkout.customApplied':'Індивідуальне замовлення застосовано','checkout.remove':'Прибрати','checkout.privatePackage':'Приватний пакет','checkout.customAdmissions':'Квитки на вхід: {count}','checkout.customVip':'VIP-столи: {count}',
  'checkout.vipChecking':'Перевіряємо наявність столів…','checkout.vipSoldOut':'Розпродано · усі чотири VIP-столи заброньовано','checkout.vipDescription':'Стіл $140 · знижка {discount}% на вхідні квитки','checkout.vipTableNumber':'VIP-стіл №{slot}','checkout.vipSeparateEntry':'Вхід не включено. Додайте нижче 1–4 обов’язкові вхідні квитки; для цього столу діє знижка {discount}%.','checkout.vipRemaining':'Залишилося VIP-столів: {count} із 4','checkout.vipAdmissions':'Вхідні квитки','checkout.vipAdmissionsHint':'Обов’язкові для входу · оберіть 1–4 гостей',
  'tickets.tableOnly':'Бронювання столу','tickets.tableNeedsEntry':'Не дійсне для входу. Кожному гостю потрібен окремий вхідний QR.',
  'common.valid':'Дійсний','common.redeemed':'Використано','common.cancelled':'Скасовано','common.dismiss':'Закрити оголошення','common.decrease':'Зменшити','common.increase':'Збільшити','common.sound':'Увімкнути або вимкнути звук',
  'checkout.general':'Ранній квиток','checkout.generalDesc':'Обмежений перший випуск квитків','checkout.early':'Пізній квиток','checkout.earlyDesc':'Стандартний вхід після раннього продажу','checkout.booth':'VIP-стіл','checkout.boothDesc':'На чотирьох, пляшка зі знижкою 20%',
  'tickets.paymentComplete':'Оплату завершено. Ваші QR-квитки готові.','tickets.paymentCompleteCopy':'Вони збережені на цьому пристрої та надіслані на вашу електронну пошту.','tickets.emailDelayed':'Квитки збережені тут. Надсилання листа затримується, але QR-коди доступні на цьому пристрої.','checkout.saved':'Квитки збережені на цьому пристрої та надіслані на вашу пошту з QR-вкладеннями. Відкрийте «Мої квитки» перед входом.','checkout.emailDelayed':'QR-квитки збережені на цьому пристрої. Лист затримується; команда може безпечно повторити надсилання без дублювання квитків.',
  'home.latest':'Остання вечірка · Фотозвіт','home.venue':'Project ISKRA · Монреаль','home.doors':'Справжні моменти · Справжні люди','home.opening':'Остання вечірка','home.eventEyebrow':'Остання ніч ISKRA','home.eventTitle':'Усередині останньої вечірки','home.eventLead':'Ці фотографії зроблені на останній вечірці ISKRA: справжня публіка, простір та енергія ночі. Наступну дату оголосить команда.','home.eventChip':'Остання вечірка · Монреаль','home.eventSignal':'Ніч, кадр за кадром.','home.eventCopy':'Справжні моменти з останньої вечірки тепер наповнюють сайт. Приєднуйтесь до списку, щоб першими дізнатися про наступну ніч.','home.posterAlt':'Архів подій Project ISKRA','schedule.emptyCopy':'Фотозвіт з останньої вечірки вже на сайті. Приєднуйтесь до промосписку, щоб дізнатися наступну дату й локацію.','of.altHero':'Бар під час вечора Project ISKRA у Монреалі','site.title':'ISKRA - Ночі, що запалюють'
  ,'nav.partners':'Партнери','footer.rights':'ISKRA. Усі права на ночі захищено.','footer.developed':'Розробка та підтримка','partners.title':'ЛЮДИ ЗА ІСКРОЮ.','partners.lead':'Project ISKRA розвивається завдяки партнерству у сфері нічного життя, спільноти й технологій, перетворюючи одну ніч на сталу монреальську платформу.','partners.orvadoraRole':'Розробка · технології · збереження прав','partners.orvadoraCopy':'Orvadora спроєктувала, розробила та підтримує цифрову екосистему Project ISKRA. Компанія зберігає технічну роботу та пов’язані з нею права в міру розвитку платформи.','partners.orvadoraWeb':'Сайт, клієнтський портал, квитки та пошук подій','partners.orvadoraOps':'Адміністрування, аналітика, комунікації та інструменти для локацій','partners.orvadoraRights':'Технічна підтримка та збереження прав на цифрову роботу','partners.visitOrvadora':'Відвідати Orvadora','partners.venueRole':'Партнерська локація','partners.venueCopy':'Монреальський простір нічного життя для подій Project ISKRA, музики та живих знайомств.','partners.muziqueAlt':'Організатори Project ISKRA у Muzique Montréal','partners.communityRole':'Канал спільноти','partners.communityTitle':'УКРАЇНЦІ МОНРЕАЛЯ','partners.communityCopy':'Новини, спілкування та прямий зв’язок з українською спільнотою Монреаля у Telegram.'
});
Object.assign(ru,{
  'footer.terms':'Условия мероприятий',
  'ct.faqTablesA':'Выберите «Бронь столика», укажите дату и число гостей. VIP-стол рассчитан на четверых, одна бутылка со скидкой 20%.',
  'checkout.vipNoPromos':'Промокоды не действуют на VIP-столы.',
  'checkout.chooseAdmission':'1 · Выберите вход','checkout.addOns':'2 · Добавьте опции','checkout.added':'Добавлено','checkout.orderSummary':'Состав заказа','checkout.cartTickets':'{count} × {tier}','checkout.cartVip':'VIP-стол №{slot}','checkout.cartDiscount':'VIP-скидка на вход · {percent}%',
  'checkout.customOrder':'Индивидуальный заказ','checkout.customPlaceholder':'Введите приватный код','checkout.customApplied':'Индивидуальный заказ применён','checkout.remove':'Убрать','checkout.privatePackage':'Приватный пакет','checkout.customAdmissions':'Входные билеты: {count}','checkout.customVip':'VIP-столы: {count}',
  'checkout.vipChecking':'Проверяем наличие столов…','checkout.vipSoldOut':'Распродано · все четыре VIP-стола забронированы','checkout.vipDescription':'Стол $140 · скидка {discount}% на входные билеты','checkout.vipTableNumber':'VIP-стол №{slot}','checkout.vipSeparateEntry':'Вход не включён. Добавьте ниже 1–4 обязательных входных билета; для этого стола действует скидка {discount}%.','checkout.vipRemaining':'Осталось VIP-столов: {count} из 4','checkout.vipAdmissions':'Входные билеты','checkout.vipAdmissionsHint':'Обязательны для входа · выберите 1–4 гостей',
  'tickets.tableOnly':'Бронь стола','tickets.tableNeedsEntry':'Не действует для входа. Каждому гостю нужен отдельный входной QR.',
  'common.valid':'Действителен','common.redeemed':'Использован','common.cancelled':'Отменен','common.dismiss':'Закрыть объявление','common.decrease':'Уменьшить','common.increase':'Увеличить','common.sound':'Включить или выключить звук',
  'checkout.general':'Ранний билет','checkout.generalDesc':'Ограниченный первый выпуск билетов','checkout.early':'Поздний билет','checkout.earlyDesc':'Стандартный вход после ранней продажи','checkout.booth':'VIP-стол','checkout.boothDesc':'На четверых, бутылка со скидкой 20%',
  'tickets.paymentComplete':'Оплата завершена. Ваши QR-билеты готовы.','tickets.paymentCompleteCopy':'Они сохранены на этом устройстве и отправлены на вашу электронную почту.','tickets.emailDelayed':'Билеты сохранены здесь. Отправка письма задерживается, но QR-коды доступны на этом устройстве.','checkout.saved':'Билеты сохранены на этом устройстве и отправлены на вашу почту с QR-вложениями. Откройте «Мои билеты» перед входом.','checkout.emailDelayed':'QR-билеты сохранены на этом устройстве. Письмо задерживается; команда может безопасно повторить отправку без дублирования билетов.',
  'home.latest':'Последняя вечеринка · Фотоотчет','home.venue':'Project ISKRA · Монреаль','home.doors':'Настоящие моменты · Настоящие люди','home.opening':'Последняя вечеринка','home.eventEyebrow':'Последняя ночь ISKRA','home.eventTitle':'Внутри последней вечеринки','home.eventLead':'Эти фотографии сделаны на последней вечеринке ISKRA: настоящая публика, пространство и энергия ночи. Следующую дату объявит команда.','home.eventChip':'Последняя вечеринка · Монреаль','home.eventSignal':'Ночь, кадр за кадром.','home.eventCopy':'Настоящие моменты с последней вечеринки теперь наполняют сайт. Подпишитесь, чтобы первыми узнать о следующей ночи.','home.posterAlt':'Архив событий Project ISKRA','schedule.emptyCopy':'Фотоотчет с последней вечеринки уже на сайте. Подпишитесь, чтобы узнать следующую дату и площадку.','of.altHero':'Бар во время вечера Project ISKRA в Монреале','site.title':'ISKRA - Ночи, которые зажигают'
  ,'nav.partners':'Партнеры','footer.rights':'ISKRA. Все права на ночи защищены.','footer.developed':'Разработка и поддержка','partners.title':'ЛЮДИ ЗА ИСКРОЙ.','partners.lead':'Project ISKRA развивается благодаря партнерству в сфере ночной жизни, сообщества и технологий, превращая одну ночь в устойчивую монреальскую платформу.','partners.orvadoraRole':'Разработка · технологии · сохранение прав','partners.orvadoraCopy':'Orvadora спроектировала, разработала и поддерживает цифровую экосистему Project ISKRA. Компания сохраняет техническую работу и связанные с ней права по мере развития платформы.','partners.orvadoraWeb':'Сайт, клиентский портал, билеты и поиск событий','partners.orvadoraOps':'Администрирование, аналитика, коммуникации и инструменты для площадок','partners.orvadoraRights':'Техническая поддержка и сохранение прав на цифровую работу','partners.visitOrvadora':'Посетить Orvadora','partners.venueRole':'Партнерская площадка','partners.venueCopy':'Монреальское пространство ночной жизни для событий Project ISKRA, музыки и живого общения.','partners.muziqueAlt':'Организаторы Project ISKRA в Muzique Montréal','partners.communityRole':'Канал сообщества','partners.communityTitle':'УКРАИНЦЫ МОНРЕАЛЯ','partners.communityCopy':'Новости, общение и прямая связь с украинским сообществом Монреаля в Telegram.'
});

/* Creators and media partners. Names and Instagram handles are never
   translated; only the descriptive copy is. */
Object.assign(en,{
  'partners.creatorsRole':'Creators & media partners',
  'partners.creatorsTitle':'CREATORS & MEDIA',
  'partners.creatorsLead':'Independent creators who tell Montréal immigrant stories in their own voice, and who share the room with Project ISKRA.',
  'partners.viewInstagram':'View on Instagram',
  'partners.gloryCopy':'Slavic entertainment, music, and culture through energetic original content.',
  'partners.migrantCopy':'Community-driven fashion, creativity, and immigrant culture in Montréal.',
  'partners.gloryAlt':'Glory Molly Prod and KiddyGold82 together in a Montréal music studio.',
  'partners.migrantAlt':'Migrant Shop logo: three members of the crew standing beneath a dripping yellow neon sign reading Migrant Shop.'
});
Object.assign(uk,{
  'partners.creatorsRole':'Автори та медіапартнери',
  'partners.creatorsTitle':'АВТОРИ ТА МЕДІА',
  'partners.creatorsLead':'Незалежні автори, які розповідають історії монреальських іммігрантів власним голосом і поділяють простір із Project ISKRA.',
  'partners.viewInstagram':'Дивитися в Instagram',
  'partners.gloryCopy':'Слов’янські розваги, музика та культура через енергійний оригінальний контент.',
  'partners.migrantCopy':'Мода, творчість та іммігрантська культура Монреаля, створені спільнотою.',
  'partners.gloryAlt':'Glory Molly Prod і KiddyGold82 разом у музичній студії Монреаля.',
  'partners.migrantAlt':'Логотип Migrant Shop: троє учасників команди стоять під жовтою неоновою вивіскою з написом Migrant Shop.'
});
Object.assign(ru,{
  'partners.creatorsRole':'Авторы и медиапартнеры',
  'partners.creatorsTitle':'АВТОРЫ И МЕДИА',
  'partners.creatorsLead':'Независимые авторы, которые рассказывают истории монреальских иммигрантов своим голосом и делят пространство с Project ISKRA.',
  'partners.viewInstagram':'Смотреть в Instagram',
  'partners.gloryCopy':'Славянские развлечения, музыка и культура через энергичный оригинальный контент.',
  'partners.migrantCopy':'Мода, творчество и иммигрантская культура Монреаля, создаваемые сообществом.',
  'partners.gloryAlt':'Glory Molly Prod и KiddyGold82 вместе в музыкальной студии Монреаля.',
  'partners.migrantAlt':'Логотип Migrant Shop: трое участников команды стоят под желтой неоновой вывеской с надписью Migrant Shop.'
});

Object.assign(en,{
  'of.limit':'From {count} tickets',
  'checkout.needMore':'{code} starts from {min} tickets. Add {need} more.'
});
Object.assign(uk,{
  'of.limit':'Від {count} квитків',
  'checkout.needMore':'{code} діє від {min} квитків. Додайте ще {need}.'
});
Object.assign(ru,{
  'of.limit':'От {count} билетов',
  'checkout.needMore':'{code} действует от {min} билетов. Добавьте еще {need}.'
});

/* Play hub. The arcade entrance; every visible string lives here. */
Object.assign(en,{
  'hub.eyebrow':'ISKRA PLAY / SELECT MODE','hub.title1':'PLAY THE','hub.title2':'NIGHT.',
  'hub.lead':'Arcade games, live tournaments, and free ticket rewards. Practice first or sign in to compete.',
  'hub.sysGames':'Games online','hub.sysRewards':'Rewards active','hub.sysNode':'Montréal node',
  'hub.sparkTag':'01 / Arcade','hub.sparkTitle1':'SPARK','hub.sparkTitle2':'RUSH',
  'hub.sparkCopy':'Thirty seconds. Three attempts. Catch the sparks and climb the real leaderboard.',
  'hub.sparkCta':'Play now',
  'hub.pokerTag':'02 / Tournament','hub.pokerTitle1':'ISKRA','hub.pokerTitle2':'POKER',
  'hub.pokerCopy':'Free Texas Hold’em tournaments for event tickets, plus a three-hand guest demo.',
  'hub.pokerCta':'Enter lobby',
  'hub.nextTag':'03 / Next signal','hub.nextTitle1':'NEW GAME','hub.nextTitle2':'INCOMING',
  'hub.nextCopy':'The next ISKRA game will unlock here.','hub.nextCta':'Not announced',
  'hub.chipLive':'Live','hub.chipDemo':'Demo','hub.chipAccount':'Account required',
  'hub.chipSoon':'Coming soon','hub.soonCta':'Opening soon','hub.soonStatus':'Not open yet','hub.chipFree':'Free entry','hub.chipNoAccount':'No account needed',
  'hub.rank':'Your rank #{rank}','hub.newPlayer':'No score yet',
  'hub.openTournaments':'{count} tournament open','hub.openTournamentsPlural':'{count} tournaments open',
  'hub.runningTournaments':'{count} tournament under way','hub.runningTournamentsPlural':'{count} tournaments under way',
  'hub.noTournaments':'No tournament open','hub.demoOnly':'Guest demo available',
  'hub.signedIn':'Signed in as {name}','hub.unavailable':'Unavailable',
  'hub.legal':'Poker entry is free. No purchase necessary. Demo play does not award tickets or promotional rewards.',
  'hub.loadingStatus':'Checking status…'
});
Object.assign(uk,{
  'hub.eyebrow':'ISKRA PLAY / ОБЕРІТЬ РЕЖИМ','hub.title1':'ГРАЙ У','hub.title2':'НІЧ.',
  'hub.lead':'Аркадні ігри, живі турніри та безкоштовні квиткові нагороди. Спочатку потренуйтеся або увійдіть, щоб змагатися.',
  'hub.sysGames':'Ігри онлайн','hub.sysRewards':'Нагороди активні','hub.sysNode':'Монреальський вузол',
  'hub.sparkTag':'01 / Аркада','hub.sparkTitle1':'SPARK','hub.sparkTitle2':'RUSH',
  'hub.sparkCopy':'Тридцять секунд. Три спроби. Ловіть іскри та піднімайтеся у справжньому рейтингу.',
  'hub.sparkCta':'Грати зараз',
  'hub.pokerTag':'02 / Турнір','hub.pokerTitle1':'ISKRA','hub.pokerTitle2':'POKER',
  'hub.pokerCopy':'Безкоштовні турніри з Texas Hold’em за квитки на події та демо на три роздачі для гостей.',
  'hub.pokerCta':'Увійти в лобі',
  'hub.nextTag':'03 / Наступний сигнал','hub.nextTitle1':'НОВА ГРА','hub.nextTitle2':'НЕВДОВЗІ',
  'hub.nextCopy':'Наступна гра ISKRA відкриється тут.','hub.nextCta':'Не оголошено',
  'hub.chipLive':'Наживо','hub.chipDemo':'Демо','hub.chipAccount':'Потрібен акаунт',
  'hub.chipSoon':'Незабаром','hub.soonCta':'Скоро відкриття','hub.soonStatus':'Ще не відкрито','hub.chipFree':'Безкоштовно','hub.chipNoAccount':'Без акаунта',
  'hub.rank':'Ваше місце #{rank}','hub.newPlayer':'Ще без результату',
  'hub.openTournaments':'{count} турнір відкрито','hub.openTournamentsPlural':'{count} турнірів відкрито',
  'hub.runningTournaments':'{count} турнір триває','hub.runningTournamentsPlural':'{count} турнірів триває',
  'hub.noTournaments':'Турнірів немає','hub.demoOnly':'Доступне гостьове демо',
  'hub.signedIn':'Ви увійшли як {name}','hub.unavailable':'Недоступно',
  'hub.legal':'Участь у покері безкоштовна. Купівля не потрібна. Демо-гра не дає квитків чи промо-нагород.',
  'hub.loadingStatus':'Перевіряємо статус…'
});
Object.assign(ru,{
  'hub.eyebrow':'ISKRA PLAY / ВЫБЕРИТЕ РЕЖИМ','hub.title1':'ИГРАЙ В','hub.title2':'НОЧЬ.',
  'hub.lead':'Аркадные игры, живые турниры и бесплатные билетные награды. Сначала потренируйтесь или войдите, чтобы соревноваться.',
  'hub.sysGames':'Игры онлайн','hub.sysRewards':'Награды активны','hub.sysNode':'Монреальский узел',
  'hub.sparkTag':'01 / Аркада','hub.sparkTitle1':'SPARK','hub.sparkTitle2':'RUSH',
  'hub.sparkCopy':'Тридцать секунд. Три попытки. Ловите искры и поднимайтесь в настоящем рейтинге.',
  'hub.sparkCta':'Играть сейчас',
  'hub.pokerTag':'02 / Турнир','hub.pokerTitle1':'ISKRA','hub.pokerTitle2':'POKER',
  'hub.pokerCopy':'Бесплатные турниры по Texas Hold’em за билеты на события и демо на три раздачи для гостей.',
  'hub.pokerCta':'Войти в лобби',
  'hub.nextTag':'03 / Следующий сигнал','hub.nextTitle1':'НОВАЯ ИГРА','hub.nextTitle2':'СКОРО',
  'hub.nextCopy':'Следующая игра ISKRA откроется здесь.','hub.nextCta':'Не объявлено',
  'hub.chipLive':'В эфире','hub.chipDemo':'Демо','hub.chipAccount':'Нужен аккаунт',
  'hub.chipSoon':'Скоро','hub.soonCta':'Скоро открытие','hub.soonStatus':'Еще не открыто','hub.chipFree':'Бесплатно','hub.chipNoAccount':'Без аккаунта',
  'hub.rank':'Ваше место #{rank}','hub.newPlayer':'Пока без результата',
  'hub.openTournaments':'{count} турнир открыт','hub.openTournamentsPlural':'{count} турниров открыто',
  'hub.runningTournaments':'{count} турнир идет','hub.runningTournamentsPlural':'{count} турниров идет',
  'hub.noTournaments':'Турниров нет','hub.demoOnly':'Доступно гостевое демо',
  'hub.signedIn':'Вы вошли как {name}','hub.unavailable':'Недоступно',
  'hub.legal':'Участие в покере бесплатное. Покупка не требуется. Демо-игра не дает билетов или промо-наград.',
  'hub.loadingStatus':'Проверяем статус…'
});

Object.assign(en,{
  'checkout.lateLocked':'Available on the event date',
  'checkout.earlyClosed':'Early bird sale has ended'
});
Object.assign(uk,{
  'checkout.lateLocked':'Доступний у день події',
  'checkout.earlyClosed':'Продаж ранніх квитків завершено'
});
Object.assign(ru,{
  'checkout.lateLocked':'Доступен в день события',
  'checkout.earlyClosed':'Продажа ранних билетов завершена'
});

/* Tournament lobby control room. */
Object.assign(en,{
  'lob.status.registration_open':'Registration open','lob.status.closing_soon':'Registration closing',
  'lob.status.starting_soon':'Starting soon','lob.status.scheduled':'Scheduled','lob.status.live':'Live now',
  'lob.status.paused':'Paused','lob.status.completed':'Completed','lob.status.cancelled':'Cancelled',
  'lob.status.unavailable':'Unavailable',
  'lob.closesIn':'Registration closes in','lob.startsIn':'Starts in','lob.days':'d','lob.hours':'h','lob.min':'m','lob.sec':'s',
  'lob.act.register':'Register now','lob.act.check_in':'Check in','lob.act.registered':'Registration confirmed',
  'lob.act.join_table':'Join your table','lob.act.resume_table':'Resume your game','lob.act.view_results':'View results',
  'lob.act.sign_in':'Sign in to enter','lob.act.full':'Tournament full','lob.act.closed':'Registration closed',
  'lob.act.eliminated':'You are out of this tournament','lob.act.cancelled':'Tournament cancelled',
  'lob.working':'Working…','lob.retry':'Try again','lob.offline':'Lost contact with the server. Retrying…',
  'lob.free':'Free entry · No purchase necessary · Chips have no cash value · Prizes are event tickets',
  'lob.info':'Tournament','lob.round':'Round','lob.players':'Players','lob.venue':'Event',
  'lob.deadline':'Registration closes','lob.start':'Starts','lob.duration':'Estimated duration','lob.gameType':'Game',
  'lob.holdem':'No-limit Texas Hold’em','lob.stack':'Starting chips','lob.blinds':'Blind structure',
  'lob.blindsValue':'{levels} levels · {minutes} min each','lob.rounds':'Rounds','lob.advancement':'Advancement',
  'lob.advancementValue':'Top {n} from each table','lob.prizes':'Prizes','lob.place':'Place',
  'lob.field':'The field','lob.registered':'Registered','lob.checkedIn':'Checked in','lob.active':'Still in',
  'lob.eliminated':'Eliminated','lob.tables':'Tables','lob.openSeats':'Open seats','lob.uncapped':'No cap',
  'lob.capacity':'{n} of {max} seats','lob.recent':'Latest entries','lob.noneYet':'Nobody has registered yet',
  'lob.noneYetCopy':'Be the first to enter. Registration is free.',
  'lob.pass':'Your tournament pass','lob.passNumber':'Entry','lob.passStatus':'Status','lob.passRound':'Round',
  'lob.passTable':'Table','lob.passSeat':'Seat','lob.passCheck':'Check-in','lob.passNext':'Next step',
  'lob.notCheckedIn':'Not checked in','lob.awaitingSeat':'Seat assigned when the tournament starts',
  'lob.map':'Table map','lob.mapEmpty':'Tables appear when the tournament starts',
  'lob.tableSeats':'{used} of {size} seated','lob.yourTable':'Your table','lob.openTable':'Open table',
  'lob.hand':'Hand {n}','lob.bracket':'Progression','lob.leaderboard':'Chip counts',
  'lob.rank':'#','lob.chips':'Chips','lob.leaderEmpty':'Chip counts appear once cards are in the air',
  'lob.activity':'Activity','lob.activityEmpty':'Nothing has happened yet',
  'lob.ev.registration':'{name} entered','lob.ev.elimination':'{name} eliminated',
  'lob.ev.state_registration_open':'Registration opened','lob.ev.state_registration_locked':'Registration closed',
  'lob.ev.state_round_one':'Round one began','lob.ev.state_round_two':'Round two began',
  'lob.ev.state_final_round':'Final round began','lob.ev.state_completed':'Tournament completed',
  'lob.ev.state_paused':'Tournament paused','lob.ev.state_resumed':'Tournament resumed',
  'lob.ev.state_cancelled':'Tournament cancelled','lob.ev.state_scheduled':'Tournament published',
  'lob.ev.round_seated':'Players seated',
  'lob.podium':'Final standings','lob.winner':'Winner','lob.prizePending':'Prize pending review',
  'lob.prizeDelivered':'Tickets issued','lob.myRewards':'See your tickets',
  'lob.docs':'Rules & policies','lob.rules':'Official rules','lob.eligibility':'Eligibility',
  'lob.privacy':'Privacy','lob.fairPlay':'Fair play',
  'lob.eligibilityCopy':'Entry is free and open to registered ISKRA account holders who meet the minimum age of {age}. Employees of the organiser and their households are not eligible.',
  'lob.privacyCopy':'Only your display name is shown to other players. Your email address is never published in the lobby, the table map, the leaderboard or the activity feed.',
  'lob.fairPlayCopy':'Cards are dealt and evaluated on the server. Collusion, multiple accounts and stalling are grounds for disqualification, reviewed by a person before any prize is withheld.',
  'lob.rulesMissing':'The official rules for this tournament have not been published yet.',
  'lob.demo':'Practice table','lob.demoNote':'Demo play cannot enter tournaments, win tickets or appear in rankings.',
  'lob.noTournament':'No tournament is open yet','lob.noTournamentCopy':'The next legally reviewed tournament appears here when registration opens.',
  'lob.others':'Also scheduled','lob.loading':'Opening the lobby…'
});
Object.assign(uk,{
  'lob.status.registration_open':'Реєстрація відкрита','lob.status.closing_soon':'Реєстрація закривається',
  'lob.status.starting_soon':'Скоро початок','lob.status.scheduled':'Заплановано','lob.status.live':'Наживо',
  'lob.status.paused':'Призупинено','lob.status.completed':'Завершено','lob.status.cancelled':'Скасовано',
  'lob.status.unavailable':'Недоступно',
  'lob.closesIn':'Реєстрація закриється через','lob.startsIn':'Початок через','lob.days':'д','lob.hours':'г','lob.min':'хв','lob.sec':'с',
  'lob.act.register':'Зареєструватися','lob.act.check_in':'Відмітитися','lob.act.registered':'Реєстрацію підтверджено',
  'lob.act.join_table':'До вашого столу','lob.act.resume_table':'Продовжити гру','lob.act.view_results':'Переглянути результати',
  'lob.act.sign_in':'Увійдіть, щоб взяти участь','lob.act.full':'Місць немає','lob.act.closed':'Реєстрацію закрито',
  'lob.act.eliminated':'Ви вибули з турніру','lob.act.cancelled':'Турнір скасовано',
  'lob.working':'Виконуємо…','lob.retry':'Спробувати знову','lob.offline':'Втрачено зв’язок із сервером. Повторюємо…',
  'lob.free':'Безкоштовно · Купівля не потрібна · Фішки не мають грошової цінності · Призи — квитки на події',
  'lob.info':'Турнір','lob.round':'Раунд','lob.players':'Гравці','lob.venue':'Подія',
  'lob.deadline':'Реєстрація закривається','lob.start':'Початок','lob.duration':'Орієнтовна тривалість','lob.gameType':'Гра',
  'lob.holdem':'Безлімітний Texas Hold’em','lob.stack':'Стартовий стек','lob.blinds':'Структура блайндів',
  'lob.blindsValue':'{levels} рівнів · по {minutes} хв','lob.rounds':'Раунди','lob.advancement':'Проходження',
  'lob.advancementValue':'Топ-{n} з кожного столу','lob.prizes':'Призи','lob.place':'Місце',
  'lob.field':'Учасники','lob.registered':'Зареєстровано','lob.checkedIn':'Відмітилися','lob.active':'У грі',
  'lob.eliminated':'Вибули','lob.tables':'Столи','lob.openSeats':'Вільні місця','lob.uncapped':'Без обмежень',
  'lob.capacity':'{n} з {max} місць','lob.recent':'Останні заявки','lob.noneYet':'Ще ніхто не зареєструвався',
  'lob.noneYetCopy':'Будьте першим. Реєстрація безкоштовна.',
  'lob.pass':'Ваш турнірний пропуск','lob.passNumber':'Заявка','lob.passStatus':'Статус','lob.passRound':'Раунд',
  'lob.passTable':'Стіл','lob.passSeat':'Місце','lob.passCheck':'Відмітка','lob.passNext':'Наступний крок',
  'lob.notCheckedIn':'Не відмічено','lob.awaitingSeat':'Місце призначать на початку турніру',
  'lob.map':'Карта столів','lob.mapEmpty':'Столи з’являться на початку турніру',
  'lob.tableSeats':'{used} з {size} за столом','lob.yourTable':'Ваш стіл','lob.openTable':'Відкрити стіл',
  'lob.hand':'Роздача {n}','lob.bracket':'Прогрес','lob.leaderboard':'Фішки',
  'lob.rank':'#','lob.chips':'Фішки','lob.leaderEmpty':'Підрахунок фішок з’явиться після роздачі',
  'lob.activity':'Події','lob.activityEmpty':'Поки нічого не сталося',
  'lob.ev.registration':'{name} зареєструвався','lob.ev.elimination':'{name} вибув',
  'lob.ev.state_registration_open':'Реєстрацію відкрито','lob.ev.state_registration_locked':'Реєстрацію закрито',
  'lob.ev.state_round_one':'Розпочався перший раунд','lob.ev.state_round_two':'Розпочався другий раунд',
  'lob.ev.state_final_round':'Розпочався фінал','lob.ev.state_completed':'Турнір завершено',
  'lob.ev.state_paused':'Турнір призупинено','lob.ev.state_resumed':'Турнір відновлено',
  'lob.ev.state_cancelled':'Турнір скасовано','lob.ev.state_scheduled':'Турнір опубліковано',
  'lob.ev.round_seated':'Гравців розсаджено',
  'lob.podium':'Підсумки','lob.winner':'Переможець','lob.prizePending':'Приз на розгляді',
  'lob.prizeDelivered':'Квитки видано','lob.myRewards':'Ваші квитки',
  'lob.docs':'Правила та політики','lob.rules':'Офіційні правила','lob.eligibility':'Право участі',
  'lob.privacy':'Приватність','lob.fairPlay':'Чесна гра',
  'lob.eligibilityCopy':'Участь безкоштовна і відкрита для власників акаунтів ISKRA, які досягли {age} років. Співробітники організатора та їхні домогосподарства участі не беруть.',
  'lob.privacyCopy':'Іншим гравцям видно лише ваше ім’я за столом. Вашу електронну адресу ніколи не публікують у лобі, на карті столів, у рейтингу чи у стрічці подій.',
  'lob.fairPlayCopy':'Карти роздає та оцінює сервер. Змова, кілька акаунтів і затягування часу є підставою для дискваліфікації, яку розглядає людина, перш ніж приз буде утримано.',
  'lob.rulesMissing':'Офіційні правила цього турніру ще не опубліковано.',
  'lob.demo':'Тренувальний стіл','lob.demoNote':'Демо-гра не дає участі в турнірах, квитків чи місця в рейтингу.',
  'lob.noTournament':'Турнір ще не відкрито','lob.noTournamentCopy':'Наступний юридично погоджений турнір з’явиться тут після відкриття реєстрації.',
  'lob.others':'Також заплановано','lob.loading':'Відкриваємо лобі…'
});
Object.assign(ru,{
  'lob.status.registration_open':'Регистрация открыта','lob.status.closing_soon':'Регистрация закрывается',
  'lob.status.starting_soon':'Скоро начало','lob.status.scheduled':'Запланировано','lob.status.live':'В эфире',
  'lob.status.paused':'Приостановлен','lob.status.completed':'Завершен','lob.status.cancelled':'Отменен',
  'lob.status.unavailable':'Недоступно',
  'lob.closesIn':'Регистрация закроется через','lob.startsIn':'Начало через','lob.days':'д','lob.hours':'ч','lob.min':'мин','lob.sec':'с',
  'lob.act.register':'Зарегистрироваться','lob.act.check_in':'Отметиться','lob.act.registered':'Регистрация подтверждена',
  'lob.act.join_table':'К вашему столу','lob.act.resume_table':'Продолжить игру','lob.act.view_results':'Смотреть результаты',
  'lob.act.sign_in':'Войдите, чтобы участвовать','lob.act.full':'Мест нет','lob.act.closed':'Регистрация закрыта',
  'lob.act.eliminated':'Вы выбыли из турнира','lob.act.cancelled':'Турнир отменен',
  'lob.working':'Выполняем…','lob.retry':'Повторить','lob.offline':'Потеряна связь с сервером. Повторяем…',
  'lob.free':'Бесплатно · Покупка не требуется · Фишки не имеют денежной ценности · Призы — билеты на события',
  'lob.info':'Турнир','lob.round':'Раунд','lob.players':'Игроки','lob.venue':'Событие',
  'lob.deadline':'Регистрация закрывается','lob.start':'Начало','lob.duration':'Примерная длительность','lob.gameType':'Игра',
  'lob.holdem':'Безлимитный Texas Hold’em','lob.stack':'Стартовый стек','lob.blinds':'Структура блайндов',
  'lob.blindsValue':'{levels} уровней · по {minutes} мин','lob.rounds':'Раунды','lob.advancement':'Проход дальше',
  'lob.advancementValue':'Топ-{n} с каждого стола','lob.prizes':'Призы','lob.place':'Место',
  'lob.field':'Участники','lob.registered':'Зарегистрировано','lob.checkedIn':'Отметились','lob.active':'В игре',
  'lob.eliminated':'Выбыли','lob.tables':'Столы','lob.openSeats':'Свободные места','lob.uncapped':'Без ограничений',
  'lob.capacity':'{n} из {max} мест','lob.recent':'Последние заявки','lob.noneYet':'Пока никто не зарегистрировался',
  'lob.noneYetCopy':'Станьте первым. Регистрация бесплатна.',
  'lob.pass':'Ваш турнирный пропуск','lob.passNumber':'Заявка','lob.passStatus':'Статус','lob.passRound':'Раунд',
  'lob.passTable':'Стол','lob.passSeat':'Место','lob.passCheck':'Отметка','lob.passNext':'Следующий шаг',
  'lob.notCheckedIn':'Не отмечен','lob.awaitingSeat':'Место назначат при старте турнира',
  'lob.map':'Карта столов','lob.mapEmpty':'Столы появятся при старте турнира',
  'lob.tableSeats':'{used} из {size} за столом','lob.yourTable':'Ваш стол','lob.openTable':'Открыть стол',
  'lob.hand':'Раздача {n}','lob.bracket':'Прогресс','lob.leaderboard':'Фишки',
  'lob.rank':'#','lob.chips':'Фишки','lob.leaderEmpty':'Подсчет фишек появится после раздачи',
  'lob.activity':'События','lob.activityEmpty':'Пока ничего не произошло',
  'lob.ev.registration':'{name} зарегистрировался','lob.ev.elimination':'{name} выбыл',
  'lob.ev.state_registration_open':'Регистрация открыта','lob.ev.state_registration_locked':'Регистрация закрыта',
  'lob.ev.state_round_one':'Начался первый раунд','lob.ev.state_round_two':'Начался второй раунд',
  'lob.ev.state_final_round':'Начался финал','lob.ev.state_completed':'Турнир завершен',
  'lob.ev.state_paused':'Турнир приостановлен','lob.ev.state_resumed':'Турнир возобновлен',
  'lob.ev.state_cancelled':'Турнир отменен','lob.ev.state_scheduled':'Турнир опубликован',
  'lob.ev.round_seated':'Игроки рассажены',
  'lob.podium':'Итоги','lob.winner':'Победитель','lob.prizePending':'Приз на рассмотрении',
  'lob.prizeDelivered':'Билеты выданы','lob.myRewards':'Ваши билеты',
  'lob.docs':'Правила и политики','lob.rules':'Официальные правила','lob.eligibility':'Право участия',
  'lob.privacy':'Приватность','lob.fairPlay':'Честная игра',
  'lob.eligibilityCopy':'Участие бесплатное и открыто для владельцев аккаунтов ISKRA, достигших {age} лет. Сотрудники организатора и их домохозяйства не участвуют.',
  'lob.privacyCopy':'Другим игрокам видно только ваше имя за столом. Ваш адрес электронной почты никогда не публикуется в лобби, на карте столов, в рейтинге или в ленте событий.',
  'lob.fairPlayCopy':'Карты раздает и оценивает сервер. Сговор, несколько аккаунтов и затягивание времени являются основанием для дисквалификации, которую рассматривает человек, прежде чем приз будет удержан.',
  'lob.rulesMissing':'Официальные правила этого турнира еще не опубликованы.',
  'lob.demo':'Тренировочный стол','lob.demoNote':'Демо-игра не дает участия в турнирах, билетов или места в рейтинге.',
  'lob.noTournament':'Турнир еще не открыт','lob.noTournamentCopy':'Следующий юридически согласованный турнир появится здесь после открытия регистрации.',
  'lob.others':'Также запланировано','lob.loading':'Открываем лобби…'
});

Object.assign(en,{
  'arcade.noEvent':'No upcoming event competition','arcade.playingFor':'Playing for','arcade.boardFor':'Competition for',
  'arcade.closesIn':'Competition closes in','arcade.qualified':'Qualified players','arcade.needEntries':'{count} more needed to finalize rewards',
  'arcade.thresholdMet':'Reward threshold reached','arcade.closed':'Competition closed','arcade.finalized':'Results finalized',
  'arcade.awaitingMinimum':'The board is closed and needs {count} more qualified players before rewards can be finalized.',
  'arcade.closedCopy':'The countdown has ended. Final results and private reward codes are delivered by email.','arcade.provisional':'Provisional rank #{rank}',
  'play.firstHead':'Free ticket','play.firstCopy':'Rank one receives one free ticket for this event.',
  'play.topWin':'Final rewards are emailed after the board closes'
});
Object.assign(uk,{
  'arcade.noEvent':'Немає конкурсу для майбутньої події','arcade.playingFor':'Гра за','arcade.boardFor':'Конкурс для',
  'arcade.closesIn':'До завершення конкурсу','arcade.qualified':'Кваліфіковані гравці','arcade.needEntries':'Ще {count} до фіналізації нагород',
  'arcade.thresholdMet':'Мінімум для нагород досягнуто','arcade.closed':'Конкурс завершено','arcade.finalized':'Результати затверджено',
  'arcade.awaitingMinimum':'Таблицю закрито. Для фіналізації нагород потрібно ще {count} кваліфікованих гравців.',
  'arcade.closedCopy':'Відлік завершено. Фінальні результати та приватні коди нагород надсилаються email.','arcade.provisional':'Попереднє місце №{rank}',
  'play.firstHead':'Безкоштовний квиток','play.firstCopy':'Перше місце отримує один безкоштовний квиток на цю подію.',
  'play.topWin':'Фінальні нагороди надсилаються після закриття таблиці'
});
Object.assign(ru,{
  'arcade.noEvent':'Нет конкурса для будущего события','arcade.playingFor':'Игра за','arcade.boardFor':'Конкурс для',
  'arcade.closesIn':'До завершения конкурса','arcade.qualified':'Квалифицированные игроки','arcade.needEntries':'Еще {count} до финализации наград',
  'arcade.thresholdMet':'Минимум для наград достигнут','arcade.closed':'Конкурс завершен','arcade.finalized':'Результаты утверждены',
  'arcade.awaitingMinimum':'Таблица закрыта. Для финализации наград нужно еще {count} квалифицированных игроков.',
  'arcade.closedCopy':'Отсчет завершен. Финальные результаты и приватные коды наград отправляются по email.','arcade.provisional':'Предварительное место №{rank}',
  'play.firstHead':'Бесплатный билет','play.firstCopy':'Первое место получает один бесплатный билет на это событие.',
  'play.topWin':'Финальные награды отправляются после закрытия таблицы'
});

/* Spark Rush arcade — hero, command panel, prize ladder and legend. */
Object.assign(en,{
  'ark.statement':'60 seconds. Three attempts. One event reward.',
  'ark.awaitingSchedule':'Open before announcement','ark.awaitingScheduleCopy':'Scores will attach automatically when the next event is published.',
  'ark.playingFor':'Playing for','ark.noEvent':'No competition is running',
  'ark.badge.open':'Open','ark.badge.closing_soon':'Closing soon','ark.badge.awaiting_minimum':'Awaiting minimum',
  'ark.badge.closed':'Closed','ark.badge.finalized':'Finalized','ark.badge.none':'No competition',
  'ark.closesIn':'Closes in','ark.days':'Days','ark.hours':'Hours','ark.min':'Min','ark.sec':'Sec',
  'ark.qualified':'{count} / {min} qualified','ark.needed':'{n} more to unlock rewards',
  'ark.chargeFull':'Minimum reached — rewards unlocked',
  'ark.attempts':'Your attempts','ark.finalStatus':'Results','ark.provisional':'Provisional',
  'ark.final':'Final','ark.pending':'Awaiting minimum',
  'ark.ladder':'Reward ladder','ark.ladderLock':'Final ranks lock when the countdown reaches zero. Private reward codes are sent by email.',
  'ark.rank1':'Free ticket','ark.rank2':'50% off','ark.rank35':'40% off','ark.rankRest':'10% off',
  'ark.rankLabel1':'Rank 1','ark.rankLabel2':'Rank 2','ark.rankLabel35':'Ranks 3–5','ark.rankLabelRest':'Every other qualified player',
  'ark.registerTitle':'Register your player ID','ark.registerCopy':'Your player ID is your name on the leaderboard and the address your reward code is sent to.',
  'ark.registerCta':'Insert credit','ark.registerBusy':'Checking…',
  'ark.hud':'Player','ark.best':'Best score','ark.rank':'Provisional rank','ark.zone':'Reward zone',
  'ark.left':'Credits left','ark.unranked':'Unranked','ark.noZone':'No reward zone yet',
  'ark.board':'Live board','ark.boardEmpty':'First place is open','ark.boardEmptyCopy':'No scores yet. The first qualifying run takes the top slot.',
  'ark.you':'You','ark.finalBoard':'View final board','ark.nextCompetition':'See next competition',
  'ark.closedTitle':'Competition closed','ark.finalizedTitle':'Results are final',
  'ark.finalizingCopy':'Results are being finalized. Reward codes are sent by email once ranks lock.',
  'ark.awaitingCopy':'This competition needs {n} more qualified players before rewards are issued.',
  'ark.finalizedCopy':'Ranks are locked and reward emails have been sent.',
  'ark.finalizedRewardCopy':'Ranks are locked. Your reward code was sent to your email.',
  'ark.noEventCopy':'No competition is open right now. The next one appears here.',
  'ark.legend':'Targets & scoring',
  'ark.legendSpark':'Orange spark','ark.legendSparkV':'100 base points',
  'ark.legendEmber':'Pale ember','ark.legendEmberV':'250 base points',
  'ark.legendRunner':'Runner','ark.legendRunnerV':'180 base points',
  'ark.legendDark':'Dark target','ark.legendDarkV':'−150 and combo reset',
  'ark.legendMiss':'Miss','ark.legendMissV':'Combo reset',
  'ark.legendSpeed':'Fast hits earn up to a 1.5× accuracy bonus.',
  'ark.legendCombo':'The combo multiplier rises every four consecutive hits, up to 5×.',
  'ark.startGame':'Start game','ark.stagePower':'Arena ready'
});
Object.assign(uk,{
  'ark.awaitingSchedule':'Відкрито до анонсу','ark.awaitingScheduleCopy':'Результати автоматично приєднаються до наступної опублікованої події.',
  'ark.statement':'60 секунд. Три спроби. Одна нагорода за подію.',
  'ark.playingFor':'Граємо за','ark.noEvent':'Змагання не проводиться',
  'ark.badge.open':'Відкрито','ark.badge.closing_soon':'Скоро закриття','ark.badge.awaiting_minimum':'Очікуємо мінімум',
  'ark.badge.closed':'Закрито','ark.badge.finalized':'Підсумовано','ark.badge.none':'Немає змагання',
  'ark.closesIn':'Закриється через','ark.days':'Дні','ark.hours':'Год','ark.min':'Хв','ark.sec':'Сек',
  'ark.qualified':'{count} / {min} кваліфіковано','ark.needed':'Ще {n}, щоб відкрити нагороди',
  'ark.chargeFull':'Мінімум досягнуто — нагороди відкрито',
  'ark.attempts':'Ваші спроби','ark.finalStatus':'Результати','ark.provisional':'Попередні',
  'ark.final':'Остаточні','ark.pending':'Очікуємо мінімум',
  'ark.ladder':'Сходи нагород','ark.ladderLock':'Остаточні місця фіксуються, коли таймер дійде до нуля. Персональні коди надсилають електронною поштою.',
  'ark.rank1':'Безкоштовний квиток','ark.rank2':'Знижка 50%','ark.rank35':'Знижка 40%','ark.rankRest':'Знижка 10%',
  'ark.rankLabel1':'1 місце','ark.rankLabel2':'2 місце','ark.rankLabel35':'3–5 місця','ark.rankLabelRest':'Кожен інший кваліфікований гравець',
  'ark.registerTitle':'Зареєструйте свій ID гравця','ark.registerCopy':'Ваш ID гравця — це ім’я в таблиці лідерів і адреса, на яку надійде код нагороди.',
  'ark.registerCta':'Вставити кредит','ark.registerBusy':'Перевіряємо…',
  'ark.hud':'Гравець','ark.best':'Найкращий результат','ark.rank':'Попереднє місце','ark.zone':'Зона нагороди',
  'ark.left':'Залишилось кредитів','ark.unranked':'Без місця','ark.noZone':'Поки без зони нагороди',
  'ark.board':'Жива таблиця','ark.boardEmpty':'Перше місце вільне','ark.boardEmptyCopy':'Результатів ще немає. Перший кваліфікований забіг займе верхній рядок.',
  'ark.you':'Ви','ark.finalBoard':'Підсумкова таблиця','ark.nextCompetition':'Наступне змагання',
  'ark.closedTitle':'Змагання закрито','ark.finalizedTitle':'Результати остаточні',
  'ark.finalizingCopy':'Результати підсумовуються. Коди нагород надішлють поштою після фіксації місць.',
  'ark.awaitingCopy':'Цьому змаганню потрібно ще {n} кваліфікованих гравців, перш ніж будуть видані нагороди.',
  'ark.finalizedCopy':'Місця зафіксовано, листи з нагородами надіслано.',
  'ark.finalizedRewardCopy':'Місця зафіксовано. Ваш код нагороди надіслано на пошту.',
  'ark.noEventCopy':'Зараз немає відкритих змагань. Наступне з’явиться тут.',
  'ark.legend':'Цілі та підрахунок',
  'ark.legendSpark':'Помаранчева іскра','ark.legendSparkV':'100 базових очок',
  'ark.legendEmber':'Бліда жарина','ark.legendEmberV':'250 базових очок',
  'ark.legendRunner':'Бігун','ark.legendRunnerV':'180 базових очок',
  'ark.legendDark':'Темна ціль','ark.legendDarkV':'−150 і скидання комбо',
  'ark.legendMiss':'Промах','ark.legendMissV':'Скидання комбо',
  'ark.legendSpeed':'Швидкі влучання дають до 1.5× бонусу за точність.',
  'ark.legendCombo':'Множник комбо зростає кожні чотири влучання поспіль, до 5×.',
  'ark.startGame':'Почати гру','ark.stagePower':'Арена готова'
});
Object.assign(ru,{
  'ark.awaitingSchedule':'Открыто до анонса','ark.awaitingScheduleCopy':'Результаты автоматически прикрепятся к следующему опубликованному событию.',
  'ark.statement':'60 секунд. Три попытки. Одна награда за событие.',
  'ark.playingFor':'Играем за','ark.noEvent':'Соревнование не проводится',
  'ark.badge.open':'Открыто','ark.badge.closing_soon':'Скоро закрытие','ark.badge.awaiting_minimum':'Ждем минимум',
  'ark.badge.closed':'Закрыто','ark.badge.finalized':'Подведено','ark.badge.none':'Нет соревнования',
  'ark.closesIn':'Закроется через','ark.days':'Дни','ark.hours':'Час','ark.min':'Мин','ark.sec':'Сек',
  'ark.qualified':'{count} / {min} квалифицировано','ark.needed':'Еще {n}, чтобы открыть награды',
  'ark.chargeFull':'Минимум достигнут — награды открыты',
  'ark.attempts':'Ваши попытки','ark.finalStatus':'Результаты','ark.provisional':'Предварительные',
  'ark.final':'Окончательные','ark.pending':'Ждем минимум',
  'ark.ladder':'Лестница наград','ark.ladderLock':'Окончательные места фиксируются, когда таймер дойдет до нуля. Персональные коды отправляются по электронной почте.',
  'ark.rank1':'Бесплатный билет','ark.rank2':'Скидка 50%','ark.rank35':'Скидка 40%','ark.rankRest':'Скидка 10%',
  'ark.rankLabel1':'1 место','ark.rankLabel2':'2 место','ark.rankLabel35':'3–5 места','ark.rankLabelRest':'Каждый другой квалифицированный игрок',
  'ark.registerTitle':'Зарегистрируйте свой ID игрока','ark.registerCopy':'Ваш ID игрока — это имя в таблице лидеров и адрес, на который придет код награды.',
  'ark.registerCta':'Вставить кредит','ark.registerBusy':'Проверяем…',
  'ark.hud':'Игрок','ark.best':'Лучший результат','ark.rank':'Предварительное место','ark.zone':'Зона награды',
  'ark.left':'Осталось кредитов','ark.unranked':'Без места','ark.noZone':'Пока без зоны награды',
  'ark.board':'Живая таблица','ark.boardEmpty':'Первое место свободно','ark.boardEmptyCopy':'Результатов пока нет. Первый квалифицированный забег займет верхнюю строку.',
  'ark.you':'Вы','ark.finalBoard':'Итоговая таблица','ark.nextCompetition':'Следующее соревнование',
  'ark.closedTitle':'Соревнование закрыто','ark.finalizedTitle':'Результаты окончательные',
  'ark.finalizingCopy':'Результаты подводятся. Коды наград отправят по почте после фиксации мест.',
  'ark.awaitingCopy':'Этому соревнованию нужно еще {n} квалифицированных игроков, прежде чем будут выданы награды.',
  'ark.finalizedCopy':'Места зафиксированы, письма с наградами отправлены.',
  'ark.finalizedRewardCopy':'Места зафиксированы. Ваш код награды отправлен на почту.',
  'ark.noEventCopy':'Сейчас нет открытых соревнований. Следующее появится здесь.',
  'ark.legend':'Цели и подсчет',
  'ark.legendSpark':'Оранжевая искра','ark.legendSparkV':'100 базовых очков',
  'ark.legendEmber':'Бледный уголек','ark.legendEmberV':'250 базовых очков',
  'ark.legendRunner':'Бегун','ark.legendRunnerV':'180 базовых очков',
  'ark.legendDark':'Темная цель','ark.legendDarkV':'−150 и сброс комбо',
  'ark.legendMiss':'Промах','ark.legendMissV':'Сброс комбо',
  'ark.legendSpeed':'Быстрые попадания дают до 1.5× бонуса за точность.',
  'ark.legendCombo':'Множитель комбо растет каждые четыре попадания подряд, до 5×.',
  'ark.startGame':'Начать игру','ark.stagePower':'Арена готова'
});

/* Wellness partner. The business name and the practitioner's name are never
   translated; only the descriptive copy is. Every line below comes from the
   partner's own card — nothing about their services is invented here. */
Object.assign(en,{
  'partners.wellnessRole':'Wellness partner',
  'partners.wellnessTagline':'Strong hands. Gentle touch.',
  'partners.wellnessCopy':'Every body tells a story. I listen, I understand, and I create a personalized massage experience that helps you feel better, move better, and live better.',
  'partners.wellnessMotto':'We are all unique. Your massage should be unique too.',
  'partners.wellnessPractitioner':'Massage therapist',
  'partners.wellnessAlt':'Abstract warm light forms leaning toward one another across a dark field.'
});
Object.assign(uk,{
  'partners.wellnessRole':'Партнер із велнесу',
  'partners.wellnessTagline':'Сильні руки. Ніжний дотик.',
  'partners.wellnessCopy':'Кожне тіло розповідає свою історію. Я слухаю, я розумію і створюю персональний масаж, який допомагає почуватися краще, рухатися краще та жити краще.',
  'partners.wellnessMotto':'Ми всі унікальні. Ваш масаж теж має бути унікальним.',
  'partners.wellnessPractitioner':'Масажист',
  'partners.wellnessAlt':'Абстрактні форми теплого світла схиляються одна до одної на темному тлі.'
});
Object.assign(ru,{
  'partners.wellnessRole':'Партнер по велнесу',
  'partners.wellnessTagline':'Сильные руки. Нежное прикосновение.',
  'partners.wellnessCopy':'Каждое тело рассказывает свою историю. Я слушаю, я понимаю и создаю персональный массаж, который помогает чувствовать себя лучше, двигаться лучше и жить лучше.',
  'partners.wellnessMotto':'Мы все уникальны. Ваш массаж тоже должен быть уникальным.',
  'partners.wellnessPractitioner':'Массажист',
  'partners.wellnessAlt':'Абстрактные формы теплого света склоняются друг к другу на темном фоне.'
});

Object.assign(en,{'language.fr':'French'});
Object.assign(uk,{'language.fr':'Французька'});
Object.assign(ru,{'language.fr':'Французский'});
const dictionaries={en,uk,ru,fr};
Object.entries(additions).forEach(([locale,copy])=>Object.assign(dictionaries[locale],copy));
const I18nContext=createContext(null);

export function I18nProvider({children}){
  const [language,setLanguage]=useState(()=>{
    const stored=localStorage.getItem(STORAGE_KEY);
    if(stored && dictionaries[stored]) return stored;
    const browser=navigator.language?.toLowerCase() || '';
    return browser.startsWith('fr') ? 'fr' : browser.startsWith('uk') ? 'uk' : browser.startsWith('ru') ? 'ru' : 'en';
  });
  useEffect(()=>{
    localStorage.setItem(STORAGE_KEY,language);
    document.documentElement.lang=language;
  },[language]);
  const t=(key,values={})=>{
    let value=dictionaries[language]?.[key] ?? en[key] ?? key;
    Object.entries(values).forEach(([name,replacement])=>{value=value.replaceAll(`{${name}}`,String(replacement));});
    return value;
  };
  const formatDate=(value,options)=>new Intl.DateTimeFormat(LOCALES[language],{timeZone:'UTC',...options}).format(new Date(value));
  return <I18nContext.Provider value={{language,setLanguage,t,formatDate,locale:LOCALES[language]}}>{children}</I18nContext.Provider>;
}

export const useI18n=()=>useContext(I18nContext);
