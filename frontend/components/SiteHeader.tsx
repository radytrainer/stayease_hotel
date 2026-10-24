'use client';
import { usePathname } from 'next/navigation';
import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import ProvincePhoto from './ProvincePhoto';
import Icon from './Icon';
import CurrencySwitch from './CurrencySwitch';
import Logo from './Logo';
import { api, signOut } from '../lib/api';
import { DESTINATION_GROUPS, placeName, shortName } from '../lib/cambodia';
import { useT } from '../lib/i18n';
import LanguageSwitch from './LanguageSwitch';
import { pluralize, roleLabel } from '../lib/format';
import { canBook, getProfile, getRoles, getToken, isStaff, type SessionProfile } from '../lib/session';

type Menu='destinations'|'account'|'mobile'|null;
type Session={signedIn:boolean;profile:SessionProfile|null;staff:boolean;guest:boolean};

const destinationHref=(place:string)=>`/?city=${encodeURIComponent(shortName(place))}#results`;
const initials=(name:string)=>name.split(/[\s@.]+/).filter(Boolean).slice(0,2).map(p=>p[0]!.toUpperCase()).join('')||'?';

/** Closes a menu on Escape (returning focus to its trigger) or on a click outside it. */
function useDismiss(open:boolean,close:()=>void,refs:RefObject<HTMLElement|null>[],trigger:RefObject<HTMLElement|null>){
  useEffect(()=>{
    if(!open)return;
    const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){close();trigger.current?.focus();}};
    const onPointer=(e:PointerEvent)=>{if(!refs.some(r=>r.current?.contains(e.target as Node)))close();};
    document.addEventListener('keydown',onKey);document.addEventListener('pointerdown',onPointer);
    return()=>{document.removeEventListener('keydown',onKey);document.removeEventListener('pointerdown',onPointer);};
  },[open,close,refs,trigger]);
}

function NavLink({href,current,children}:{href:string;current:boolean;children:ReactNode}){
  return <a href={href} aria-current={current?'page':undefined}
    className={`relative flex h-full items-center px-3 text-sm font-medium no-underline transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:transition-colors ${current?'text-brand-700 after:bg-brand-600':'text-ink hover:text-brand-700 after:bg-transparent hover:after:bg-brand-200'}`}>{children}</a>;
}

export default function SiteHeader(){
  const pathname=usePathname();
  const t=useT();
  const [menu,setMenu]=useState<Menu>(null);
  const [session,setSession]=useState<Session|null>(null);
  const [counts,setCounts]=useState<Record<string,number>|null>(null);
  const destinationsButton=useRef<HTMLButtonElement>(null),destinationsPanel=useRef<HTMLDivElement>(null);
  const accountButton=useRef<HTMLButtonElement>(null),accountPanel=useRef<HTMLDivElement>(null);
  const mobileButton=useRef<HTMLButtonElement>(null),mobilePanel=useRef<HTMLDivElement>(null);
  const close=useCallback(()=>setMenu(null),[]);

  useEffect(()=>{
    const read=()=>{const profile=getProfile(),roles=profile?.roles??getRoles();setSession({signedIn:Boolean(getToken()),profile,staff:isStaff(roles),guest:canBook(roles)});};
    read();window.addEventListener('stayease-profile',read);return()=>window.removeEventListener('stayease-profile',read);
  },[pathname]);
  useEffect(()=>{setMenu(null);},[pathname]);
  // Hotel counts load the first time the destinations menu opens.
  useEffect(()=>{
    if((menu==='destinations'||menu==='mobile')&&!counts)
      api<{city:string;hotels:number}[]>('/hotels/destinations',{auth:false}).then(rows=>setCounts(Object.fromEntries(rows.map(r=>[r.city,r.hotels])))).catch(()=>setCounts({}));
  },[menu,counts]);
  useDismiss(menu==='destinations',close,[destinationsButton,destinationsPanel],destinationsButton);
  useDismiss(menu==='account',close,[accountButton,accountPanel],accountButton);
  useDismiss(menu==='mobile',close,[mobileButton,mobilePanel],mobileButton);

  const toggle=(m:Menu)=>setMenu(current=>current===m?null:m);
  const isCurrent=(href:string)=>href==='/'?pathname==='/':pathname.startsWith(href);
  const guestLinks=session?.guest===false?[]:[{href:'/account/bookings',label:t('My trips')},{href:'/list-hotel',label:t('List your hotel')}];
  const links=[...guestLinks,...(session?.staff?[{href:'/dashboard',label:t('Workspace')}]:[])];
  const name=session?.profile?.name??t('Account');
  const role=session?.profile?.roles.filter(r=>r!=='GUEST').map(roleLabel).join(', ')||t('Guest');
  const count=(place:string)=>counts?.[place];

  return <header className="sticky top-0 z-40">
    {/* Info strip */}
    <div className="bg-brand-900 text-brand-50">
      <div className="container flex h-8 items-center justify-between gap-4 text-xs">
        <p className="hidden min-w-0 items-center gap-1.5 truncate sm:flex"><Icon name="pin" size={14}/><span className="truncate">{t('Hotels in all 25 provinces of Cambodia')}</span></p>
        <div className="ml-auto flex items-center gap-3 sm:gap-4">
          <span className="hidden items-center gap-1.5 lg:flex"><Icon name="shield" size={14}/>{t('Secure payment with Stripe')}</span>
          <LanguageSwitch/>
          <CurrencySwitch/>
        </div>
      </div>
    </div>

    {/* Main bar */}
    <div className="border-b border-ink/10 bg-white/90 shadow-[0_1px_0_rgba(20,44,42,0.02)] backdrop-blur-md supports-[backdrop-filter]:bg-white/80">
      <div className="container flex h-16 items-center gap-3 sm:gap-6">
        <a href="/" className="shrink-0 rounded-lg no-underline" aria-label={t('StayEase home')}><Logo/></a>

        <nav aria-label={t('Main')} className="hidden h-full items-stretch lg:flex">
          <NavLink href="/" current={isCurrent('/')}>{t('Stays')}</NavLink>
          <button ref={destinationsButton} type="button" aria-expanded={menu==='destinations'} aria-controls="destinations-menu" onClick={()=>toggle('destinations')}
            className={`relative flex h-full items-center gap-1 px-3 text-sm font-medium transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full ${menu==='destinations'?'text-brand-700 after:bg-brand-600':'text-ink hover:text-brand-700 hover:after:bg-brand-200'}`}>
            {t('Destinations')}
            <svg viewBox="0 0 20 20" className={`size-4 transition-transform ${menu==='destinations'?'rotate-180':''}`} aria-hidden="true"><path d="m5 8 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          {links.map(l=><NavLink key={l.href} href={l.href} current={isCurrent(l.href)}>{l.label}</NavLink>)}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {session===null?<span className="h-9 w-24" aria-hidden="true"/>
            :session.signedIn?<div className="relative">
              <button ref={accountButton} type="button" aria-expanded={menu==='account'} aria-controls="account-menu" onClick={()=>toggle('account')}
                className="flex items-center gap-2 rounded-full border border-ink/10 bg-white py-1 pr-2.5 pl-1 text-sm font-medium text-ink shadow-xs transition hover:border-brand-300 hover:shadow-sm">
                <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white">{initials(name)}</span>
                <span className="hidden max-w-36 truncate md:block">{name}</span>
                <svg viewBox="0 0 20 20" className="size-4 text-ink-muted" aria-hidden="true"><path d="m5 8 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span className="sr-only">{t('Account menu')}</span>
              </button>
              {menu==='account'&&<div ref={accountPanel} id="account-menu" className="absolute right-0 mt-2 w-64 origin-top-right overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-xl shadow-ink/10 ring-1 ring-black/5">
                <div className="border-b border-ink/10 bg-brand-50/60 px-4 py-3">
                  <p className="truncate text-sm font-semibold text-ink">{name}</p>
                  {session.profile?.email&&<p className="truncate text-xs text-ink-muted">{session.profile.email}</p>}
                  <p className="mt-1.5 inline-flex rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-brand-700 ring-1 ring-brand-200">{role}</p>
                </div>
                <ul className="py-1.5 text-sm">
                  {[...(session.guest?[{href:'/account/bookings',label:t('My trips'),icon:'calendar' as const}]:[]),{href:'/account/profile',label:t('Profile & password'),icon:'users' as const},...(session.staff?[{href:'/dashboard',label:t('Workspace'),icon:'building' as const}]:[])].map(item=>
                    <li key={item.href}><a href={item.href} className="flex items-center gap-3 px-4 py-2 text-ink no-underline hover:bg-brand-50 hover:text-brand-700"><span className="text-ink-muted"><Icon name={item.icon} size={18}/></span>{item.label}</a></li>)}
                </ul>
                <div className="border-t border-ink/10 py-1.5"><button type="button" onClick={()=>void signOut()} className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-ink hover:bg-red-50 hover:text-red-700"><span className="text-ink-muted"><Icon name="logOut" size={18}/></span>{t('Sign out')}</button></div>
              </div>}
            </div>
            :<>
              {/* Phones get one compact button here; "Create account" is in the mobile menu. */}
              <a href="/signin" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-ink no-underline hover:bg-brand-50 hover:text-brand-700 sm:inline-flex">{t('Sign in')}</a>
              <a href="/signin" className="inline-flex items-center rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white no-underline shadow-sm transition hover:bg-brand-700 hover:text-white sm:hidden">{t('Sign in')}</a>
              <a href="/signin?mode=register" className="hidden items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white no-underline shadow-sm transition hover:bg-brand-700 hover:text-white sm:inline-flex">{t('Create account')}</a>
            </>}
          <button ref={mobileButton} type="button" aria-expanded={menu==='mobile'} aria-controls="mobile-menu" onClick={()=>toggle('mobile')}
            className="grid size-10 place-items-center rounded-lg text-ink hover:bg-brand-50 lg:hidden">
            <Icon name={menu==='mobile'?'close':'menu'}/><span className="sr-only">{menu==='mobile'?t('Close menu'):t('Open menu')}</span>
          </button>
        </div>
      </div>
    </div>

    {/* Destinations mega menu (desktop) */}
    {menu==='destinations'&&<div ref={destinationsPanel} id="destinations-menu" className="absolute inset-x-0 top-full hidden border-b border-ink/10 bg-white shadow-2xl shadow-ink/10 lg:block">
      <div className="container grid grid-cols-[repeat(4,minmax(0,1fr))_15rem] gap-8 py-8">
        {DESTINATION_GROUPS.map(group=><div key={group.title}>
          <div className="mb-3 flex items-center gap-3">
            <span className="relative size-11 shrink-0 overflow-hidden rounded-xl ring-1 ring-ink/10"><ProvincePhoto city={group.places[0]}/></span>
            <div><p className="font-display text-sm font-bold text-ink">{t(group.title)}</p><p className="text-xs text-ink-muted">{t(group.blurb)}</p></div>
          </div>
          <ul className="space-y-0.5">{group.places.map(place=><li key={place}>
            <a href={destinationHref(place)} className="group flex items-center justify-between rounded-lg px-2 py-1.5 text-sm text-ink no-underline hover:bg-brand-50 hover:text-brand-700">
              <span>{placeName(place)}</span>
              {count(place)!==undefined&&<span className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-semibold text-ink-muted tabular-nums group-hover:bg-brand-100 group-hover:text-brand-700">{count(place)}</span>}
            </a></li>)}</ul>
        </div>)}
        <a href={destinationHref('Siem Reap')} className="group relative flex flex-col justify-end overflow-hidden rounded-2xl p-4 text-white no-underline shadow-lg">
          <span className="absolute inset-0 transition-transform duration-500 group-hover:scale-105"><ProvincePhoto city="Siem Reap"/></span>
          <span className="absolute inset-0 bg-gradient-to-t from-brand-950/90 via-brand-950/30 to-transparent"/>
          <span className="relative text-[11px] font-semibold tracking-widest text-laterite-200 uppercase">{t('Most booked')}</span>
          <span className="relative font-display text-lg font-bold">{placeName('Siem Reap')}</span>
          <span className="relative text-xs text-white/85">{t('Stay near Angkor Wat')}{count('Siem Reap')?` · ${pluralize(count('Siem Reap')!,'stay')}`:''}</span>
          <span className="relative mt-2 inline-flex items-center gap-1 text-xs font-semibold">{t('Explore')} <Icon name="arrowRight" size={14}/></span>
        </a>
      </div>
      <div className="border-t border-ink/10 bg-brand-50/50"><div className="container flex h-11 items-center justify-between text-sm">
        <span className="text-ink-muted">{t('All 24 provinces and Phnom Penh, with live availability.')}</span>
        <a href="/#provinces" className="font-semibold text-brand-700">{t('Browse every province')} →</a>
      </div></div>
    </div>}

    {/* Mobile menu */}
    {menu==='mobile'&&<div ref={mobilePanel} id="mobile-menu" className="absolute inset-x-0 top-full max-h-[calc(100dvh-6rem)] overflow-y-auto border-b border-ink/10 bg-white shadow-2xl lg:hidden">
      <nav aria-label={t('Main')} className="container py-4">
        <ul className="space-y-1">
          {[{href:'/',label:t('Stays')},...links].map(l=><li key={l.href}><a href={l.href} aria-current={isCurrent(l.href)?'page':undefined}
            className={`flex items-center rounded-xl px-3 py-3 text-base font-medium no-underline ${isCurrent(l.href)?'bg-brand-50 text-brand-700':'text-ink hover:bg-ink/5'}`}>{l.label}</a></li>)}
        </ul>
        <details className="group mt-2 rounded-xl border border-ink/10">
          <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-3 text-base font-medium text-ink [&::-webkit-details-marker]:hidden">
            {t('Destinations')} <svg viewBox="0 0 20 20" className="size-5 text-ink-muted transition-transform group-open:rotate-180" aria-hidden="true"><path d="m5 8 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </summary>
          <div className="space-y-4 px-3 pb-4">{DESTINATION_GROUPS.map(group=><div key={group.title}>
            <p className="mb-1 text-xs font-semibold tracking-wide text-ink-muted uppercase">{t(group.title)}</p>
            <ul className="grid grid-cols-2 gap-x-2">{group.places.map(place=><li key={place}><a href={destinationHref(place)} className="flex justify-between rounded-lg px-2 py-2 text-sm text-ink no-underline hover:bg-brand-50">{placeName(place)}{count(place)!==undefined&&<span className="text-xs text-ink-muted tabular-nums">{count(place)}</span>}</a></li>)}</ul>
          </div>)}</div>
        </details>
        {session?.signedIn
          ?<div className="mt-4 border-t border-ink/10 pt-4">
            <p className="px-3 text-sm font-semibold text-ink">{name}</p><p className="px-3 text-xs text-ink-muted">{role}</p>
            <a href="/account/profile" className="mt-2 flex rounded-xl px-3 py-3 text-base text-ink no-underline hover:bg-ink/5">{t('Profile & password')}</a>
            <button type="button" onClick={()=>void signOut()} className="flex w-full rounded-xl px-3 py-3 text-left text-base text-red-700 hover:bg-red-50">{t('Sign out')}</button>
          </div>
          :<div className="mt-4 grid grid-cols-2 gap-2 border-t border-ink/10 pt-4">
            <a href="/signin" className="rounded-xl border border-ink/15 px-4 py-3 text-center text-sm font-semibold text-ink no-underline">{t('Sign in')}</a>
            <a href="/signin?mode=register" className="rounded-xl bg-brand-600 px-4 py-3 text-center text-sm font-semibold text-white no-underline">{t('Create account')}</a>
          </div>}
      </nav>
    </div>}
  </header>;
}
