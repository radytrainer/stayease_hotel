'use client';
import { useEffect, useState } from 'react';
import Icon from './Icon';
import { api } from '../lib/api';
import { formatDate } from '../lib/format';
import { PROMO_THEMES, promoValue, rememberPromo, type FeaturedPromo } from '../lib/promotions';
import { useT } from '../lib/i18n';

/**
 * Home-page advert for the administrator's featured promotions. Shows only offers that are bookable today,
 * so seasonal and holiday codes appear and disappear on their own dates.
 */
export default function PromoBanner({onUse}:{onUse:()=>void}){
  const [promos,setPromos]=useState<FeaturedPromo[]>([]);
  const [copied,setCopied]=useState('');
  const [chosen,setChosen]=useState('');
  const t=useT();

  useEffect(()=>{api<FeaturedPromo[]>('/promotions/featured',{auth:false}).then(setPromos).catch(()=>setPromos([]));},[]);
  if(!promos.length)return null;

  async function copy(code:string){
    try{await navigator.clipboard.writeText(code);setCopied(code);setTimeout(()=>setCopied(c=>c===code?'':c),2500);}catch{/* clipboard blocked: the code is still visible */}
  }
  function use(code:string){rememberPromo(code);setChosen(code);onUse();}

  return <section className="promo-section" aria-labelledby="promo-title">
    <div className="container">
      <h2 id="promo-title" className="visually-hidden">{t('Current offers')}</h2>
      <ul className={`promo-list${promos.length===1?' single':''}`}>
        {promos.map(p=>{const theme=PROMO_THEMES[p.theme]??PROMO_THEMES.GENERAL;return <li key={p.code} className="promo-card" style={{background:`linear-gradient(120deg, ${theme.from} 0%, ${theme.to} 100%)`}}>
          <div className="promo-copy">
            <p className="promo-occasion"><Icon name="calendar" size={16}/>{t(theme.label)}</p>
            <h3>{p.headline||t('{discount} your stay',{discount:promoValue(p)})}</h3>
            {p.description&&<p className="promo-description">{p.description}</p>}
            <p className="promo-terms">{promoValue(p)}{p.minNights>1?` · ${t('stays of {n}+ nights',{n:p.minNights})}`:''}{p.endsOn?` · ${t('book by {date}',{date:formatDate(p.endsOn)})}`:''} · {t('all StayEase hotels')}</p>
          </div>
          <div className="promo-code-box">
            <span className="promo-code-label">{t('Use code')}</span>
            <span className="promo-code">{p.code}</span>
            <div className="promo-actions">
              <button type="button" className="btn btn-sm promo-btn-light" onClick={()=>void copy(p.code)} aria-live="polite">{copied===p.code?<><Icon name="check" size={16}/>{t('Copied')}</>:t('Copy code')}</button>
              <button type="button" className="btn btn-sm promo-btn-solid" onClick={()=>use(p.code)}>{chosen===p.code?<><Icon name="check" size={16}/>{t('Code saved')}</>:<>{t('Book with code')}<Icon name="arrowRight" size={16}/></>}</button>
            </div>
          </div>
        </li>;})}
      </ul>
    </div>
  </section>;
}
