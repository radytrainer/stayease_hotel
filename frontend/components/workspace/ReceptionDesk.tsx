'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '../Icon';
import { Alert, Badge, EmptyState, Loading, StatusBadge } from '../ui';
import { useConfirm } from '../useConfirm';
import { api, errorMessage } from '../../lib/api';
import { formatDate, formatDateRange, formatMoney, isoDate, pluralize, shortRef } from '../../lib/format';
import { useT } from '../../lib/i18n';
import type { Notify, StaffHotel } from './types';

type Guest={id:string;status:string;check_in:string;check_out:string;guest_count:number;guest_name:string;email:string;room_type_name:string;room_numbers:string;amount_due:number|null;currency:string};

export default function ReceptionDesk({notify}:{notify:Notify}){
  const t=useT();
  const [hotels,setHotels]=useState<StaffHotel[]|null>(null);
  const [hotelId,setHotelId]=useState('');
  const [date,setDate]=useState(isoDate());
  const [guests,setGuests]=useState<Guest[]|null>(null);
  const [loadError,setLoadError]=useState('');
  const [query,setQuery]=useState('');
  const [busy,setBusy]=useState('');
  const [confirm,dialog]=useConfirm();

  useEffect(()=>{api<StaffHotel[]>('/reception/hotels').then(h=>{setHotels(h);if(h.length)setHotelId(h[0].id);}).catch(e=>{setHotels([]);notify({tone:'error',text:errorMessage(e)});});},[notify]);

  const load=useCallback(async()=>{
    if(!hotelId)return;setGuests(null);setLoadError('');
    try{setGuests(await api<Guest[]>(`/reception/hotels/${hotelId}/arrivals?date=${date}`));}
    catch(e){setLoadError(errorMessage(e,'The guest list could not be loaded.'));}
  },[hotelId,date]);
  useEffect(()=>{void load();},[load]);

  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return (guests??[]).filter(g=>!q||g.guest_name.toLowerCase().includes(q)||g.email.toLowerCase().includes(q)||g.id.toLowerCase().startsWith(q)||g.room_numbers.toLowerCase().split(', ').includes(q));
  },[guests,query]);
  const arrivals=filtered.filter(g=>g.status==='CONFIRMED');
  const departures=filtered.filter(g=>g.status==='CHECKED_IN');

  async function act(guest:Guest,action:'check-in'|'check-out'){
    const arriving=action==='check-in';
    const ok=await confirm({title:arriving?t('Check in {name}?',{name:guest.guest_name}):t('Check out {name}?',{name:guest.guest_name}),confirmLabel:arriving?t('Check in'):t('Check out'),
      body:<>{t('Room {number}',{number:guest.room_numbers})} ({guest.room_type_name}) · {formatDateRange(guest.check_in,guest.check_out)} · {pluralize(guest.guest_count,'guest')}<br/>{arriving?t('Confirm the guest’s identity before handing over keys.'):t('Make sure keys are returned and the room is ready for cleaning.')}</>});
    if(!ok)return;
    setBusy(guest.id);
    try{await api(`/reception/hotels/${hotelId}/reservations/${guest.id}/${action}`,{method:'POST'});notify({tone:'success',text:arriving?t('{name} is checked in.',{name:guest.guest_name}):t('{name} is checked out.',{name:guest.guest_name})});await load();}
    catch(e){notify({tone:'error',text:errorMessage(e)});}
    finally{setBusy('');}
  }

  async function markPaid(guest:Guest){
    if(guest.amount_due==null)return;
    const ok=await confirm({title:t('Mark {amount} as received?',{amount:formatMoney(guest.amount_due,guest.currency)}),confirmLabel:t('Mark paid'),
      body:<>{guest.guest_name} · {t('Room {number}',{number:guest.room_numbers})}<br/>{t('Only confirm once the money is in the till or the card payment has gone through.')}</>});
    if(!ok)return;
    setBusy(guest.id);
    try{await api(`/reception/hotels/${hotelId}/reservations/${guest.id}/payment-received`,{method:'POST'});notify({tone:'success',text:t('Payment from {name} recorded.',{name:guest.guest_name})});await load();}
    catch(e){notify({tone:'error',text:errorMessage(e)});}
    finally{setBusy('');}
  }

  if(!hotels)return <Loading label={t('Loading your hotels…')}/>;
  if(!hotels.length)return <EmptyState icon="building" title={t('You aren’t assigned to a hotel')}>{t('Ask your hotel manager or an administrator to add you to the reception team.')}</EmptyState>;

  const table=(rows:Guest[],action:'check-in'|'check-out')=><div className="table-wrap"><table className="table table-stack">
    <thead><tr><th scope="col">{t('Guest')}</th><th scope="col">{t('Rooms')}</th><th scope="col">{t('Stay')}</th><th scope="col">{t('Guests')}</th><th scope="col">{t('Status')}</th><th scope="col">{t('Payment')}</th><th scope="col" className="actions"><span className="visually-hidden">{t('Action')}</span></th></tr></thead>
    <tbody>{rows.map(g=><tr key={g.id}>
      <td className="primary-cell" data-label={t('Guest')}><span className="strong">{g.guest_name}</span><span className="muted small" style={{display:'block'}}>{g.email} · {t('Ref')} <span className="mono">{shortRef(g.id)}</span></span></td>
      <td data-label={t('Rooms')}><span className="strong">{t('Room {number}',{number:g.room_numbers})}</span><span className="muted small" style={{display:'block'}}>{g.room_type_name}</span></td>
      <td data-label={t('Stay')}>{formatDateRange(g.check_in,g.check_out)}</td>
      <td data-label={t('Guests')} className="num">{g.guest_count}</td>
      <td data-label={t('Status')}><StatusBadge kind="reservation" value={g.status}/></td>
      <td data-label={t('Payment')}>{g.amount_due!=null?<Badge tone="warning">{t('Collect {amount}',{amount:formatMoney(g.amount_due,g.currency)})}</Badge>:<Badge tone="success">{t('Paid')}</Badge>}</td>
      <td className="actions"><div className="cluster">
        {g.amount_due!=null&&<button type="button" className="btn btn-sm btn-secondary" disabled={busy===g.id} onClick={()=>void markPaid(g)}>{t('Mark paid')}</button>}
        <button type="button" className={`btn btn-sm ${action==='check-in'?'btn-primary':'btn-secondary'}`} disabled={busy===g.id} onClick={()=>void act(g,action)}>{busy===g.id?t('Saving…'):action==='check-in'?t('Check in'):t('Check out')}</button>
      </div></td>
    </tr>)}</tbody></table></div>;

  return <div className="stack-lg">
    {dialog}
    <div className="workspace-bar">
      <div className="cluster">
        <label htmlFor="desk-hotel" className="form-label">{t('Hotel')}</label>
        <select id="desk-hotel" className="select" value={hotelId} onChange={e=>setHotelId(e.target.value)}>{hotels.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select>
      </div>
      <div className="cluster">
        <div className="segmented" role="group" aria-label={t('Quick date')}>
          <button type="button" aria-pressed={date===isoDate()} onClick={()=>setDate(isoDate())}>{t('Today')}</button>
          <button type="button" aria-pressed={date===isoDate(1)} onClick={()=>setDate(isoDate(1))}>{t('Tomorrow')}</button>
        </div>
        <label htmlFor="desk-date" className="visually-hidden">{t('Date')}</label>
        <input id="desk-date" type="date" className="input" style={{width:'auto'}} value={date} onChange={e=>e.target.value&&setDate(e.target.value)}/>
      </div>
    </div>

    <div className="cluster-between">
      <p className="muted">{formatDate(date,'long')}</p>
      <div className="form-field" style={{minWidth:'min(260px, 100%)'}}><label htmlFor="desk-search" className="visually-hidden">{t('Find a guest')}</label>
        <input id="desk-search" type="search" className="input" placeholder={t('Find guest by name, email, ref or room')} value={query} onChange={e=>setQuery(e.target.value)}/></div>
    </div>

    {loadError&&<Alert tone="error" title={t('Guest list unavailable')}>{loadError} <button type="button" className="link-button" onClick={()=>void load()}>{t('Try again')}</button></Alert>}
    {!guests&&!loadError&&<Loading label={t('Loading arrivals and departures…')}/>}
    {guests&&<>
      <section aria-labelledby="arrivals-title" className="stack">
        <h2 id="arrivals-title" className="cluster" style={{gap:8}}><Icon name="logIn" size={20}/>{t('Arrivals')} <span className="badge badge-plain">{arrivals.length}</span></h2>
        {arrivals.length?table(arrivals,'check-in'):<EmptyState icon="calendar" headingLevel={3} title={query?t('No matching arrivals'):t('No arrivals waiting')}>{query?t('Try a different name or reference.'):t('Confirmed guests arriving on this date appear here until they’re checked in.')}</EmptyState>}
      </section>
      <section aria-labelledby="departures-title" className="stack">
        <h2 id="departures-title" className="cluster" style={{gap:8}}><Icon name="logOut" size={20}/>{t('Departures')} <span className="badge badge-plain">{departures.length}</span></h2>
        {departures.length?table(departures,'check-out'):<EmptyState icon="calendar" headingLevel={3} title={query?t('No matching departures'):t('No departures waiting')}>{query?t('Try a different name or reference.'):t('Checked-in guests leaving on this date appear here until they’re checked out.')}</EmptyState>}
      </section>
    </>}
  </div>;
}
