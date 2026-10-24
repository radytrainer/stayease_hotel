'use client';
import { useLang, useT } from '../lib/i18n';
import type { Lang } from '../lib/lang';

const options:{value:Lang;label:string;name:string}[]=[
  {value:'en',label:'EN',name:'English'},
  {value:'km',label:'ខ្មែរ',name:'ភាសាខ្មែរ'},
];

/** Switches the interface between English and Khmer; remembered in a cookie for the next visit. */
export default function LanguageSwitch(){
  const {lang,setLang}=useLang();
  const t=useT();
  return <div role="group" aria-label={t('Language')} className="inline-flex items-center rounded-full bg-white/10 p-0.5 ring-1 ring-white/15">
    {options.map(o=><button key={o.value} type="button" lang={o.value} aria-pressed={lang===o.value} onClick={()=>setLang(o.value)} aria-label={o.name}
      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${lang===o.value?'bg-white text-brand-800 shadow-sm':'text-brand-50 hover:bg-white/10'}`}>{o.label}</button>)}
  </div>;
}
