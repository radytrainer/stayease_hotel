'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '../../../components/Icon';
import { Alert, EmptyState, GuestOnlyNotice, Loading, NoticeBanner, PageHeader, StatusBadge, type Notice, onTabListKeyDown } from '../../../components/ui';
import { useConfirm } from '../../../components/useConfirm';
import { api, ApiError, errorMessage } from '../../../lib/api';
import { formatDateRange, formatDateTime, formatMoney, nightsBetween, notificationTitle, pluralize, shortRef } from '../../../lib/format';
import { canBook, getRoles, requireSession } from '../../../lib/session';
import { useCurrency } from '../../../lib/currency';
import { useT } from '../../../lib/i18n';

type Booking={id:string;status:string;checkIn:string;checkOut:string;currency:string;total:number;hotelName:string;hotelPayment?:string};
type Update={id:string;template:string;payload:{hotelName?:string;checkIn?:string;checkOut?:string;refundAmount?:number;refundCurrency?:string};createdAt:string;read:boolean};
type Tab='upcoming'|'past'|'cancelled';

const groups:Record<Tab,string[]>={upcoming:['PENDING_PAYMENT','CONFIRMED','CHECKED_IN','CREATED'],past:['CHECKED_OUT','COMPLETED'],cancelled:['CANCELLED','EXPIRED']};
const tabLabels:Record<Tab,string>={upcoming:'Upcoming',past:'Past',cancelled:'Cancelled & expired'};

export default function TripsPage(){
  const {format:money}=useCurrency();
  const t=useT();
  const [bookings,setBookings]=useState<Booking[]|null>(null);
  const [updates,setUpdates]=useState<Update[]>([]);
  const [loadError,setLoadError]=useState('');
  const [guestOnly,setGuestOnly]=useState(false);
  const [notice,setNotice]=useState<Notice>(null);
  const [tab,setTab]=useState<Tab>('upcoming');
  const [busy,setBusy]=useState('');
  const [confirm,dialog]=useConfirm();

  const load=useCallback(async()=>{
    setLoadError('');
    try{
      const [rows,inbox]=await Promise.all([api<Booking[]>('/reservations'),api<Update[]>('/notifications').catch(()=>[])]);
      setBookings(rows);setUpdates(inbox);
    }catch(e){
      if(e instanceof ApiError&&e.status===403){setGuestOnly(true);return;}
      setLoadError(errorMessage(e,'Your trips could not be loaded.'));
    }
  },[]);
  useEffect(()=>{
    if(!requireSession())return;
    if(!canBook(getRoles())){setGuestOnly(true);return;}
    void load();
  },[load]);

  const byTab=useMemo(()=>{
    const result:Record<Tab,Booking[]>={upcoming:[],past:[],cancelled:[]};
    for(const b of bookings??[]){const key=(Object.keys(groups) as Tab[]).find(t=>groups[t].includes(b.status))??'past';result[key].push(b);}
    result.upcoming.sort((a,b)=>a.checkIn.localeCompare(b.checkIn));
    return result;
  },[bookings]);

  async function cancel(booking:Booking){
    const ok=await confirm({title:t('Cancel your stay at {hotel}?',{hotel:booking.hotelName}),danger:true,confirmLabel:t('Cancel reservation'),cancelLabel:t('Keep reservation'),
      body:<>{t('Your refund is calculated from the cancellation policy that applied when you booked. Any refund goes back to your original payment method. This can’t be undone.')}</>});
    if(!ok)return;
    setBusy(booking.id);setNotice(null);
    try{
      const result=await api<{currency:string;refundAmount:number}>(`/reservations/${booking.id}/cancel`,{method:'POST',body:{reason:'Guest requested cancellation'}});
      setNotice({tone:'success',text:Number(result.refundAmount)>0?t('Reservation cancelled. A refund of {amount} is on its way to your original payment method.',{amount:formatMoney(result.refundAmount,result.currency)}):t('Reservation cancelled. Under the booking policy, no refund is due.')});
      await load();
    }catch(e){setNotice({tone:'error',text:errorMessage(e,'The reservation could not be cancelled.')});}
    finally{setBusy('');}
  }

  async function resumePayment(booking:Booking){
    setBusy(booking.id);
    try{
      const latest=await api<Record<string,unknown>>(`/reservations/${booking.id}`);
      sessionStorage.setItem('stayease-last-reservation',JSON.stringify({...latest,hotelName:booking.hotelName}));
      window.location.assign('/reservation/held');
    }catch(e){setNotice({tone:'error',text:errorMessage(e)});setBusy('');}
  }

  async function markRead(ids:string[]){
    await Promise.all(ids.map(id=>api(`/notifications/${id}/read`,{method:'PATCH'}).catch(()=>null)));
    setUpdates(current=>current.map(u=>ids.includes(u.id)?{...u,read:true}:u));
  }

  const unread=updates.filter(u=>!u.read);
  const list=byTab[tab];

  if(guestOnly)return <main id="main" className="page"><div className="container container-narrow"><GuestOnlyNotice task={t('book a stay')}/></div></main>;

  return <main id="main" className="page">
    <div className="container">
      <PageHeader eyebrow={t('Your account')} title={t('My trips')} description={t('Pay for held rooms, check your booking details and cancel eligible reservations.')} actions={<a className="btn btn-primary" href="/"><Icon name="search" size={18}/>{t('Book a stay')}</a>}/>
      {dialog}
      <div className="layout-sidebar">
        <div className="stack">
          <NoticeBanner notice={notice} onDismiss={()=>setNotice(null)}/>
          {loadError&&<Alert tone="error" title={t('Trips couldn’t be loaded')}>{loadError} <button type="button" className="link-button" onClick={()=>void load()}>{t('Try again')}</button></Alert>}
          {!bookings&&!loadError&&<Loading label={t('Loading your trips…')}/>}
          {bookings&&<>
            <div className="tabs" role="tablist" onKeyDown={onTabListKeyDown} aria-label={t('Filter trips')}>
              {(Object.keys(tabLabels) as Tab[]).map(k=><button key={k} role="tab" id={`tab-${k}`} aria-controls="trip-panel" aria-selected={tab===k} tabIndex={tab===k?0:-1} className="tab" onClick={()=>setTab(k)}>{t(tabLabels[k])}<span className="count">{byTab[k].length}</span></button>)}
            </div>
            <div id="trip-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
              {!list.length?<EmptyState icon="calendar" headingLevel={3} title={tab==='upcoming'?t('No upcoming trips'):tab==='past'?t('No past stays yet'):t('Nothing cancelled')}
                action={tab==='upcoming'?<a className="btn btn-primary" href="/">{t('Find a stay')}</a>:undefined}>
                {tab==='upcoming'?t('When you hold or book rooms, they’ll appear here.'):tab==='past'?t('Stays you’ve completed will appear here.'):t('Cancelled reservations and expired holds will appear here.')}
              </EmptyState>
              :<div className="card">{list.map(b=><article key={b.id} className="booking-row" aria-labelledby={`b-${b.id}`}>
                <div>
                  <div className="cluster" style={{gap:'var(--space-2) var(--space-3)'}}><h3 id={`b-${b.id}`}>{b.hotelName}</h3><StatusBadge kind="reservation" value={b.status}/></div>
                  <div className="booking-meta">
                    <span className="cluster" style={{gap:6}}><Icon name="calendar" size={16}/>{formatDateRange(b.checkIn,b.checkOut)}</span>
                    <span>{pluralize(nightsBetween(b.checkIn,b.checkOut),'night')}</span>
                    <span>{t('Ref')} <span className="mono">{shortRef(b.id)}</span></span>
                  </div>
                  {b.status==='PENDING_PAYMENT'&&<p className="small" style={{color:'var(--color-warning)',marginTop:8}}>{t('Not paid yet. Your rooms are released if the hold expires.')}</p>}
                  {b.hotelPayment==='PENDING'&&b.status!=='CANCELLED'&&<p className="small strong cluster" style={{color:'var(--color-info)',marginTop:8,gap:6}}><Icon name="building" size={16}/>{t('Pay {amount} at the front desk on arrival',{amount:formatMoney(b.total,b.currency)})}</p>}
                  {b.hotelPayment==='SUCCEEDED'&&<p className="small cluster" style={{color:'var(--color-success)',marginTop:8,gap:6}}><Icon name="check" size={16}/>{t('Paid at the hotel')}</p>}
                </div>
                <div className="booking-side">
                  <strong className="num" style={{fontSize:'var(--text-lg)'}}>{money(b.total,b.currency)}</strong>
                  <div className="cluster">
                    {b.status==='PENDING_PAYMENT'&&<button type="button" className="btn btn-primary btn-sm" disabled={busy===b.id} onClick={()=>void resumePayment(b)}>{t('Choose how to pay')}</button>}
                    <a className="btn btn-secondary btn-sm" href={`/account/bookings/${encodeURIComponent(b.id)}`}>{t('Details')}</a>
                    {['CONFIRMED','PENDING_PAYMENT'].includes(b.status)&&<button type="button" className="btn btn-danger-outline btn-sm" disabled={busy===b.id} onClick={()=>void cancel(b)}>{busy===b.id?t('Working…'):t('Cancel')}</button>}
                  </div>
                </div>
              </article>)}</div>}
            </div>
          </>}
        </div>

        <aside className="card" aria-labelledby="updates-title">
          <div className="card-header cluster-between"><h2 id="updates-title" className="cluster" style={{fontSize:'var(--text-lg)',gap:8}}><Icon name="bell" size={18}/>{t('Updates')}{unread.length>0&&<span className="badge badge-primary badge-plain">{t('{count} new',{count:unread.length})}</span>}</h2>
            {unread.length>0&&<button type="button" className="link-button small" onClick={()=>void markRead(unread.map(u=>u.id))}>{t('Mark all read')}</button>}</div>
          <div className="card-body" style={{paddingTop:0,paddingBottom:0}}>
            {!updates.length?<p className="muted small" style={{padding:'var(--space-5) 0'}}>{t('Booking, payment and refund updates will appear here.')}</p>
              :<ul style={{listStyle:'none',margin:0,padding:0}}>{updates.slice(0,12).map(u=><li key={u.id} className="notice-item">
                <span className={`notice-dot${u.read?' read':''}`} aria-hidden="true"/>
                <div style={{flex:1,minWidth:0}}>
                  <p className={u.read?'small':'small strong'}>{notificationTitle(u.template)}<span className="visually-hidden">{u.read?'':` (${t('unread')})`}</span></p>
                  {u.payload?.hotelName&&<p className="xsmall muted">{u.payload.hotelName}{u.payload.checkIn&&u.payload.checkOut?` · ${formatDateRange(u.payload.checkIn,u.payload.checkOut)}`:''}</p>}
                  {u.template==='REFUND_ISSUED'&&u.payload?.refundAmount!=null&&u.payload.refundCurrency&&<p className="xsmall strong" style={{color:'var(--color-success)'}}>{t('{amount} back to your original payment method',{amount:formatMoney(Number(u.payload.refundAmount),u.payload.refundCurrency)})}</p>}
                  <p className="xsmall muted">{formatDateTime(u.createdAt)}</p>
                </div>
                {!u.read&&<button type="button" className="btn btn-ghost btn-sm" onClick={()=>void markRead([u.id])} aria-label={t('Mark “{title}” as read',{title:notificationTitle(u.template)})}>{t('Mark read')}</button>}
              </li>)}</ul>}
          </div>
        </aside>
      </div>
    </div>
  </main>;
}
