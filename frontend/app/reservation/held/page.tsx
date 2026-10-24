'use client';
import { useCallback, useEffect, useState } from 'react';
import Icon from '../../../components/Icon';
import { Alert, EmptyState, Spinner, StatusBadge } from '../../../components/ui';
import { api, errorMessage } from '../../../lib/api';
import { formatDateRange, formatMoney, nightsBetween, pluralize, shortRef } from '../../../lib/format';
import { requireSession } from '../../../lib/session';
import { useCurrency } from '../../../lib/currency';
import { Trans, useT } from '../../../lib/i18n';

type Reservation={id:string;status:string;checkIn:string;checkOut:string;currency:string;total:number;holdExpiresAt:string|null;hotelName?:string};
type Phase='review'|'redirecting'|'cancelled'|'processing'|'confirmed'|'expired'|'missing';

function useCountdown(until:string|null|undefined){
  const [left,setLeft]=useState<number|null>(null);
  useEffect(()=>{
    if(!until){setLeft(null);return;}
    const tick=()=>setLeft(Math.max(0,Math.floor((new Date(until).getTime()-Date.now())/1000)));
    tick();const id=setInterval(tick,1000);return()=>clearInterval(id);
  },[until]);
  return left;
}

const steps=['Choose rooms','Rooms held','Payment','Confirmed'];

export default function CheckoutPage(){
  const {format:money,converted,rateNote}=useCurrency();
  const t=useT();
  const [reservation,setReservation]=useState<Reservation|null>(null);
  const [phase,setPhase]=useState<Phase>('review');
  const [error,setError]=useState('');
  const [slow,setSlow]=useState(false);
  const left=useCountdown(phase==='review'||phase==='cancelled'?reservation?.holdExpiresAt:null);
  const [options,setOptions]=useState<{online:boolean;payAtHotel:boolean}|null>(null);
  const [atHotel,setAtHotel]=useState(false);
  const [choosingHotel,setChoosingHotel]=useState(false);

  useEffect(()=>{api<{online:boolean;payAtHotel:boolean}>('/payments/options').then(setOptions).catch(()=>setOptions({online:true,payAtHotel:true}));},[]);

  const payAtHotel=useCallback(async(id:string)=>{
    if(!requireSession())return;
    setChoosingHotel(true);setError('');
    try{
      await api(`/reservations/${id}/pay-at-hotel`,{method:'POST'});
      setAtHotel(true);setPhase('confirmed');sessionStorage.removeItem('stayease-last-reservation');
    }catch(e){setError(errorMessage(e,'We could not confirm your booking. You have not been charged.'));}
    finally{setChoosingHotel(false);}
  },[]);

  const pay=useCallback(async(id:string)=>{
    if(!requireSession())return;
    setPhase('redirecting');setError('');
    try{
      const data=await api<{checkoutUrl:string}>(`/reservations/${id}/checkout`,{method:'POST'});
      if(typeof data.checkoutUrl!=='string'||!data.checkoutUrl.startsWith('https://checkout.stripe.com/'))throw new Error('The payment provider returned an invalid checkout link. You have not been charged.');
      window.location.assign(data.checkoutUrl);
    }catch(e){setError(errorMessage(e,'Checkout could not be started. You have not been charged.'));setPhase('review');}
  },[]);

  useEffect(()=>{
    let current:Reservation;
    try{const raw=sessionStorage.getItem('stayease-last-reservation');if(!raw){setPhase('missing');return;}current=JSON.parse(raw);setReservation(current);}catch{setPhase('missing');return;}
    const state=new URLSearchParams(window.location.search).get('payment');
    if(state==='cancelled'){setPhase('cancelled');return;}
    if(state!=='processing'){setPhase('review');return;}
    if(!requireSession())return;
    setPhase('processing');
    let stopped=false,attempts=0;let timer:ReturnType<typeof setTimeout>;
    const poll=async()=>{
      attempts++;if(attempts>8)setSlow(true);
      try{
        const data=await api<Reservation>(`/reservations/${current.id}`);if(stopped)return;
        setReservation({...current,...data});
        if(data.status==='CONFIRMED'||data.status==='CHECKED_IN'){setPhase('confirmed');sessionStorage.removeItem('stayease-last-reservation');return;}
        if(data.status==='EXPIRED'||data.status==='CANCELLED'){setPhase('expired');return;}
      }catch{/* keep waiting; the provider callback can arrive late */}
      if(!stopped)timer=setTimeout(poll,attempts>8?6000:2500);
    };
    void poll();
    return()=>{stopped=true;clearTimeout(timer);};
  },[]);

  useEffect(()=>{if(left===0&&(phase==='review'||phase==='cancelled'))setPhase('expired');},[left,phase]);

  if(phase==='missing')return <main id="main" className="page"><div className="container container-narrow">
    <EmptyState icon="calendar" title={t('No reservation in progress')} action={<div className="cluster" style={{justifyContent:'center'}}><a className="btn btn-primary" href="/account/bookings">{t('View my trips')}</a><a className="btn btn-secondary" href="/">{t('Search stays')}</a></div>}>
      {t('If you just paid, your booking will appear in My trips once payment is confirmed.')}
    </EmptyState></div></main>;

  const stepIndex=phase==='confirmed'?4:phase==='processing'?3:2;
  const nights=reservation?nightsBetween(reservation.checkIn,reservation.checkOut):0;
  const minutes=left!==null?Math.floor(left/60):0,seconds=left!==null?left%60:0;

  return <main id="main" className="page">
    <div className="container container-narrow">
      <ol className="stepper" aria-label={t('Booking progress')}>
        {steps.map((label,i)=><li key={label} className={i<stepIndex-1||stepIndex===4?'done':i===stepIndex-1?'current':''} aria-current={i===stepIndex-1?'step':undefined}>{t(label)}</li>)}
      </ol>

      <div className="layout-sidebar narrow">
        <section className="card" aria-labelledby="checkout-title">
          <div className="card-body stack">
            {(phase==='review'||phase==='redirecting'||phase==='cancelled')&&<>
              <h1 id="checkout-title">{phase==='cancelled'?t('Payment not completed'):t('Review and confirm')}</h1>
              {phase==='cancelled'&&<Alert tone="warning" title={t('You left checkout before paying')}>{t('You have not been charged. Your rooms are still held, so you can try again.')}</Alert>}
              {left!==null&&left>0&&<Alert tone={left<180?'warning':'info'}><span><Trans text="Your rooms are held for {time}. After that they are released to other guests." vars={{time:<span className="countdown" aria-live={left<60?'polite':'off'}>{minutes}:{String(seconds).padStart(2,'0')}</span>}}/></span></Alert>}
              {error&&<Alert tone="error" title={t('That didn’t work')}>{error}</Alert>}
              <h2 style={{fontSize:'var(--text-lg)'}}>{t('How would you like to pay?')}</h2>
              {options?.online!==false&&<div className="pay-option">
                <div className="stack-sm">
                  <p className="strong cluster" style={{gap:8}}><Icon name="card" size={18}/>{t('Pay online now')}</p>
                  <p className="muted small">{t('Pay by card on Stripe’s secure page. StayEase never sees or stores your card number. Your booking is confirmed as soon as payment is verified.')}</p>
                </div>
                <button type="button" className="btn btn-primary btn-lg btn-block" disabled={phase==='redirecting'||choosingHotel||!reservation||!options} onClick={()=>reservation&&void pay(reservation.id)}>
                  {phase==='redirecting'?<><Spinner/>{t('Opening secure checkout…')}</>:<><Icon name="card" size={18}/>{t('Pay {amount} online',{amount:reservation?formatMoney(reservation.total,reservation.currency):''})}</>}
                </button>
                {reservation&&converted(reservation.currency)&&<p className="hint">{t('About {amount}. Stripe charges you in {currency}; your bank may convert it.',{amount:money(reservation.total,reservation.currency),currency:reservation.currency})} {rateNote}</p>}
              </div>}
              {options?.payAtHotel!==false&&<div className="pay-option">
                <div className="stack-sm">
                  <p className="strong cluster" style={{gap:8}}><Icon name="building" size={18}/>{t('Pay at the hotel')}</p>
                  <p className="muted small">{t('Confirm your rooms now and pay {amount} at the front desk when you arrive, in cash or by card. Nothing is charged today.',{amount:reservation?formatMoney(reservation.total,reservation.currency):''})}</p>
                </div>
                <button type="button" className={`btn ${options?.online===false?'btn-primary':'btn-secondary'} btn-lg btn-block`} disabled={phase==='redirecting'||choosingHotel||!reservation||!options} onClick={()=>reservation&&void payAtHotel(reservation.id)}>
                  {choosingHotel?<><Spinner/>{t('Confirming…')}</>:<><Icon name="building" size={18}/>{t('Confirm and pay at hotel')}</>}
                </button>
              </div>}
              <a href="/account/bookings" className="small">{t('Decide later from My trips')}</a>
            </>}

            {phase==='processing'&&<div className="stack" role="status">
              <h1 id="checkout-title" className="cluster"><Spinner/>{t('Confirming your payment')}</h1>
              <p className="muted">{t('Stripe has your payment. We’re waiting for their secure confirmation, which usually takes a few seconds. Please keep this page open.')}</p>
              {slow&&<Alert tone="info"><Trans text="This is taking longer than usual. You won’t be charged twice. Your booking will appear as confirmed in {trips} as soon as we hear back." vars={{trips:<a href="/account/bookings">{t('My trips')}</a>}}/></Alert>}
            </div>}

            {phase==='confirmed'&&<div className="stack">
              <div className="empty-state-icon" style={{margin:0,background:'var(--color-success-soft)',color:'var(--color-success)'}}><Icon name="check" size={26}/></div>
              <h1 id="checkout-title">{t('Your stay is booked')}</h1>
              {atHotel
                ?<Alert tone="info" title={t('Pay {amount} at the front desk',{amount:reservation?formatMoney(reservation.total,reservation.currency):''})}>{t('Your rooms are confirmed. Please pay when you check in, in cash or by card. We’ve added this reservation to My trips and sent you a confirmation.')}</Alert>
                :<p className="muted">{t('Payment is confirmed. We’ve added this reservation to My trips and sent you an update.')}</p>}
              <div className="cluster">{reservation&&<a className="btn btn-primary" href={`/account/bookings/${reservation.id}/receipt`}><Icon name="card" size={18}/>{atHotel?t('View confirmation'):t('View receipt')}</a>}{reservation&&<a className="btn btn-secondary" href={`/account/bookings/${reservation.id}`}>{t('View reservation')}</a>}<a className="btn btn-secondary" href="/account/bookings">{t('All my trips')}</a></div>
            </div>}

            {phase==='expired'&&<div className="stack">
              <h1 id="checkout-title">{t('Your room hold has ended')}</h1>
              <Alert tone="warning">{t('The rooms were released because payment wasn’t completed in time. You have not been charged.')}</Alert>
              <div className="cluster"><a className="btn btn-primary" href="/">{t('Search again')}</a><a className="btn btn-secondary" href="/account/bookings">{t('My trips')}</a></div>
            </div>}
          </div>
        </section>

        {reservation&&<aside className="card" aria-labelledby="summary-title">
          <div className="card-body stack">
            <div className="cluster-between"><h2 id="summary-title" style={{fontSize:'var(--text-lg)'}}>{t('Booking summary')}</h2><StatusBadge kind="reservation" value={phase==='confirmed'?'CONFIRMED':reservation.status}/></div>
            {reservation.hotelName&&<p className="strong">{reservation.hotelName}</p>}
            <dl className="summary-list">
              <div><dt>{t('Dates')}</dt><dd>{formatDateRange(reservation.checkIn,reservation.checkOut)}</dd></div>
              <div><dt>{t('Length')}</dt><dd>{pluralize(nights,'night')}</dd></div>
              <div><dt>{t('Reference')}</dt><dd className="mono">{shortRef(reservation.id)}</dd></div>
            </dl>
            <div className="summary-total"><span>{t('Total')}</span><span>{money(reservation.total,reservation.currency)}</span></div>
            {converted(reservation.currency)&&<p className="hint">{t('Charged in {currency}: {amount}',{currency:reservation.currency,amount:formatMoney(reservation.total,reservation.currency)})}</p>}
          </div>
        </aside>}
      </div>
    </div>
  </main>;
}
