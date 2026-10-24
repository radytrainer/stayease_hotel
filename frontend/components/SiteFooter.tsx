'use client';
import { useEffect, useState } from 'react';
import Logo from './Logo';
import { signOut } from '../lib/api';
import { POPULAR_DESTINATIONS, placeName, shortName } from '../lib/cambodia';
import { useT } from '../lib/i18n';
import { getToken } from '../lib/session';

const linkClass='text-sm text-ink-muted no-underline hover:text-brand-700 hover:underline';

export default function SiteFooter(){
  const t=useT();
  const [signedIn,setSignedIn]=useState(false);
  // Same signal the header listens to, so the footer flips as soon as someone signs in.
  useEffect(()=>{
    const read=()=>setSignedIn(Boolean(getToken()));
    read();window.addEventListener('stayease-profile',read);return()=>window.removeEventListener('stayease-profile',read);
  },[]);
  const columns=[
    {title:t('Explore'),links:POPULAR_DESTINATIONS.slice(0,5).map(p=>({href:`/?city=${encodeURIComponent(shortName(p))}#results`,label:placeName(p)})).concat({href:'/#provinces',label:t('All 25 provinces')})},
    {title:t('Your account'),links:[{href:'/account/bookings',label:t('My trips')},{href:'/account/profile',label:t('Profile & password')},...(signedIn?[]:[{href:'/signin',label:t('Sign in')}])],signOut:signedIn},
    {title:t('For hotels'),links:[{href:'/list-hotel',label:t('List your hotel')},{href:'/dashboard',label:t('Hotel workspace')}]},
  ];
  return <footer className="mt-auto border-t border-ink/10 bg-white">
    <div className="container grid grid-cols-2 gap-x-6 gap-y-8 py-10 md:grid-cols-[1.4fr_repeat(3,1fr)] md:gap-10 md:py-12">
      <div className="col-span-2 max-w-xs md:col-span-1">
        <a href="/" className="inline-block rounded-lg no-underline" aria-label={t('StayEase home')}><Logo/></a>
        <p className="mt-4 text-sm leading-relaxed text-ink-muted">{t('Hotels across Cambodia with live availability, clear prices in USD and secure payment.')}</p>
      </div>
      {columns.map(col=><nav key={col.title} aria-label={col.title}>
        <p className="font-display text-sm font-bold text-ink">{col.title}</p>
        <ul className="mt-3 space-y-2">
          {col.links.map(l=><li key={l.href+l.label}><a href={l.href} className={linkClass}>{l.label}</a></li>)}
          {col.signOut&&<li><button type="button" onClick={()=>void signOut()} className={`${linkClass} cursor-pointer`}>{t('Sign out')}</button></li>}
        </ul>
      </nav>)}
    </div>
    <div className="border-t border-ink/10">
      <div className="container flex flex-col gap-2 py-5 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
        <p>{t('© {year} StayEase. Hotels across Cambodia.',{year:new Date().getFullYear()})}</p>
        <p>{t('Card payments are processed by Stripe. StayEase never stores card numbers.')}</p>
      </div>
    </div>
  </footer>;
}
