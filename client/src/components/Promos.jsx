import Photo from './Photo.jsx';
import { useToast } from './Toasts.jsx';

const OFFERS = [
  { n: '01', code: 'FOURPLAY', title: 'Four in, one free',
    text: 'Roll up with four and the fourth ticket is on us. Applied at checkout when quantity hits four.' },
  { n: '02', code: 'RESIDENT8', title: 'Residents, 8 euro',
    text: 'Thursdays are ours. Our own DJs, no guests. Student ID at the door takes it to five.' }
];

export default function Promos({ onTickets }) {
  const toast = useToast();

  const copy = code => {
    const done = () => toast(`Code <b>${code}</b> copied`, '✦');
    if (navigator.clipboard) navigator.clipboard.writeText(code).then(done).catch(() => toast(`Your code is <b>${code}</b>`));
    else toast(`Your code is <b>${code}</b>`);
  };

  return (
    <section className="section" id="promos" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <div className="sec-head">
          <h2 className="h-lg rv">Cheaper ways through the door</h2>
        </div>

        <div className="offer-hero rv">
          <Photo plate="queue" alt="The doorway at ISKRA" />
          <div className="offer-hero-body">
            <span className="tag tag-ember" style={{ alignSelf:'flex-start', marginBottom:18 }}>
              Ends Sunday 23:59
            </span>
            <h3>Early bird<br />burns first</h3>
            <p>The first 200 tickets to every September night go at 40 percent off. No queue,
               no door price, no negotiating at 1am.</p>
            <div className="offer-actions">
              <button className="btn btn-primary" onClick={() => onTickets('next')}>Get tickets</button>
              <button className="btn btn-ghost" onClick={() => copy('SPARK40')}>Copy SPARK40</button>
            </div>
          </div>
        </div>

        <div className="offer-rows">
          {OFFERS.map(o => (
            <div className="offer rv" key={o.code}>
              <div className="offer-num">{o.n}</div>
              <div>
                <h4>{o.title}</h4>
                <p>{o.text}</p>
                <button className="code" onClick={() => copy(o.code)}>
                  <span>{o.code}</span><small>Copy</small>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
