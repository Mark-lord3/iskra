import frenchCopy from '../poker-fr.js';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import TournamentLobby from '../components/TournamentLobby.jsx';
import {featuredTournament} from '../poker/lobby.js';
import Footer from '../components/Footer.jsx';
import Nav from '../components/Nav.jsx';
import PromoBar from '../components/PromoBar.jsx';
import PokerTable from '../components/poker/PokerTable.jsx';
import ActionBar from '../components/poker/ActionBar.jsx';
import {ConnectionBanner,StageBanner,TableSkeleton} from '../components/poker/Overlays.jsx';
import {useTableStream,useLocalStream} from '../poker/stream.js';
import {api} from '../api.js';
import {useI18n} from '../i18n.jsx';
import {useToast} from '../components/Toasts.jsx';

const COPY={
  fr:frenchCopy,
  en:{lobby:'Tournament lobby',lead:'Free Texas Hold’em for ISKRA event tickets. No purchase necessary.',demo:'Try the table',live:'Open tournaments',empty:'No tournament is open yet',emptyCopy:'The next legally reviewed tournament will appear here when registration opens.',free:'FREE ENTRY',players:'players',details:'View tournament',practice:'Practice table',practiceCopy:'Play three hands against two bots. Demo chips have no value and cannot win prizes.',start:'Start demo',hand:'Hand',pot:'Pot',board:'Board',next:'Next hand',gate:'Demo complete',gateCopy:'Create a free ISKRA account to enter real tournaments and compete for event tickets.',account:'Create or sign in',rules:'Official rules',prizes:'Ticket prizes',registered:'Registered',register:'Register free',checkin:'Check in',withdraw:'Withdraw',age:'I confirm I meet the minimum age.',accept:'I have read and accept the official rules.',name:'Table display name',countdown:'Registration closes',results:'Results',table:'Go to my table',waiting:'Waiting for the tournament to start.',noCash:'No purchase necessary. Free entry. Chips have no cash value.',retry:'Try again',
    sound:'Sound',soundOn:'Sound on',soundOff:'Sound off',sitOut:'Sit out',sitIn:'Sit back in',connecting:'Connecting to the table…',reconnecting:'Connection lost. Reconnecting…',offline:'The table is unreachable. Retrying…',sending:'Sending…',accepted:'Action accepted',rejected:'Action rejected',waitingHand:'Waiting for the next hand',blindsUp:'Blinds up',eliminated:'is eliminated',splitPot:'Split pot',wins:'Wins the pot',showdown:'Showdown',mainPot:'Main',sidePot:'Side',loading:'Loading the table',newHand:'Hand',dismiss:'Dismiss'},
  uk:{lobby:'Турнірне лобі',lead:'Безкоштовний Texas Hold’em за квитки на події ISKRA. Купівля не потрібна.',demo:'Спробувати стіл',live:'Відкриті турніри',empty:'Турнір ще не відкрито',emptyCopy:'Наступний турнір з юридичним погодженням з’явиться тут після відкриття реєстрації.',free:'ВХІД БЕЗКОШТОВНИЙ',players:'гравців',details:'Переглянути турнір',practice:'Тренувальний стіл',practiceCopy:'Зіграйте три роздачі проти двох ботів. Демо-фішки не мають цінності та не дають призів.',start:'Почати демо',hand:'Роздача',pot:'Банк',board:'Стіл',next:'Наступна роздача',gate:'Демо завершено',gateCopy:'Створіть безкоштовний акаунт ISKRA, щоб брати участь у турнірах за квитки.',account:'Створити акаунт або увійти',rules:'Офіційні правила',prizes:'Квиткові призи',registered:'Зареєстровано',register:'Безкоштовна реєстрація',checkin:'Відмітитися',withdraw:'Відмовитися',age:'Підтверджую відповідність мінімальному віку.',accept:'Я прочитав(-ла) та приймаю офіційні правила.',name:'Ім’я за столом',countdown:'Реєстрація закривається',results:'Результати',table:'До мого столу',waiting:'Очікуємо початку турніру.',noCash:'Купівля не потрібна. Вхід безкоштовний. Фішки не мають грошової цінності.',retry:'Спробувати знову',
    sound:'Звук',soundOn:'Звук увімкнено',soundOff:'Звук вимкнено',sitOut:'Пропустити',sitIn:'Повернутися',connecting:'Підключення до столу…',reconnecting:'З’єднання втрачено. Перепідключення…',offline:'Стіл недоступний. Повторюємо…',sending:'Надсилання…',accepted:'Дію прийнято',rejected:'Дію відхилено',waitingHand:'Очікуємо наступну роздачу',blindsUp:'Блайнди зросли',eliminated:'вибуває',splitPot:'Розділений банк',wins:'Забирає банк',showdown:'Розкриття',mainPot:'Основний',sidePot:'Побічний',loading:'Завантаження столу',newHand:'Роздача',dismiss:'Закрити'},
  ru:{lobby:'Турнирное лобби',lead:'Бесплатный Texas Hold’em за билеты на события ISKRA. Покупка не требуется.',demo:'Попробовать стол',live:'Открытые турниры',empty:'Турнир еще не открыт',emptyCopy:'Следующий юридически согласованный турнир появится здесь после открытия регистрации.',free:'ВХОД БЕСПЛАТНЫЙ',players:'игроков',details:'Открыть турнир',practice:'Тренировочный стол',practiceCopy:'Сыграйте три раздачи против двух ботов. Демо-фишки не имеют ценности и не дают призов.',start:'Начать демо',hand:'Раздача',pot:'Банк',board:'Стол',next:'Следующая раздача',gate:'Демо завершено',gateCopy:'Создайте бесплатный аккаунт ISKRA, чтобы участвовать в турнирах за билеты.',account:'Создать аккаунт или войти',rules:'Официальные правила',prizes:'Билетные призы',registered:'Зарегистрировано',register:'Бесплатная регистрация',checkin:'Отметиться',withdraw:'Отказаться',age:'Подтверждаю соответствие минимальному возрасту.',accept:'Я прочитал(-а) и принимаю официальные правила.',name:'Имя за столом',countdown:'Регистрация закрывается',results:'Результаты',table:'К моему столу',waiting:'Ожидаем начала турнира.',noCash:'Покупка не требуется. Вход бесплатный. Фишки не имеют денежной ценности.',retry:'Повторить',
    sound:'Звук',soundOn:'Звук включен',soundOff:'Звук выключен',sitOut:'Пропустить',sitIn:'Вернуться',connecting:'Подключение к столу…',reconnecting:'Соединение потеряно. Переподключение…',offline:'Стол недоступен. Повторяем…',sending:'Отправка…',accepted:'Действие принято',rejected:'Действие отклонено',waitingHand:'Ожидаем следующую раздачу',blindsUp:'Блайнды выросли',eliminated:'выбывает',splitPot:'Разделенный банк',wins:'Забирает банк',showdown:'Вскрытие',mainPot:'Основной',sidePot:'Побочный',loading:'Загрузка стола',newHand:'Раздача',dismiss:'Закрыть'}
};

const stateLabel=s=>String(s||'').replaceAll('_',' ');
const routeParts=route=>route.split('/').filter(Boolean);
const date=value=>new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
const useNarrow=()=>{
  const [narrow,setNarrow]=useState(()=>typeof matchMedia==='function'&&matchMedia('(max-width:720px)').matches);
  useEffect(()=>{if(typeof matchMedia!=='function')return;const q=matchMedia('(max-width:720px)');const on=e=>setNarrow(e.matches);q.addEventListener('change',on);return()=>q.removeEventListener('change',on);},[]);
  return narrow;
};

export default function PokerPage({route,onTickets}){
  const {language}=useI18n();const c=COPY[language]||COPY.en;const bits=routeParts(route);
  const id=bits[2];const mode=bits[3]||'';
  return <><PromoBar/><Nav onTickets={onTickets}/><main className="poker-page">
    {!id?<PokerLobby c={c}/>:mode==='table'?<LiveTable c={c}/>:mode==='results'?<Results id={id} c={c}/>:<Tournament id={id} c={c} language={language}/>}
  </main><Footer/></>;
}

function Shell({eyebrow,title,copy,children}){return <><header className="poker-hero"><div className="poker-suits" aria-hidden="true">♠ <i>♥</i> ♣ <i>♦</i></div><div className="wrap"><p className="mono">{eyebrow}</p><h1>{title}</h1><p>{copy}</p></div></header>{children}</>}

function SoundToggle({sound,c}){
  return <button type="button" className="pchip-btn psound" aria-pressed={sound.enabled}
    onClick={sound.toggle} title={sound.enabled?c.soundOn:c.soundOff}>
    <span aria-hidden="true">{sound.enabled?'♪':'✕'}</span> {c.sound}
  </button>;
}

/* ------------------------------------------------------------------ lobby */

function PokerLobby({c}){
  const {t}=useI18n();
  const [items,setItems]=useState(null);const [error,setError]=useState('');
  useEffect(()=>{api.pokerTournaments().then(setItems).catch(e=>setError(e.message));},[]);

  /* The lobby leads with whichever tournament a visitor can actually act on
     and lists the rest underneath, so the control room always has a subject. */
  const featured=useMemo(()=>featuredTournament(items||[]),[items]);
  const others=useMemo(()=>(items||[]).filter(x=>x.slug!==featured?.slug),[items,featured]);

  return <Shell eyebrow="ISKRA PLAY / 02" title={c.lobby} copy={c.lead}>
    <section className="wrap poker-lobby">
      {error&&<PokerNotice title={error} copy=""/>}

      {featured
        ? <TournamentLobby slug={featured.slug}/>
        : items && <div className="lob-empty lob-empty-page" role="status">
            <p><b>{t('lob.noTournament')}</b></p><p>{t('lob.noTournamentCopy')}</p>
          </div>}

      {others.length>0&&<div className="lob-others">
        <h3 className="lob-panel-title">{t('lob.others')}</h3>
        <div className="poker-tournament-grid">{others.map(x=><article key={x.id} className="poker-tournament-card"><div className="poker-card-top"><b>{c.free}</b><span>{stateLabel(x.state)}</span></div><h3>{x.title}</h3><p>{date(x.startsAt)}</p><dl><div><dt>{c.players}</dt><dd>{x.registeredCount}</dd></div><div><dt>Table</dt><dd>{x.tableSize}-MAX</dd></div><div><dt>Stack</dt><dd>{x.startingStack.toLocaleString()}</dd></div></dl><a className="btn btn-primary" href={`/play/poker/${x.slug}`}>{c.details}</a></article>)}</div>
      </div>}

      <DemoTable c={c}/>
    </section>
  </Shell>;
}

/* ------------------------------------------------------------------- demo */

function DemoTable({c}){
  const [demo,setDemo]=useState(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const narrow=useNarrow();
  const {event,announcements,reduced,sound}=useLocalStream(demo);
  /* One request at a time here too: the practice table uses the same guard as
     the tournament so a double tap can never send two actions. */
  const inFlight=useRef(false);
  const run=async work=>{
    if(inFlight.current)return;
    inFlight.current=true;setBusy(true);setError('');
    try{setDemo(await work());}catch(e){setError(e.message);}finally{inFlight.current=false;setBusy(false);}
  };
  const start=()=>run(()=>api.pokerDemo('GUEST'));
  const act=(type,amount=0)=>run(()=>api.pokerDemoAction(demo.demoId,type,amount));
  const complete=demo?.hand?.street==='complete';

  return <section id="demo" className="poker-demo">
    <header><div><span className="mono">DEMO / 3 HAND LIMIT</span><h2>{c.practice}</h2><p>{c.practiceCopy}</p></div>
      <div className="poker-demo-tools">{demo&&<SoundToggle sound={sound} c={c}/>}{!demo&&<button className="btn btn-primary" onClick={start} disabled={busy}>{c.start}</button>}</div>
    </header>
    {error&&<p className="poker-error" role="alert">{error}</p>}
    {demo&&<PokerTable state={demo} event={event} announcements={announcements} reduced={reduced} compact={narrow} labels={c}/>}
    {demo&&!complete&&<ActionBar legal={demo.hand?.legal||[]} onAct={act} pending={{inFlight:busy?{type:'…'}:null}}
      disabled={busy} pot={demo.hand?.pot||0} bigBlind={50} compact={narrow}
      labels={{waiting:c.waitingHand,sending:c.sending,accepted:c.accepted,rejected:c.rejected}}/>}
    {complete&&!demo.finished&&<button className="btn btn-primary poker-next" onClick={()=>run(()=>api.pokerDemoNext(demo.demoId))} disabled={busy}>{c.next}</button>}
    {demo?.finished&&<div className="poker-gate"><span>03 / 03</span><h3>{c.gate}</h3><p>{c.gateCopy}</p><a className="btn btn-primary" href="/account">{c.account}</a></div>}
    <small className="poker-disclaimer">{demo?.disclaimer||c.noCash}</small>
  </section>;
}

/* ------------------------------------------------------------- live table */

function LiveTable({c}){
  const [seat,setSeat]=useState(null);
  const [account,setAccount]=useState(null);
  const [bootError,setBootError]=useState('');
  const [stage,setStage]=useState(null);
  const narrow=useNarrow();

  useEffect(()=>{
    let alive=true;
    Promise.all([api.accountMe(),api.pokerMySeat()])
      .then(([a,s])=>{if(alive){setAccount(a);setSeat(s);}})
      .catch(e=>alive&&setBootError(e.message));
    return()=>{alive=false;};
  },[]);

  const tableId=seat?.seated?seat.tableId:null;
  const fetchSnapshot=useCallback(()=>tableId?api.pokerTable(tableId):Promise.resolve(null),[tableId]);
  const sendAction=useCallback(move=>api.pokerAction(tableId,account?.csrfToken,
    {type:move.type,amount:move.amount||0,version:move.version,actionId:move.actionId}),[tableId,account]);
  const socketUrl=useCallback(id=>{
    const protocol=location.protocol==='https:'?'wss:':'ws:';
    return `${protocol}//${location.host}/ws/poker?table=${encodeURIComponent(id)}`;
  },[]);

  const stream=useTableStream({tableId,enabled:Boolean(tableId),fetchSnapshot,sendAction,socketUrl});
  const {state,connection,event,announcements,pending,error,dismissError,send,reduced,sound}=stream;

  /* Tournament moments are raised from the same server events as everything
     else, so the banner cannot claim something the server did not say. */
  useEffect(()=>{
    if(event?.type==='stage')setStage({eyebrow:c.newHand,title:`#${event.handNumber}`});
    if(event?.type==='level')setStage({eyebrow:c.blindsUp,title:`${event.smallBlind}/${event.bigBlind}`,
      copy:event.isBreak?'Break':''});
  },[event,c]);

  const mySeat=state?.seats?.find(s=>s.isMe);
  const sittingOut=mySeat?.status==='sitting_out';
  const toggleSitOut=()=>api.pokerSitOut(tableId,account?.csrfToken,!sittingOut)
    .then(()=>fetchSnapshot().then(stream.accept)).catch(()=>{});

  if(bootError||!seat)return <Shell eyebrow="LIVE TABLE" title={c.waiting} copy={bootError||c.noCash}>
    <div className="wrap"><a href="/play/poker" className="btn btn-primary">{c.lobby}</a></div></Shell>;
  if(!seat.seated)return <Shell eyebrow="LIVE TABLE" title={c.waiting} copy={c.noCash}>
    <div className="wrap"><a href="/play/poker" className="btn btn-primary">{c.lobby}</a></div></Shell>;

  const myHandSeat=state?.hand?.seats?.find(s=>s.seat===state.mySeat);
  const isMyTurn=state?.hand?.actor!=null&&state.hand.actor===state.mySeat;

  return <Shell eyebrow={`${seat.label} / LIVE`} title={seat.tournamentTitle} copy={c.noCash}>
    <section className="wrap poker-live">
      <ConnectionBanner connection={connection} labels={c}/>
      {error&&<p className="poker-error" role="alert">{error} <button className="poker-text-button" onClick={dismissError}>{c.dismiss}</button></p>}
      <div className="poker-live-tools">
        <SoundToggle sound={sound} c={c}/>
        <button type="button" className="pchip-btn" onClick={toggleSitOut} aria-pressed={sittingOut}>
          {sittingOut?c.sitIn:c.sitOut}
        </button>
      </div>
      {!state?<TableSkeleton label={c.loading}/>:<>
        <PokerTable state={state} event={event} announcements={announcements} reduced={reduced}
          compact={narrow} labels={c}/>
        <ActionBar legal={isMyTurn?(state.hand?.legal||[]):[]} onAct={(type,amount)=>send({type,amount})}
          pending={pending} disabled={connection!=='live'&&connection!=='idle'}
          myStack={myHandSeat?.stack||0} pot={state.hand?.pot||0}
          bigBlind={state.level?.bigBlind||0} compact={narrow}
          labels={{waiting:c.waitingHand,sending:c.sending,accepted:c.accepted,rejected:c.rejected}}/>
      </>}
      <StageBanner stage={stage} reduced={reduced} onDone={()=>setStage(null)}/>
    </section>
  </Shell>;
}

/* ------------------------------------------------------------- tournament */

function Tournament({id,c,language}){
  const toast=useToast();const [item,setItem]=useState(null);const [account,setAccount]=useState(null);
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const [form,setForm]=useState({displayName:'',age:false,rules:false});
  const load=()=>Promise.all([api.pokerTournament(id,language),api.accountMe().catch(()=>null)]).then(([t,a])=>{setItem(t);setAccount(a);setForm(f=>({...f,displayName:t.myRegistration?.displayName||a?.user?.name||''}));});
  useEffect(()=>{load().catch(e=>setError(e.message));},[id,language]);
  const action=async fn=>{if(busy)return;setBusy(true);setError('');try{await fn();await load();toast('Tournament status updated.','OK');}catch(e){setError(e.message);}finally{setBusy(false);}};
  if(error&&!item)return <Shell eyebrow="ISKRA POKER" title={c.lobby} copy={error}><div className="wrap"><a className="btn btn-primary" href="/play/poker">{c.retry}</a></div></Shell>;
  if(!item)return <Shell eyebrow="ISKRA POKER" title={c.loading} copy={c.noCash}><div className="wrap"><TableSkeleton label={c.loading}/></div></Shell>;
  const reg=item.myRegistration;const canCheck=reg?.status==='registered';
  return <Shell eyebrow={`ISKRA POKER / ${stateLabel(item.state)}`} title={item.title} copy={`${date(item.startsAt)} · ${item.registeredCount} ${c.players}`}><section className="wrap poker-detail">
    <aside className="poker-prize-rail"><span className="mono">{c.prizes}</span>{item.prizes.map(p=><article key={p.placement}><b>0{p.placement}</b><div><h3>{p.ticketQuantity} × {p.ticketTier}</h3><p>{p.eventSlug} · ARV ${p.approximateRetailValue} {p.currency}</p></div></article>)}<small>{c.noCash}</small></aside>
    <div className="poker-entry"><div className="poker-entry-meta"><div><span>{c.countdown}</span><b>{date(item.registrationClosesAt)}</b></div><div><span>Starting stack</span><b>{item.startingStack.toLocaleString()}</b></div><div><span>Blinds</span><b>{item.actionTimerSeconds}s action</b></div></div>
      {error&&<p className="poker-error" role="alert">{error}</p>}
      {!account&&<PokerNotice title={c.account} copy={c.gateCopy}><a className="btn btn-primary" href="/account">{c.account}</a></PokerNotice>}
      {account&&!reg&&item.canRegisterNow&&<form className="poker-register" onSubmit={e=>{e.preventDefault();if(!form.rules)return setError(c.accept);action(()=>api.pokerRegister(item.id,account.csrfToken,{displayName:form.displayName,confirmAge:form.age,rulesVersion:item.rulesVersionId,marketingConsent:false}));}}><label><span>{c.name}</span><input minLength="3" maxLength="18" required value={form.displayName} onChange={e=>setForm({...form,displayName:e.target.value})}/></label><label className="poker-check"><input type="checkbox" required checked={form.age} onChange={e=>setForm({...form,age:e.target.checked})}/><span>{c.age}</span></label><label className="poker-check"><input type="checkbox" required checked={form.rules} onChange={e=>setForm({...form,rules:e.target.checked})}/><span>{c.accept}</span></label><button className="btn btn-primary" disabled={busy}>{c.register}</button></form>}
      {reg&&<div className="poker-registration-state"><span>{c.registered}</span><h2>{reg.displayName}</h2><p>{stateLabel(reg.status)} · {c.waiting}</p><div>{canCheck&&<button className="btn btn-primary" disabled={busy} onClick={()=>action(()=>api.pokerCheckIn(item.id,account.csrfToken))}>{c.checkin}</button>}<a className="btn btn-ghost" href={`/play/poker/${item.slug}/table`}>{c.table}</a>{['registered','checked_in'].includes(reg.status)&&<button className="poker-text-button" onClick={()=>action(()=>api.pokerWithdraw(item.id,account.csrfToken))}>{c.withdraw}</button>}</div></div>}
      {item.state==='completed'&&<a className="btn btn-primary" href={`/play/poker/${item.slug}/results`}>{c.results}</a>}
      <section className="poker-rules"><span className="mono">{c.rules}</span><h2>{c.rules}</h2><div>{item.rules?.bodyMarkdown||c.emptyCopy}</div></section>
    </div>
  </section></Shell>;
}

function Results({id,c}){const [data,setData]=useState(null);const [error,setError]=useState('');useEffect(()=>{api.pokerResults(id).then(setData).catch(e=>setError(e.message));},[id]);return <Shell eyebrow="FINAL STANDINGS" title={data?.tournament?.title||c.results} copy={error||c.noCash}><section className="wrap poker-results">{data?.standings.map((s,i)=><article key={`${s.displayName}-${i}`}><b>{String(s.placement||i+1).padStart(2,'0')}</b><div><h2>{s.displayName}</h2><span>{s.finishingChips.toLocaleString()} chips · {stateLabel(s.prizeStatus)}</span></div></article>)}{data&&!data.standings.length&&<PokerNotice title={c.waiting} copy={c.emptyCopy}/>}</section></Shell>}
function PokerNotice({title,copy,children}){return <div className="poker-notice"><span>♠</span><div><h3>{title}</h3>{copy&&<p>{copy}</p>}{children}</div></div>}
