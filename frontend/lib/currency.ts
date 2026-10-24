'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { formatMoney } from './format';
import { translate } from './lang';

/**
 * Display currency for guests: prices are stored and charged in the hotel's currency (USD), and can be
 * shown in Cambodian riel at the National Bank of Cambodia's rate. Display only: nothing that is charged
 * or refunded is ever computed from a converted amount.
 */
export type DisplayCurrency='USD'|'KHR';
export type Rate={khrPerUsd:number;publishedOn:string;source:string};

const STORAGE_KEY='stayease-display-currency';
const EVENT='stayease-currency';
/** Used only if the rate can't be loaded: NBC official rate published 16 Oct 2026. */
const FALLBACK:Rate={khrPerUsd:4067,publishedOn:'2026-10-16',source:'National Bank of Cambodia official rate'};

let ratePromise:Promise<Rate>|null=null;
function loadRate(){
  ratePromise??=api<{rates:{KHR:number};publishedOn:string;source:string}>('/exchange-rates',{auth:false})
    .then(r=>({khrPerUsd:Number(r.rates.KHR),publishedOn:r.publishedOn,source:r.source}))
    .catch(()=>{ratePromise=null;return FALLBACK;});
  return ratePromise;
}

function stored():DisplayCurrency{try{return localStorage.getItem(STORAGE_KEY)==='KHR'?'KHR':'USD';}catch{return 'USD';}}

/**
 * Riel has no coins in circulation, so prices are rounded to the nearest 100 riel. The sign follows the number,
 * as it is usually written in Cambodia (e.g. 187,100៛).
 */
export function formatRiel(amount:number){
  const rounded=Math.round(amount/100)*100;
  return `${new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(rounded)}៛`;
}

export function useCurrency(){
  const [display,setDisplayState]=useState<DisplayCurrency>('USD');
  const [rate,setRate]=useState<Rate>(FALLBACK);

  useEffect(()=>{
    setDisplayState(stored());
    const sync=()=>setDisplayState(stored());
    window.addEventListener(EVENT,sync);window.addEventListener('storage',sync);
    return()=>{window.removeEventListener(EVENT,sync);window.removeEventListener('storage',sync);};
  },[]);
  useEffect(()=>{if(display==='KHR')void loadRate().then(setRate);},[display]);

  const setDisplay=useCallback((next:DisplayCurrency)=>{
    try{localStorage.setItem(STORAGE_KEY,next);}catch{}
    setDisplayState(next);window.dispatchEvent(new Event(EVENT));
  },[]);

  /** Formats an amount in the guest's chosen currency; amounts in other currencies are shown as they are. */
  const format=useCallback((amount:number|string|null|undefined,currency='USD')=>{
    const value=Number(amount??0),from=currency.trim().toUpperCase();
    if(display==='KHR'&&from==='USD')return formatRiel(value*rate.khrPerUsd);
    if(display==='USD'&&from==='KHR')return formatMoney(value/rate.khrPerUsd,'USD');
    return from==='KHR'?formatRiel(value):formatMoney(value,from);
  },[display,rate]);

  /** True when what the guest sees differs from the currency they will be charged in. */
  const converted=useCallback((currency='USD')=>display!==currency.trim().toUpperCase(),[display]);

  const rateNote=translate('At {rate}៛ per US$1 ({source}, {date}).',{rate:rate.khrPerUsd.toLocaleString('en-US'),source:translate(rate.source),date:rate.publishedOn});
  return {display,setDisplay,format,converted,rate,rateNote};
}
