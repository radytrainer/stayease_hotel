'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import ProvincePhoto from '../components/ProvincePhoto';
import HotelPhoto from '../components/HotelPhoto';
import Icon from '../components/Icon';
import { Alert, EmptyState, Skeleton, Spinner } from '../components/ui';
import { api, errorMessage, imageUrl, withRetry } from '../lib/api';
import PhotoCredit from '../components/PhotoCredit';
import PromoBanner from '../components/PromoBanner';
import { addDays, formatDateRange, isoDate, nightsBetween, pluralize } from '../lib/format';
import { DESTINATIONS, POPULAR_DESTINATIONS, placeName, searchTerm, shortName, themeFor } from '../lib/cambodia';
import { useT } from '../lib/i18n';
import { useCurrency } from '../lib/currency';

type Hotel={id:string;name:string;slug:string;description:string|null;address:string;city:string;country:string;fromPrice?:number|null;currency?:string|null;coverImageUrl?:string|null;coverCreditName?:string|null;coverCreditUrl?:string|null};
type Destination={city:string;hotels:number;fromPrice:number|null;currency:string|null};
type Sort='name'|'price_asc'|'price_desc';
type Search={city:string;checkIn:string;checkOut:string;guests:string;sort:Sort};

const PAGE_SIZE=12;
const HERO_PLACES=[{city:'Siem Reap',note:'Sunrise at Angkor Wat'},{city:'Preah Sihanouk',note:''},{city:'Kampot',note:''}];
const emptySearch:Search={city:'',checkIn:'',checkOut:'',guests:'2',sort:'name'};
const sortLabels:Record<Sort,string>={name:'Name (A–Z)',price_asc:'Price: low to high',price_desc:'Price: high to low'};

function params(search:Search,page:number){
  const p=new URLSearchParams();
  if(search.city.trim())p.set('city',searchTerm(search.city.trim()));
  if(search.checkIn&&search.checkOut){p.set('checkIn',search.checkIn);p.set('checkOut',search.checkOut);p.set('guests',search.guests);}
  if(search.sort!=='name')p.set('sort',search.sort);
  return {page:new URLSearchParams({...Object.fromEntries(p),page:String(page),size:String(PAGE_SIZE)}),shareable:p};
}

export default function Home(){
  const {format:money}=useCurrency();
  const t=useT();
  const [form,setForm]=useState<Search>(emptySearch);
  const [applied,setApplied]=useState<Search|null>(null);
  const [hotels,setHotels]=useState<Hotel[]>([]);
  const [page,setPage]=useState(0);
  const [hasMore,setHasMore]=useState(false);
  const [state,setState]=useState<'loading'|'ready'|'error'>('loading');
  const [loadingMore,setLoadingMore]=useState(false);
  const [error,setError]=useState('');
  const [connecting,setConnecting]=useState(false);
  const [dateError,setDateError]=useState('');
  const [destinations,setDestinations]=useState<Destination[]|null>(null);
  const [allProvinces,setAllProvinces]=useState(false);
  const today=isoDate();

  const run=useCallback(async(search:Search)=>{
    setState('loading');setError('');
    const {page:query,shareable}=params(search,0);
    try{
      const rows=await withRetry(()=>api<Hotel[]>(`/hotels?${query}`,{auth:false}),()=>setConnecting(true));
      setConnecting(false);
      setHotels(rows);setPage(0);setHasMore(rows.length===PAGE_SIZE);
      setApplied(search);setState('ready');
      window.history.replaceState(null,'',shareable.size?`/?${shareable}`:'/');
    }catch(e){setConnecting(false);setError(errorMessage(e,'Search is unavailable right now.'));setState('error');}
  },[]);

  async function loadMore(){
    if(!applied)return;
    setLoadingMore(true);
    try{
      const rows=await api<Hotel[]>(`/hotels?${params(applied,page+1).page}`,{auth:false});
      const before=hotels.length;
      setHotels(current=>[...current,...rows]);setPage(page+1);setHasMore(rows.length===PAGE_SIZE);
      // Move focus to the first newly loaded card so keyboard and screen-reader users continue from there.
      if(rows.length)requestAnimationFrame(()=>document.querySelectorAll<HTMLAnchorElement>('.hotel-card')[before]?.focus());
    }catch(e){setError(errorMessage(e,'More stays could not be loaded.'));}
    finally{setLoadingMore(false);}
  }

  useEffect(()=>{
    const q=new URLSearchParams(window.location.search);
    const sort=(['name','price_asc','price_desc'].includes(q.get('sort')||'')?q.get('sort'):'name') as Sort;
    const initial={city:q.get('city')||'',checkIn:q.get('checkIn')||'',checkOut:q.get('checkOut')||'',guests:q.get('guests')||'2',sort};
    setForm(initial);void run(initial);
    withRetry(()=>api<Destination[]>('/hotels/destinations',{auth:false})).then(setDestinations).catch(()=>setDestinations([]));
  },[run]);

  function update(key:keyof Search,value:string){
    setForm(current=>{
      const next={...current,[key]:value} as Search;
      if(key==='checkIn'&&value&&(!next.checkOut||next.checkOut<=value))next.checkOut=addDays(value,1);
      return next;
    });
    if(key==='checkIn'||key==='checkOut')setDateError('');
  }

  function validDates(){
    if((form.checkIn&&!form.checkOut)||(!form.checkIn&&form.checkOut)){setDateError(t('Choose both a check-in and a check-out date, or leave both empty.'));return false;}
    if(form.checkIn&&form.checkOut<=form.checkIn){setDateError(t('Check-out must be at least one night after check-in.'));return false;}
    if(form.checkIn&&nightsBetween(form.checkIn,form.checkOut)>60){setDateError(t('Stays can be up to 60 nights.'));return false;}
    return true;
  }
  function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!validDates())return;
    void run(form);
    document.getElementById('results')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function browse(city:string){
    if(!validDates())return;
    const next={...form,city};setForm(next);void run(next);
    document.getElementById('results')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function changeSort(sort:Sort){const next={...(applied??form),sort};setForm(f=>({...f,sort}));void run(next);}

  const dated=Boolean(applied?.checkIn&&applied?.checkOut);
  const nights=dated&&applied?nightsBetween(applied.checkIn,applied.checkOut):0;
  const province=applied?.city?destinations?.find(d=>shortName(d.city).toLowerCase()===searchTerm(applied.city).toLowerCase()):undefined;
  const total=!dated?(province?.hotels??(applied&&!applied.city?destinations?.reduce((n,d)=>n+d.hotels,0):undefined)):undefined;
  const heading=!applied?t('Stays'):applied.city?t('Stays in {place}',{place:placeName(applied.city)}):dated?t('Available stays'):t('All stays in Cambodia');
  const countText=state!=='ready'?'':total!==undefined?t('Showing {shown} of {total}',{shown:hotels.length,total:pluralize(total,'stay')}):hasMore?t('{count} so far',{count:pluralize(hotels.length,'stay')}):pluralize(hotels.length,'stay');
  const detailQuery=(slug:string)=>{const q=new URLSearchParams();if(applied&&dated){q.set('checkIn',applied.checkIn);q.set('checkOut',applied.checkOut);q.set('guests',applied.guests);}return `/hotels/${encodeURIComponent(slug)}${q.size?`?${q}`:''}`;};
  const heroTotal=destinations?.reduce((n,d)=>n+d.hotels,0)??0;
  const shownProvinces=allProvinces?destinations??[]:(destinations??[]).slice(0,8);
  const photoVariantByHotel=new Map<string,number>();
  const photoVariantCounts=new Map<string,number>();
  for(const hotel of hotels){const key=themeFor(hotel.city);const variant=photoVariantCounts.get(key)??0;photoVariantByHotel.set(hotel.id,variant);photoVariantCounts.set(key,variant+1);}

  return <main id="main">
    <section className="hero" aria-labelledby="hero-title">
      <div className="container">
        <div className="hero-grid">
          <div>
            <p className="eyebrow">{t('Hotels across Cambodia')}</p>
            <h1 id="hero-title">{t('From Angkor to the coast, find a stay that feels like yours.')}</h1>
            <p className="hero-lead">{t('Live room availability in all 25 provinces, from Siem Reap and Phnom Penh to Kampot, Kep and Mondulkiri.')}</p>
            <ul className="hero-points">
              <li><Icon name="calendar" size={18}/>{t('Live room availability')}</li>
              <li><Icon name="card" size={18}/>{t('Full price before checkout')}</li>
              <li><Icon name="shield" size={18}/>{t('Secure payment with Stripe')}</li>
            </ul>
          </div>
          <div className="hero-collage" role="group" aria-label={t('Featured destinations')}>
            {HERO_PLACES.map((p,i)=><button key={p.city} type="button" className={i===0?'main':undefined} onClick={()=>browse(p.city)} aria-label={t('Browse stays in {place}',{place:placeName(p.city)})}>
              <ProvincePhoto city={p.city} eager/>
              <span className="hero-collage-label"><strong>{placeName(p.city)}</strong>{i===0&&<span>{t(p.note)}</span>}</span>
            </button>)}
            {heroTotal>0&&<p className="hero-stat"><span className="hero-stat-icon"><Icon name="building" size={20}/></span><span><strong>{pluralize(heroTotal,'stay')}</strong><span>{t('in all 25 provinces')}</span></span></p>}
          </div>
        </div>
        <form className="search-panel" onSubmit={submit} noValidate aria-label={t('Search stays')}>
          <div className="form-field">
            <label htmlFor="city">{t('Destination')}</label>
            <input id="city" className="input" value={form.city} onChange={e=>update('city',e.target.value)} placeholder={t('Province or town, e.g. Siem Reap')} autoComplete="off" list="destinations" maxLength={120}/>
            <datalist id="destinations">{DESTINATIONS.map(d=><option key={d} value={placeName(d)===shortName(d)?d:placeName(d)}/>)}</datalist>
          </div>
          <div className="form-field">
            <label htmlFor="checkIn">{t('Check-in')}</label>
            <input id="checkIn" className="input" type="date" min={today} value={form.checkIn} onChange={e=>update('checkIn',e.target.value)} aria-invalid={Boolean(dateError)} aria-describedby={dateError?'date-error':undefined}/>
          </div>
          <div className="form-field">
            <label htmlFor="checkOut">{t('Check-out')}</label>
            <input id="checkOut" className="input" type="date" min={form.checkIn?addDays(form.checkIn,1):today} value={form.checkOut} onChange={e=>update('checkOut',e.target.value)} aria-invalid={Boolean(dateError)} aria-describedby={dateError?'date-error':undefined}/>
          </div>
          <div className="form-field">
            <label htmlFor="guests">{t('Guests')}</label>
            <select id="guests" className="select" value={form.guests} onChange={e=>update('guests',e.target.value)}>
              {[1,2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{pluralize(n,'guest')}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" type="submit" disabled={state==='loading'}><Icon name="search" size={18}/>{t('Search')}</button>
        </form>
        {dateError&&<p id="date-error" className="field-error" role="alert" style={{marginTop:8}}>{dateError}</p>}
        <div className="hero-popular" role="group" aria-label={t('Popular destinations')}>
          <span className="small muted">{t('Popular:')}</span>
          {POPULAR_DESTINATIONS.slice(0,6).map(d=><button key={d} type="button" className="chip" aria-pressed={applied?.city===d} onClick={()=>browse(d)}>{placeName(d)}</button>)}
        </div>
      </div>
    </section>

    <PromoBanner onUse={()=>{const city=document.getElementById('city');city?.scrollIntoView({behavior:'smooth',block:'center'});city?.focus({preventScroll:true});}}/>

    <section id="provinces" className="page scroll-mt-28" style={{paddingBottom:0}} aria-labelledby="provinces-title">
      <div className="container stack">
        <div className="section-title" style={{marginBottom:0}}>
          <div><h2 id="provinces-title">{t('Explore by province')}</h2><p className="muted small" style={{marginTop:4}}>{t('Every province of Cambodia, busiest first.')}</p></div>
          {destinations&&destinations.length>8&&<button type="button" className="btn btn-ghost btn-sm" aria-expanded={allProvinces} aria-controls="province-grid" onClick={()=>setAllProvinces(!allProvinces)}>{allProvinces?t('Show fewer'):t('Show all {count} provinces',{count:destinations.length})}</button>}
        </div>
        {!destinations?<div className="province-grid" aria-hidden="true">{Array.from({length:8},(_,i)=><Skeleton key={i} height={148} radius={14}/>)}</div>
          :destinations.length>0&&<ul id="province-grid" className="province-grid">
            {shownProvinces.map(d=><li key={d.city}>
              <button type="button" className={`province-tile${applied?.city&&searchTerm(applied.city)===shortName(d.city)?' active':''}`} onClick={()=>browse(d.city)} aria-label={`${placeName(d.city)}: ${pluralize(d.hotels,'stay')}${d.fromPrice!=null&&d.currency?`, ${t('from {price} a night',{price:money(d.fromPrice,d.currency)})}`:''}`}>
                <ProvincePhoto city={d.city}/>
                <span className="province-label"><strong>{placeName(d.city)}</strong><span>{pluralize(d.hotels,'stay')}{d.fromPrice!=null&&d.currency?` · ${t('from {price}',{price:money(d.fromPrice,d.currency)})}`:''}</span></span>
              </button>
            </li>)}
          </ul>}
      </div>
    </section>

    <section id="results" className="page scroll-mt-24" aria-labelledby="results-title" aria-busy={state==='loading'}>
      <div className="container stack-lg">
        <div className="section-title">
          <div>
            <h2 id="results-title">{heading}</h2>
            <p className="muted small" style={{marginTop:4}}>{dated&&applied?`${formatDateRange(applied.checkIn,applied.checkOut)} · ${pluralize(nights,'night')} · ${pluralize(Number(applied.guests),'guest')} · ${t('only hotels with a free room are shown')}`:t('Add dates to see only hotels with a room free for your stay.')}</p>
          </div>
          <div className="cluster">
            {applied?.city&&<button type="button" className="btn btn-ghost btn-sm" onClick={()=>browse('')}><Icon name="close" size={16}/>{t('Clear destination')}</button>}
            <label htmlFor="sort" className="small muted">{t('Sort by')}</label>
            <select id="sort" className="select" style={{width:'auto',minHeight:38}} value={applied?.sort??form.sort} onChange={e=>changeSort(e.target.value as Sort)}>{(Object.keys(sortLabels) as Sort[]).map(s=><option key={s} value={s}>{t(sortLabels[s])}</option>)}</select>
          </div>
        </div>

        {state==='loading'&&connecting&&<p className="cluster muted small" role="status"><Spinner/>{t('Connecting to StayEase. This can take a few seconds after a restart.')}</p>}
        {state==='loading'&&<div className="grid grid-3" aria-hidden="true">{[0,1,2,3,4,5].map(i=><div key={i} className="card"><Skeleton height={190} radius={0}/><div className="card-body stack-sm"><Skeleton width="60%" height={20}/><Skeleton width="40%"/><Skeleton/><Skeleton width="80%"/></div></div>)}</div>}

        {state==='error'&&<Alert tone="error" title={t('We couldn’t load stays')}>{error} <button type="button" className="link-button" onClick={()=>void run(applied??form)}>{t('Try again')}</button></Alert>}

        {state==='ready'&&!hotels.length&&<EmptyState icon="search" title={t('No stays match your search')}
          action={<button type="button" className="btn btn-secondary" onClick={()=>{const reset={...emptySearch,guests:form.guests};setForm(reset);void run(reset);}}>{t('Show all stays')}</button>}>
          {dated?t('Every room is booked for those dates, or none fits your group. Try different dates, fewer guests, or another province.'):t('Try a province name such as Kampot, or check the spelling.')}
        </EmptyState>}

        {state==='ready'&&hotels.length>0&&<>
          <ul className="grid grid-3" style={{listStyle:'none',padding:0,margin:0}}>
            {hotels.map(hotel=><li key={hotel.id} style={{display:'flex'}}>
              <a className="card card-link hotel-card" href={detailQuery(hotel.slug)} style={{flex:1}}>
                <div className="media">{hotel.coverImageUrl?<><img src={imageUrl(hotel.coverImageUrl,800)} alt="" loading="lazy"/><PhotoCredit plain name={hotel.coverCreditName} url={hotel.coverCreditUrl} className="absolute right-2 bottom-2"/></>:hotel.slug==='bamboo-bridge-riverside-inn'?<img src="/images/kampong-cham-riverside-hotel.png" alt="" loading="lazy"/>:<HotelPhoto city={hotel.city} variant={photoVariantByHotel.get(hotel.id)??0}/>}</div>
                <div className="content">
                  <h3>{hotel.name}</h3>
                  <p className="location"><Icon name="pin" size={16}/>{placeName(hotel.city)}, {t(hotel.country)}</p>
                  <p className="description">{hotel.description||hotel.address}</p>
                  <div className="footer">
                    {hotel.fromPrice!=null&&hotel.currency?<p className="price-from">{t('Base rate from')}<strong>{money(hotel.fromPrice,hotel.currency)}<span className="muted small" style={{fontWeight:400}}> / {t('night')}</span></strong></p>:<p className="price-from">{t('Rates shown on the next step')}</p>}
                    <span className="btn btn-ghost btn-sm" aria-hidden="true">{dated?t('See rooms'):t('View hotel')}<Icon name="arrowRight" size={16}/></span>
                  </div>
                </div>
              </a>
            </li>)}
          </ul>
          <div className="stack-sm" style={{alignItems:'center'}}>
            <p className="muted small" aria-live="polite">{countText}</p>
            {hasMore&&<button type="button" className="btn btn-secondary btn-lg" onClick={()=>void loadMore()} disabled={loadingMore}>{loadingMore?<><Spinner/>{t('Loading more stays…')}</>:t('Show more stays')}</button>}
          </div>
        </>}
      </div>
    </section>

    <section className="page" style={{paddingTop:0}} aria-labelledby="how-title">
      <div className="container stack">
        <h2 id="how-title">{t('How booking works')}</h2>
        <ol className="steps">
          <li><h3>{t('Search your dates')}</h3><p className="muted">{t('Results only include hotels with a room free for every night you choose.')}</p></li>
          <li><h3>{t('Hold your rooms')}</h3><p className="muted">{t('We hold your selected rooms for 15 minutes while you check out, at the price you saw.')}</p></li>
          <li><h3>{t('Pay your way')}</h3><p className="muted">{t('Pay by card on Stripe’s secure page, or confirm now and pay at the hotel when you arrive.')}</p></li>
        </ol>
      </div>
    </section>
  </main>;
}
