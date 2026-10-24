'use client';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import RoomArt from '../../../components/RoomArt';
import HotelMap from '../../../components/HotelMap';
import RoomGallery, { RoomThumb, type RoomPhoto } from '../../../components/RoomGallery';
import Icon from '../../../components/Icon';
import { Alert, Breadcrumbs, EmptyState, Loading, Skeleton, Spinner } from '../../../components/ui';
import { api, ApiError, errorMessage, imageUrl, withRetry } from '../../../lib/api';
import PhotoCredit from '../../../components/PhotoCredit';
import { addDays, formatDate, formatDateRange, formatMoney, isoDate, nightsBetween, pluralize } from '../../../lib/format';
import { requireSession } from '../../../lib/session';
import { placeName, shortName } from '../../../lib/cambodia';
import { useCurrency } from '../../../lib/currency';
import { promoValue, rememberedPromo, type FeaturedPromo } from '../../../lib/promotions';
import { Trans, useT } from '../../../lib/i18n';

type Hotel={id:string;name:string;description:string|null;address:string;city:string;country:string;latitude?:number|null;longitude?:number|null;images?:{id:string;altText:string;url:string;creditName?:string;creditUrl?:string}[]};
/** One bookable room type; identical physical rooms are grouped, and specific rooms are assigned on booking. */
type Room={roomTypeId:string;roomType:string;description:string|null;capacity:number;currency:string;total:number;nightlyRates:{date:string;amount:number}[];available:number;roomIds:string[];photos?:RoomPhoto[]};
type Stay={checkIn:string;checkOut:string;guests:string};
type Promo={code:string;description:string|null;discountType:'PERCENT'|'FIXED';discountValue:number;currency:string|null;minNights:number};

export default function HotelPage(){
  const {format:money,converted,rateNote}=useCurrency();
  const {slug}=useParams<{slug:string}>();
  const t=useT();
  const [hotel,setHotel]=useState<Hotel|null>(null);
  const [hotelError,setHotelError]=useState<{status:number;message:string}|null>(null);
  const [form,setForm]=useState<Stay>({checkIn:'',checkOut:'',guests:'2'});
  const [stay,setStay]=useState<Stay|null>(null);
  const [rooms,setRooms]=useState<Room[]>([]);
  const [availability,setAvailability]=useState<'idle'|'loading'|'ready'|'error'>('idle');
  const [availabilityError,setAvailabilityError]=useState('');
  const [dateError,setDateError]=useState('');
  const [selected,setSelected]=useState<Record<string,number>>({});
  const [reserving,setReserving]=useState(false);
  const [gallery,setGallery]=useState<string|null>(null);
  const [reserveError,setReserveError]=useState('');
  const [promoInput,setPromoInput]=useState('');
  const [promo,setPromo]=useState<Promo|null>(null);
  const [promoError,setPromoError]=useState('');
  const [checkingPromo,setCheckingPromo]=useState(false);
  const [offers,setOffers]=useState<FeaturedPromo[]>([]);
  // Offers advertised on the home page, and a code the guest saved from that advert.
  useEffect(()=>{
    setPromoInput(rememberedPromo());
    api<FeaturedPromo[]>('/promotions/featured',{auth:false}).then(setOffers).catch(()=>setOffers([]));
  },[]);
  const idempotencyKey=useRef('');
  const today=isoDate();

  const loadRooms=useCallback(async(next:Stay)=>{
    setAvailability('loading');setAvailabilityError('');setSelected({});setReserveError('');
    try{
      setRooms(await withRetry(()=>api<Room[]>(`/hotels/${encodeURIComponent(slug)}/availability?${new URLSearchParams(next)}`,{auth:false})));
      setStay(next);setAvailability('ready');
      window.history.replaceState(null,'',`?${new URLSearchParams(next)}`);
    }catch(e){setAvailabilityError(errorMessage(e,'Availability could not be loaded.'));setAvailability('error');}
  },[slug]);

  useEffect(()=>{
    const q=new URLSearchParams(window.location.search);
    const initial={checkIn:q.get('checkIn')||'',checkOut:q.get('checkOut')||'',guests:q.get('guests')||'2'};
    setForm(initial);
    withRetry(()=>api<Hotel>(`/hotels/${encodeURIComponent(slug)}`,{auth:false})).then(setHotel)
      .catch(e=>setHotelError({status:e instanceof ApiError?e.status:0,message:errorMessage(e)}));
    if(initial.checkIn&&initial.checkOut)void loadRooms(initial);
  },[slug,loadRooms]);

  // A fresh key per selection: retries of the same hold return the same reservation instead of a second one.
  useEffect(()=>{idempotencyKey.current=crypto.randomUUID();},[selected,stay,promo]);
  // A code was checked for specific dates (minimum stay), so new dates need a new check.
  useEffect(()=>{setPromo(null);setPromoError('');},[stay]);

  function update(key:keyof Stay,value:string){
    setForm(current=>{const next={...current,[key]:value};if(key==='checkIn'&&value&&(!next.checkOut||next.checkOut<=value))next.checkOut=addDays(value,1);return next;});
    setDateError('');
  }
  function check(e:FormEvent){
    e.preventDefault();
    if(!form.checkIn||!form.checkOut){setDateError(t('Choose your check-in and check-out dates.'));return;}
    if(form.checkOut<=form.checkIn){setDateError(t('Check-out must be at least one night after check-in.'));return;}
    if(nightsBetween(form.checkIn,form.checkOut)>60){setDateError(t('Stays can be up to 60 nights.'));return;}
    void loadRooms(form);
  }

  const chosen=useMemo(()=>rooms.filter(r=>(selected[r.roomTypeId]??0)>0).map(r=>({...r,quantity:Math.min(selected[r.roomTypeId],r.available)})),[rooms,selected]);
  const roomCount=chosen.reduce((sum,r)=>sum+r.quantity,0);
  const currency=chosen[0]?.currency??rooms[0]?.currency??'USD';
  const total=chosen.reduce((sum,r)=>sum+Number(r.total)*r.quantity,0);
  const capacity=chosen.reduce((sum,r)=>sum+r.capacity*r.quantity,0);
  const roomIds=chosen.flatMap(r=>r.roomIds.slice(0,r.quantity));
  const setQuantity=(type:string,quantity:number)=>setSelected(current=>({...current,[type]:quantity}));
  const guests=Number(stay?.guests??form.guests);
  const nights=stay?nightsBetween(stay.checkIn,stay.checkOut):0;
  const datesChanged=Boolean(stay&&(stay.checkIn!==form.checkIn||stay.checkOut!==form.checkOut||stay.guests!==form.guests));
  // Shown before booking; the server applies the same rule and its total is what the guest pays.
  const discount=!promo?0:promo.discountType==='PERCENT'?Math.round(total*Number(promo.discountValue))/100
    :promo.currency===currency?Math.min(Number(promo.discountValue),total):0;
  const payable=Math.max(0,total-discount);

  function applyPromo(e:FormEvent){e.preventDefault();void checkPromo(promoInput);}
  async function checkPromo(raw:string){
    const code=raw.trim();
    if(!code||!stay)return;
    setPromoInput(code.toUpperCase());
    setCheckingPromo(true);setPromoError('');
    try{
      const found=await api<Promo>(`/hotels/${encodeURIComponent(slug)}/promotions/${encodeURIComponent(code)}?${new URLSearchParams({checkIn:stay.checkIn,checkOut:stay.checkOut})}`);
      if(found.discountType==='FIXED'&&found.currency!==currency){setPromoError(t('This code can’t be used for prices in {currency}.',{currency}));return;}
      setPromo(found);setPromoInput('');
    }catch(err){setPromoError(errorMessage(err,'That code could not be checked.'));}
    finally{setCheckingPromo(false);}
  }

  async function reserve(){
    if(!hotel||!stay||!chosen.length)return;
    if(!requireSession())return;
    setReserving(true);setReserveError('');
    try{
      const reservation=await api('/reservations',{method:'POST',headers:{'Idempotency-Key':idempotencyKey.current},
        body:{hotelId:hotel.id,checkIn:stay.checkIn,checkOut:stay.checkOut,guests,roomIds,idempotencyKey:idempotencyKey.current,promoCode:promo?.code}});
      sessionStorage.setItem('stayease-last-reservation',JSON.stringify({...(reservation as object),hotelName:hotel.name}));
      window.location.assign('/reservation/held');
    }catch(e){
      setReserveError(e instanceof ApiError&&e.status===409?t('Someone else just booked one of these rooms. We refreshed the list so you can choose again.'):errorMessage(e,'We could not hold these rooms.'));
      if(e instanceof ApiError&&e.status===409)void loadRooms(stay);
      setReserving(false);
    }
  }

  if(hotelError)return <main id="main" className="page"><div className="container container-narrow">
    <EmptyState icon={hotelError.status===404?'search':'alert'} title={hotelError.status===404?t('This hotel isn’t available'):t('We couldn’t load this hotel')}
      action={<a className="btn btn-primary" href="/">{t('Search other stays')}</a>}>{hotelError.status===404?t('It may no longer be listed on StayEase.'):hotelError.message}</EmptyState>
  </div></main>;

  if(!hotel)return <main id="main" className="page" aria-busy="true"><div className="container stack"><Skeleton width={220}/><Skeleton width="50%" height={36}/><Skeleton height={360} radius={14}/><span className="visually-hidden" role="status">{t('Loading hotel…')}</span></div></main>;

  const images=hotel.images??[];
  const reserveLabel=roomCount>1?t('Reserve {count} rooms',{count:roomCount}):t('Reserve room');

  const summary=<aside className="card sticky" aria-labelledby="stay-title">
    <div className="card-body stack">
      <h2 id="stay-title">{t('Your stay')}</h2>
      <form onSubmit={check} className="stack" noValidate>
        <div className="form-row">
          <div className="form-field"><label htmlFor="in">{t('Check-in')}</label><input id="in" className="input" type="date" min={today} value={form.checkIn} onChange={e=>update('checkIn',e.target.value)} required aria-invalid={Boolean(dateError)} aria-describedby={dateError?'stay-error':undefined}/></div>
          <div className="form-field"><label htmlFor="out">{t('Check-out')}</label><input id="out" className="input" type="date" min={form.checkIn?addDays(form.checkIn,1):today} value={form.checkOut} onChange={e=>update('checkOut',e.target.value)} required aria-invalid={Boolean(dateError)} aria-describedby={dateError?'stay-error':undefined}/></div>
        </div>
        <div className="form-field"><label htmlFor="guests">{t('Guests')}</label><select id="guests" className="select" value={form.guests} onChange={e=>update('guests',e.target.value)}>{[1,2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{pluralize(n,'guest')}</option>)}</select></div>
        {dateError&&<p id="stay-error" className="field-error" role="alert">{dateError}</p>}
        <button className={`btn ${stay&&!datesChanged?'btn-secondary':'btn-primary'}`} disabled={availability==='loading'}>{availability==='loading'?<><Spinner/>{t('Checking…')}</>:stay?t('Update availability'):t('Check availability')}</button>
      </form>
      {stay&&<>
        <hr className="divider" style={{margin:0}}/>
        <dl className="summary-list">
          <div><dt>{t('Dates')}</dt><dd>{formatDateRange(stay.checkIn,stay.checkOut)}</dd></div>
          <div><dt>{t('Length')}</dt><dd>{pluralize(nights,'night')}</dd></div>
          <div><dt>{t('Rooms')}</dt><dd>{chosen.length?chosen.map(r=>`${r.quantity} × ${r.roomType}`).join(', '):t('None yet')}</dd></div>
        </dl>
        {chosen.length>0&&(promo
          ?<div className="promo-applied" role="status">
            <span style={{display:'flex',gap:8,alignItems:'flex-start',minWidth:0}}><span style={{flexShrink:0,marginTop:2}}><Icon name="check" size={16}/></span><span><Trans text="{code} applied" vars={{code:<b>{promo.code}</b>}}/>{promo.description?` · ${promo.description}`:''}</span></span>
            <button type="button" className="link-button small" onClick={()=>setPromo(null)}>{t('Remove')}</button>
          </div>
          :<form className="promo-form" onSubmit={applyPromo} noValidate>
            <label htmlFor="promo" className="form-label">{t('Promo code')} <span className="optional">({t('optional')})</span></label>
            <div className="promo-row">
              <input id="promo" className="input" value={promoInput} onChange={e=>{setPromoInput(e.target.value.toUpperCase());setPromoError('');}} placeholder={t('e.g. {example}',{example:'SAVE10'})} maxLength={32} autoComplete="off" aria-invalid={Boolean(promoError)} aria-describedby={promoError?'promo-error':undefined}/>
              <button className="btn btn-secondary" disabled={!promoInput.trim()||checkingPromo||datesChanged}>{checkingPromo?<Spinner/>:t('Apply')}</button>
            </div>
            {promoError&&<p id="promo-error" className="field-error" role="alert">{promoError}</p>}
            {offers.length>0&&<div className="promo-offers"><span>{t('Current offers:')}</span>{offers.map(o=><button key={o.code} type="button" className="promo-offer-chip" disabled={checkingPromo||datesChanged} onClick={()=>void checkPromo(o.code)} title={o.headline??undefined}>{o.code} · {promoValue(o)}</button>)}</div>}
          </form>)}
        {chosen.length>0&&promo&&discount>0&&<dl className="summary-list">
          <div><dt>{t('Subtotal')}</dt><dd>{money(total,currency)}</dd></div>
          <div><dt>{t('Discount ({code})',{code:promo.code})}</dt><dd style={{color:'var(--color-success)'}}>−{money(discount,currency)}</dd></div>
        </dl>}
        {chosen.length>0&&<div className="summary-total"><span>{t('Total')}</span><span>{money(payable,currency)}</span></div>}
        {chosen.length>0&&converted(currency)&&<p className="hint">{t('You’ll be charged {amount}. Riel prices are approximate.',{amount:formatMoney(payable,currency)})} {rateNote}</p>}
        {chosen.length>0&&capacity<guests&&<Alert tone="warning">{t('These rooms sleep {capacity}. Add another room for {guests}.',{capacity,guests:pluralize(guests,'guest')})}</Alert>}
        {reserveError&&<Alert tone="error">{reserveError}</Alert>}
        <button type="button" className="btn btn-primary btn-lg btn-block" disabled={!chosen.length||reserving||datesChanged} onClick={()=>void reserve()}>{reserving?<><Spinner/>{t('Holding rooms…')}</>:chosen.length?reserveLabel:t('Select a room to continue')}</button>
        {datesChanged&&<p className="hint">{t('Update availability to book your new dates.')}</p>}
        {chosen.length>0&&<p className="hint"><Icon name="bed" size={14}/> {t('Your room number is assigned automatically and shown in My trips as soon as your rooms are held.')}</p>}
        <p className="hint"><Icon name="shield" size={14}/> {t('No charge yet. We hold your rooms for 15 minutes while you choose to pay online or at the hotel.')}</p>
      </>}
    </div>
  </aside>;

  return <main id="main" className="page">
    <div className="container">
      <Breadcrumbs items={[{label:t('Stays'),href:'/'},{label:placeName(hotel.city),href:`/?city=${encodeURIComponent(shortName(hotel.city))}`},{label:hotel.name}]}/>
      <header style={{marginBottom:'var(--space-6)'}}>
        <h1>{hotel.name}</h1>
        <p className="muted cluster" style={{marginTop:8,gap:6}}><Icon name="pin" size={16}/>{hotel.address}, {placeName(hotel.city)}, {t(hotel.country)}</p>
      </header>

      <div className={`gallery${images.length<=1?' single':''}`}>
        {images.length?images.slice(0,3).map((image,i)=><div key={image.id} className="relative size-full"><img src={imageUrl(image.url,i?900:1600)} alt={image.altText||t('{hotel}, photo {n}',{hotel:hotel.name,n:i+1})} loading={i?'lazy':'eager'} className="size-full object-cover"/><PhotoCredit name={image.creditName} url={image.creditUrl} className="absolute right-2 bottom-2"/></div>)
          :<div className="relative size-full"><RoomArt category="EXTERIOR" seed={slug} city={hotel.city}/><span className="absolute top-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-ink shadow-sm">{t('Generated sample photo')}</span></div>}
      </div>

      <div className="layout-sidebar summary-first">
        <div className="stack-lg">
          {hotel.description&&<section aria-labelledby="about-title" className="stack-sm"><h2 id="about-title">{t('About this hotel')}</h2><p className="muted" style={{whiteSpace:'pre-line'}}>{hotel.description}</p></section>}

          <section aria-labelledby="location-title" className="stack-sm">
            <h2 id="location-title">{t('Location')}</h2>
            <HotelMap name={hotel.name} address={hotel.address} city={shortName(hotel.city)} latitude={hotel.latitude} longitude={hotel.longitude}/>
          </section>

          <section aria-labelledby="rooms-title" className="stack" aria-busy={availability==='loading'}>
            <div className="section-title" style={{marginBottom:0}}><h2 id="rooms-title">{t('Available rooms')}</h2>{stay&&availability==='ready'&&<span className="muted small">{t('{rooms} free',{rooms:pluralize(rooms.reduce((n,r)=>n+r.available,0),'room')})}</span>}</div>
            {availability==='idle'&&<EmptyState icon="calendar" title={t('Choose your dates')} headingLevel={3}>{t('Add check-in and check-out dates to see which rooms are free and what your stay will cost.')}</EmptyState>}
            {availability==='loading'&&<Loading label={t('Checking live availability…')}/>}
            {availability==='error'&&<Alert tone="error" title={t('Availability couldn’t be loaded')}>{availabilityError} {stay&&<button type="button" className="link-button" onClick={()=>void loadRooms(stay)}>{t('Try again')}</button>}</Alert>}
            {availability==='ready'&&!rooms.length&&<EmptyState icon="bed" title={t('No rooms free for these dates')} headingLevel={3}>{t('Every room is booked, or no single room sleeps {guests}. Try other dates or fewer guests per room.',{guests:pluralize(guests,'guest')})}</EmptyState>}
            {availability==='ready'&&rooms.length>0&&<fieldset className="stack">
              <legend className="visually-hidden">{t('Choose how many rooms of each type')}</legend>
              {rooms.map(room=>{const quantity=selected[room.roomTypeId]??0;const titleId=`type-${room.roomTypeId}`;const photoCount=room.photos?.length??0;return <article key={room.roomTypeId} className={`room-option has-media${quantity?' selected':''}`} aria-labelledby={titleId}>
                <button type="button" className="room-media group" onClick={()=>setGallery(room.roomTypeId)} aria-label={t('View photos of {room}',{room:room.roomType})}>
                  <RoomThumb photos={room.photos??[]} seed={room.roomTypeId} city={hotel.city} capacity={room.capacity}/>
                  <span className="room-media-label"><Icon name="image" size={14}/>{photoCount?pluralize(photoCount,'photo'):t('See room')}</span>
                </button>
                <div className="stack-sm">
                  <h3 id={titleId} style={{fontSize:'var(--text-lg)'}}>{room.roomType}</h3>
                  {room.description&&<p className="muted small">{room.description}</p>}
                  <div className="cluster small" style={{gap:'var(--space-2) var(--space-4)'}}>
                    <span className="cluster muted" style={{gap:6}}><Icon name="users" size={16}/>{t('Sleeps {count}',{count:room.capacity})}</span>
                    <span className={room.available<=2?'strong':'muted'} style={room.available<=2?{color:'var(--color-warning)'}:undefined}>{room.available<=2?t('Only {count} left',{count:room.available}):t('{count} available',{count:room.available})}</span>
                  </div>
                  <details className="rate-breakdown"><summary>{t('Nightly rates')}</summary><ul>{room.nightlyRates.map(rate=><li key={rate.date}><span>{formatDate(rate.date)}</span><span className="num">{money(rate.amount,room.currency)}</span></li>)}</ul></details>
                </div>
                <div className="price stack-sm">
                  <div><strong>{money(room.total,room.currency)}</strong><span className="muted small">{t('per room, {nights}',{nights:pluralize(nights,'night')})}</span></div>
                  {quantity===0
                    ?<button type="button" className="btn btn-primary btn-sm" disabled={roomCount>=8} onClick={()=>setQuantity(room.roomTypeId,1)} aria-label={t('Select {room}',{room:room.roomType})}>{t('Select')}</button>
                    :<div className="stepper-control" role="group" aria-label={t('Number of {room} rooms',{room:room.roomType})}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={()=>setQuantity(room.roomTypeId,quantity-1)} aria-label={t('Remove one {room}',{room:room.roomType})}>−</button>
                      <output aria-live="polite">{quantity}<span className="visually-hidden"> {t('selected')}</span></output>
                      <button type="button" className="btn btn-secondary btn-sm" disabled={quantity>=room.available||roomCount>=8} onClick={()=>setQuantity(room.roomTypeId,quantity+1)} aria-label={t('Add one {room}',{room:room.roomType})}>+</button>
                    </div>}
                </div>
              </article>;})}
              {roomCount>=8&&<p className="hint">{t('You can book up to 8 rooms in one reservation.')}</p>}
              {(()=>{const r=rooms.find(x=>x.roomTypeId===gallery);return <RoomGallery open={Boolean(r)} onClose={()=>setGallery(null)} roomType={r?.roomType??''} photos={r?.photos??[]} seed={r?.roomTypeId??'none'} hotelSeed={slug} city={hotel.city} capacity={r?.capacity??2}/>;})()}
            </fieldset>}
          </section>
        </div>
        {summary}
      </div>
    </div>
    {stay&&chosen.length>0&&<div className="mobile-booking-bar"><div><strong>{money(payable,currency)}</strong><div className="xsmall muted">{pluralize(roomCount,'room')} · {pluralize(nights,'night')}</div></div><button type="button" className="btn btn-primary" disabled={reserving||datesChanged} onClick={()=>void reserve()}>{reserving?t('Holding…'):reserveLabel}</button></div>}
  </main>;
}
