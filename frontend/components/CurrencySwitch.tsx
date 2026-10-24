'use client';
import { useCurrency, type DisplayCurrency } from '../lib/currency';
import { useT } from '../lib/i18n';

const options:{value:DisplayCurrency;label:string;name:string}[]=[
  {value:'USD',label:'$ USD',name:'US dollars'},
  {value:'KHR',label:'KHR ៛',name:'Cambodian riel'},
];

/** Chooses the display currency. Payments are always charged in the hotel's currency. */
export default function CurrencySwitch({tone='dark'}:{tone?:'dark'|'light'}){
  const {display,setDisplay,rateNote}=useCurrency();
  const t=useT();
  const dark=tone==='dark';
  return <div role="group" aria-label={t('Show prices in')} title={display==='KHR'?rateNote:undefined}
    className={`inline-flex items-center rounded-full p-0.5 ${dark?'bg-white/10 ring-1 ring-white/15':'bg-ink/5 ring-1 ring-ink/10'}`}>
    <span className={`hidden px-2 text-[11px] min-[400px]:inline ${dark?'text-brand-100':'text-ink-muted'}`} aria-hidden="true">{t('Prices in')}</span>
    {options.map(o=><button key={o.value} type="button" aria-pressed={display===o.value} onClick={()=>setDisplay(o.value)} aria-label={t(o.name)}
      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${display===o.value
        ?(dark?'bg-white text-brand-800 shadow-sm':'bg-white text-brand-700 shadow-sm ring-1 ring-ink/10')
        :(dark?'text-brand-50 hover:bg-white/10':'text-ink-muted hover:text-ink')}`}>{o.label}</button>)}
  </div>;
}
