'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Icon from '../../../../components/Icon';
import { Alert, Breadcrumbs, EmptyState, Loading, NoticeBanner, StatusBadge, type Notice } from '../../../../components/ui';
import { useConfirm } from '../../../../components/useConfirm';
import { api, ApiError, errorMessage } from '../../../../lib/api';
import { formatDate, formatDateTime, formatMoney, nightsBetween, pluralize, shortRef } from '../../../../lib/format';
import { requireSession } from '../../../../lib/session';
import { useCurrency } from '../../../../lib/currency';
import { useT } from '../../../../lib/i18n';
import { translate } from '../../../../lib/lang';
import { placeName } from '../../../../lib/cambodia';

type Night={date:string;amount:number};
type Summary={id:string;status:string;checkIn:string;checkOut:string;guests:number;currency:string;total:number;holdExpiresAt:string|null;createdAt:string;hotelPayment?:string;payment?:{status:string}|null;discount?:number|null;promoCode?:string|null;
  hotel:{name:string;address:string;city:string;country:string};rooms:{roomType:string;lineTotal:number;currency:string;nightlyRates:Night[];roomNumber?:string;floor?:number|null}[]};

const statusCopy:Record<string,string>={
  PENDING_PAYMENT:'Your rooms are held but not paid for yet.',
  CONFIRMED:'Payment is confirmed. Show this reference at reception.',
  CHECKED_IN:'You’re checked in. Enjoy your stay.',
  CHECKED_OUT:'You’ve checked out. Thanks for staying.',
  COMPLETED:'This stay is complete.',
  CANCELLED:'This reservation was cancelled.',
  EXPIRED:'This hold expired before payment, so the rooms were released.',
};

/** e.g. "Room 204 · Floor 2", "Room 12 · Ground floor" or "Room V1" for villas without a floor. */
function roomLabel(room:{roomNumber?:string;floor?:number|null}){
  const floor=room.floor==null?'':room.floor===0?` · ${translate('Ground floor')}`:` · ${translate('Floor {n}',{n:room.floor})}`;
  return `${translate('Room {number}',{number:room.roomNumber??''})}${floor}`;
}

export default function BookingDetailPage(){
  const {format:money,converted,rateNote}=useCurrency();
  const {id}=useParams<{id:string}>();
  const t=useT();
  const [booking,setBooking]=useState<Summary|null>(null);
  const [error,setError]=useState<{status:number;message:string}|null>(null);
  const [notice,setNotice]=useState<Notice>(null);
  const [busy,setBusy]=useState(false);
  const [confirm,dialog]=useConfirm();

  const load=useCallback(()=>api<Summary>(`/reservations/${encodeURIComponent(id)}/summary`).then(setBooking)
    .catch(e=>setError({status:e instanceof ApiError?e.status:0,message:errorMessage(e,'This reservation could not be loaded.')})),[id]);
  useEffect(()=>{if(requireSession())void load();},[load]);

  async function cancel(){
    if(!booking)return;
    if(!await confirm({title:t('Cancel this reservation?'),danger:true,confirmLabel:t('Cancel reservation'),cancelLabel:t('Keep reservation'),body:t('Any refund follows the cancellation policy saved when you booked, and goes back to your original payment method. This can’t be undone.')}))return;
    setBusy(true);
    try{
      const r=await api<{currency:string;refundAmount:number}>(`/reservations/${booking.id}/cancel`,{method:'POST',body:{reason:'Guest requested cancellation'}});
      setNotice({tone:'success',text:Number(r.refundAmount)>0?t('Cancelled. {amount} will be refunded to your original payment method.',{amount:formatMoney(r.refundAmount,r.currency)}):t('Cancelled. Under the booking policy, no refund is due.')});
      await load();
    }catch(e){setNotice({tone:'error',text:errorMessage(e,'The reservation could not be cancelled.')});}
    finally{setBusy(false);}
  }
  function pay(){
    if(!booking)return;
    sessionStorage.setItem('stayease-last-reservation',JSON.stringify({id:booking.id,status:booking.status,checkIn:booking.checkIn,checkOut:booking.checkOut,currency:booking.currency,total:booking.total,holdExpiresAt:booking.holdExpiresAt,hotelName:booking.hotel.name}));
    window.location.assign('/reservation/held');
  }

  if(error)return <main id="main" className="page"><div className="container container-narrow"><EmptyState icon="search" title={error.status===404?t('Reservation not found'):t('We couldn’t load this reservation')} action={<a className="btn btn-primary" href="/account/bookings">{t('Back to my trips')}</a>}>{error.status===404?t('It may belong to a different account.'):error.message}</EmptyState></div></main>;
  if(!booking)return <main id="main" className="page"><div className="container"><Loading label={t('Loading reservation…')}/></div></main>;

  const nights=nightsBetween(booking.checkIn,booking.checkOut);
  const cancellable=['CONFIRMED','PENDING_PAYMENT'].includes(booking.status);

  return <main id="main" className="page">
    <div className="container">
      {dialog}
      <Breadcrumbs items={[{label:t('My trips'),href:'/account/bookings'},{label:booking.hotel.name}]}/>
      <header className="page-header">
        <div>
          <div className="cluster" style={{marginBottom:8}}><StatusBadge kind="reservation" value={booking.status}/><span className="muted small">{t('Ref')} <span className="mono">{shortRef(booking.id)}</span></span></div>
          <h1>{booking.hotel.name}</h1>
          <p>{statusCopy[booking.status]?t(statusCopy[booking.status]):''}</p>
        </div>
        <div className="cluster">
          {booking.status==='PENDING_PAYMENT'&&<button type="button" className="btn btn-primary" onClick={pay}><Icon name="card" size={18}/>{t('Choose how to pay')}</button>}
          {booking.payment&&<a className="btn btn-secondary" href={`/account/bookings/${booking.id}/receipt`}><Icon name="card" size={18}/>{['SUCCEEDED','REFUNDED'].includes(booking.payment.status)?t('View receipt'):t('View confirmation')}</a>}
          {cancellable&&<button type="button" className="btn btn-danger-outline" disabled={busy} onClick={()=>void cancel()}>{busy?t('Cancelling…'):t('Cancel reservation')}</button>}
        </div>
      </header>

      <div className="stack-lg">
        <NoticeBanner notice={notice} onDismiss={()=>setNotice(null)}/>
        {booking.status==='PENDING_PAYMENT'&&booking.holdExpiresAt&&<Alert tone="warning">{t('Pay by {time} to keep these rooms.',{time:formatDateTime(booking.holdExpiresAt)})}</Alert>}

        <div className="layout-sidebar">
          <section className="card" aria-labelledby="price-title">
            <div className="card-header"><h2 id="price-title" style={{fontSize:'var(--text-lg)'}}>{t('Price breakdown')}</h2><p className="hint" style={{marginTop:4}}>{t('Nightly rates are fixed at the moment you booked.')}</p></div>
            {booking.rooms.map((room,i)=><div key={`${room.roomType}-${i}`} className="card-body" style={{borderTop:i?'1px solid var(--color-border)':undefined}}>
              <div className="cluster-between" style={{marginBottom:'var(--space-3)'}}><div><h3 className="cluster" style={{gap:8,fontSize:'var(--text-md)'}}><Icon name="bed" size={18}/>{room.roomType}</h3>{room.roomNumber&&<p className="small muted" style={{marginTop:2}}>{roomLabel(room)}</p>}</div><strong className="num">{money(room.lineTotal,room.currency)}</strong></div>
              <table className="table" style={{border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)'}}>
                <thead><tr><th scope="col">{t('Night of')}</th><th scope="col" className="text-right">{t('Rate')}</th></tr></thead>
                <tbody>{room.nightlyRates.map(n=><tr key={n.date}><td>{formatDate(n.date)}</td><td className="text-right num">{money(n.amount,room.currency)}</td></tr>)}</tbody>
              </table>
            </div>)}
            {Number(booking.discount)>0&&<div className="card-body cluster-between small" style={{borderTop:'1px solid var(--color-border)',paddingTop:'var(--space-3)',paddingBottom:'var(--space-3)'}}>
              <span>{booking.promoCode?t('Discount ({code})',{code:booking.promoCode}):t('Discount')}</span><span className="strong" style={{color:'var(--color-success)'}}>−{money(Number(booking.discount),booking.currency)}</span>
            </div>}
            <div className="card-footer summary-total" style={{borderTop:'1px solid var(--color-border)'}}><span>{t('Total for {nights}',{nights:pluralize(nights,'night')})}</span><span>{money(booking.total,booking.currency)}</span></div>
            {converted(booking.currency)&&<p className="hint" style={{padding:'0 var(--space-6) var(--space-4)'}}>{t('Paid in {currency}: {amount}. Riel amounts are approximate.',{currency:booking.currency,amount:formatMoney(booking.total,booking.currency)})} {rateNote}</p>}
          </section>

          <aside className="card" aria-labelledby="stay-title">
            <div className="card-body stack">
              <h2 id="stay-title" style={{fontSize:'var(--text-lg)'}}>{t('Stay details')}</h2>
              <dl className="summary-list">
                <div><dt>{t('Check-in')}</dt><dd>{formatDate(booking.checkIn,'long')}</dd></div>
                <div><dt>{t('Check-out')}</dt><dd>{formatDate(booking.checkOut,'long')}</dd></div>
                <div><dt>{t('Length')}</dt><dd>{pluralize(nights,'night')}</dd></div>
                <div><dt>{t('Guests')}</dt><dd>{booking.guests}</dd></div>
                <div><dt>{booking.rooms.length===1?t('Room'):t('Rooms')}</dt><dd>{booking.rooms.map(r=>r.roomNumber).filter(Boolean).join(', ')||booking.rooms.length}</dd></div>
                <div><dt>{t('Booked')}</dt><dd>{formatDateTime(booking.createdAt)}</dd></div>
                {booking.hotelPayment&&booking.hotelPayment!=='FAILED'&&<div><dt>{t('Payment')}</dt><dd>{booking.hotelPayment==='SUCCEEDED'?t('Paid at the hotel'):t('Pay at the front desk on arrival')}</dd></div>}
              </dl>
              <hr className="divider" style={{margin:0}}/>
              <div className="small"><p className="strong cluster" style={{gap:6}}><Icon name="pin" size={16}/>{t('Address')}</p><p className="muted" style={{marginTop:4}}>{booking.hotel.address}<br/>{placeName(booking.hotel.city)}, {t(booking.hotel.country)}</p></div>
              <p className="hint">{t('Full reference:')} <span className="mono">{booking.id}</span></p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  </main>;
}
