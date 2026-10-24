'use client';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '../Icon';
import { Alert, EmptyState, Loading, Spinner, StatusBadge, onTabListKeyDown } from '../ui';
import { api, errorMessage } from '../../lib/api';
import { addDays, formatMoney, isoDate, pluralize } from '../../lib/format';
import type { Notify, StaffHotel } from './types';
import HotelMap from '../HotelMap';
import PaymentsToCollect from './PaymentsToCollect';
import Promotions from './Promotions';
import { CAMBODIA_BOUNDS, insideCambodia, parseCoordinates } from '../../lib/location';
import { useT } from '../../lib/i18n';
import { placeName } from '../../lib/cambodia';

type RoomType={id:string;name:string;description:string|null;capacity:number;currency:string;base_price:number;active:boolean;photo_count?:number};
type Room={id:string;room_number:string;floor:number|null;room_type:string;operational_status:string};
type Report={from:string;to:string;roomCount:number;occupancyPercent:number;reservations:number;cancellations:number;netRevenue:number};
type Section='overview'|'rooms'|'types'|'policy'|'promotions'|'location'|'photos';

const sections:{id:Section;label:string}[]=[{id:'overview',label:'Overview'},{id:'rooms',label:'Rooms'},{id:'types',label:'Room types & rates'},{id:'policy',label:'Cancellation policy'},{id:'promotions',label:'Promo codes'},{id:'location',label:'Location'},{id:'photos',label:'Photos'}];
const roomStatuses=[{value:'AVAILABLE',label:'Available'},{value:'CLEANING',label:'Cleaning'},{value:'OUT_OF_SERVICE',label:'Out of service'}];
const compact=new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1});

function monthRange(){const now=new Date();const first=isoDate(0,new Date(now.getFullYear(),now.getMonth(),1));return {from:first,to:isoDate(0,new Date(now.getFullYear(),now.getMonth()+1,1))};}

export default function ManagerWorkspace({notify}:{notify:Notify}){
  const tr=useT();
  const [hotels,setHotels]=useState<StaffHotel[]|null>(null);
  const [hotelId,setHotelId]=useState('');
  const [section,setSection]=useState<Section>('overview');
  const [types,setTypes]=useState<RoomType[]>([]);
  const [rooms,setRooms]=useState<Room[]>([]);
  const [inventoryLoading,setInventoryLoading]=useState(false);
  const [report,setReport]=useState<Report|null>(null);
  const [range,setRange]=useState(monthRange);
  const [reportState,setReportState]=useState<'idle'|'loading'|'error'>('idle');
  const [busy,setBusy]=useState('');
  const [policyPreview,setPolicyPreview]=useState({hours:48,percent:50});
  const [photo,setPhoto]=useState<{url:string;error:string}|null>(null);
  const [roomPhoto,setRoomPhoto]=useState<{url:string;error:string}|null>(null);
  const [pin,setPin]=useState({lat:'',lng:''});
  const [pinError,setPinError]=useState('');

  useEffect(()=>{api<StaffHotel[]>('/manager/hotels').then(h=>{setHotels(h);if(h.length)setHotelId(h[0].id);}).catch(e=>{setHotels([]);notify({tone:'error',text:errorMessage(e)});});},[notify]);

  const loadInventory=useCallback(async()=>{
    if(!hotelId)return;setInventoryLoading(true);
    try{const [t,r]=await Promise.all([api<RoomType[]>(`/manager/hotels/${hotelId}/room-types`),api<Room[]>(`/manager/hotels/${hotelId}/rooms`)]);setTypes(t);setRooms(r);}
    catch(e){notify({tone:'error',text:errorMessage(e,'Inventory could not be loaded.')});}
    finally{setInventoryLoading(false);}
  },[hotelId,notify]);

  const loadReport=useCallback(async(r:{from:string;to:string})=>{
    if(!hotelId)return;setReportState('loading');
    try{setReport(await api<Report>(`/manager/hotels/${hotelId}/reports/overview?${new URLSearchParams(r)}`));setReportState('idle');}
    catch(e){setReportState('error');notify({tone:'error',text:errorMessage(e,'The report could not be loaded.')});}
  },[hotelId,notify]);

  useEffect(()=>{setReport(null);void loadInventory();void loadReport(range);},[hotelId]);
  useEffect(()=>{const h=hotels?.find(x=>x.id===hotelId);setPin({lat:h?.latitude!=null?String(h.latitude):'',lng:h?.longitude!=null?String(h.longitude):''});setPinError('');},[hotelId,hotels]); // range is applied on demand, not on every keystroke

  async function post(key:string,path:string,body:unknown,success:string,form?:HTMLFormElement){
    setBusy(key);
    try{await api(path,{method:'POST',body});notify({tone:'success',text:success});form?.reset();await loadInventory();return true;}
    catch(e){notify({tone:'error',text:errorMessage(e)});return false;}
    finally{setBusy('');}
  }

  async function setRoomStatus(room:Room,status:string){
    setBusy(room.id);
    try{await api(`/manager/hotels/${hotelId}/rooms/${room.id}/status`,{method:'PATCH',body:{status}});setRooms(rs=>rs.map(r=>r.id===room.id?{...r,operational_status:status}:r));notify({tone:'success',text:tr('Room {number} is now: {status}.',{number:room.room_number,status:tr(roomStatuses.find(s=>s.value===status)?.label??status)})});}
    catch(e){notify({tone:'error',text:errorMessage(e)});}
    finally{setBusy('');}
  }

  async function saveLocation(clear=false){
    const lat=Number(pin.lat),lng=Number(pin.lng);
    if(!clear){
      if(!pin.lat||!pin.lng||Number.isNaN(lat)||Number.isNaN(lng)){setPinError(tr('Enter both latitude and longitude.'));return;}
      if(!insideCambodia(lat,lng)){setPinError(tr('That point is outside Cambodia. Check you haven’t swapped latitude and longitude.'));return;}
    }
    setBusy('location');setPinError('');
    const body=clear?{latitude:null,longitude:null}:{latitude:Number(lat.toFixed(6)),longitude:Number(lng.toFixed(6))};
    try{
      await api(`/manager/hotels/${hotelId}/location`,{method:'PUT',body});
      setHotels(hs=>hs?.map(h=>h.id===hotelId?{...h,latitude:body.latitude,longitude:body.longitude}:h)??null);
      notify({tone:'success',text:clear?tr('Map location removed.'):tr('Map location saved. Guests see it on your hotel page.')});
    }catch(err){notify({tone:'error',text:errorMessage(err)});}
    finally{setBusy('');}
  }

  function useCurrentLocation(){
    if(!navigator.geolocation){setPinError(tr('This browser can’t share its location.'));return;}
    setBusy('locate');
    navigator.geolocation.getCurrentPosition(
      p=>{setPin({lat:p.coords.latitude.toFixed(6),lng:p.coords.longitude.toFixed(6)});setPinError('');setBusy('');},
      ()=>{setPinError(tr('Location permission was denied or unavailable.'));setBusy('');},
      {enableHighAccuracy:true,timeout:10000});
  }

  async function uploadRoomPhoto(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const form=e.currentTarget;const data=new FormData(form);const file=data.get('file');const typeId=String(data.get('roomTypeId')||'');
    data.delete('roomTypeId');
    if(!(file instanceof File)||!file.size){setRoomPhoto({url:'',error:tr('Choose a photo to upload.')});return;}
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)){setRoomPhoto({url:roomPhoto?.url??'',error:tr('Use a PNG, JPEG or WebP image.')});return;}
    if(file.size>10*1024*1024){setRoomPhoto({url:roomPhoto?.url??'',error:tr('Choose an image smaller than 10 MB.')});return;}
    setBusy('roomPhoto');
    try{await api(`/manager/hotels/${hotelId}/room-types/${typeId}/images`,{method:'POST',body:data});notify({tone:'success',text:tr('Room photo uploaded. Guests see it when they open the room’s photos.')});form.reset();setRoomPhoto(null);await loadInventory();}
    catch(err){notify({tone:'error',text:errorMessage(err,'The photo could not be uploaded.')});}
    finally{setBusy('');}
  }

  async function uploadPhoto(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const form=e.currentTarget;const data=new FormData(form);const file=data.get('file');
    if(!(file instanceof File)||!file.size){setPhoto({url:'',error:tr('Choose a photo to upload.')});return;}
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)){setPhoto({url:photo?.url??'',error:tr('Use a PNG, JPEG or WebP image.')});return;}
    if(file.size>10*1024*1024){setPhoto({url:photo?.url??'',error:tr('Choose an image smaller than 10 MB.')});return;}
    setBusy('photo');
    try{await api(`/manager/hotels/${hotelId}/images`,{method:'POST',body:data});notify({tone:'success',text:tr('Photo uploaded. It appears on your public hotel page once the hotel is live.')});form.reset();setPhoto(null);}
    catch(err){notify({tone:'error',text:errorMessage(err,'The photo could not be uploaded.')});}
    finally{setBusy('');}
  }

  const hotel=hotels?.find(h=>h.id===hotelId);
  const roomCounts=useMemo(()=>roomStatuses.map(s=>({...s,count:rooms.filter(r=>r.operational_status===s.value).length})),[rooms]);
  const currency=types[0]?.currency;

  if(!hotels)return <Loading label={tr('Loading your hotels…')}/>;
  if(!hotels.length)return <EmptyState icon="building" title={tr('No hotels assigned to you')} action={<a className="btn btn-primary" href="/list-hotel">{tr('List a hotel')}</a>}>{tr('Register a hotel, or ask an administrator to assign you as its manager.')}</EmptyState>;

  return <div className="stack">
    <div className="workspace-bar">
      <div className="cluster">
        <label htmlFor="manager-hotel" className="form-label">{tr('Hotel')}</label>
        <select id="manager-hotel" className="select" value={hotelId} onChange={e=>setHotelId(e.target.value)}>{hotels.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select>
        {hotel&&<StatusBadge kind="hotel" value={hotel.status}/>}
      </div>
      {hotel&&<span className="muted small cluster" style={{gap:6}}><Icon name="pin" size={16}/>{placeName(hotel.city)}, {tr(hotel.country)}</span>}
    </div>
    {hotel?.status==='PENDING_APPROVAL'&&<Alert tone="info" title={tr('Waiting for approval')}>{tr('Guests can’t see or book this hotel yet. You can finish setting up rooms, rates and photos in the meantime.')}</Alert>}
    {hotel?.status==='SUSPENDED'&&<Alert tone="warning" title={tr('This hotel is suspended')}>{tr('It is hidden from guests and can’t take new bookings. Contact an administrator for help.')}</Alert>}

    <div className="tabs" role="tablist" onKeyDown={onTabListKeyDown} aria-label={tr('Hotel management')}>
      {sections.map(s=><button key={s.id} role="tab" id={`mtab-${s.id}`} aria-controls="mpanel" aria-selected={section===s.id} tabIndex={section===s.id?0:-1} className="tab" onClick={()=>setSection(s.id)}>{tr(s.label)}{s.id==='rooms'&&<span className="count">{rooms.length}</span>}{s.id==='types'&&<span className="count">{types.length}</span>}</button>)}
    </div>

    <div id="mpanel" role="tabpanel" aria-labelledby={`mtab-${section}`} className="stack-lg">
      {section==='overview'&&<>
        <form className="inline-form" onSubmit={e=>{e.preventDefault();if(range.to<=range.from){notify({tone:'error',text:tr('The end date must be after the start date.')});return;}void loadReport(range);}}>
          <div className="form-field"><label htmlFor="r-from">{tr('From')}</label><input id="r-from" className="input" type="date" value={range.from} onChange={e=>setRange(r=>({...r,from:e.target.value}))} required/></div>
          <div className="form-field"><label htmlFor="r-to">{tr('To (not included)')}</label><input id="r-to" className="input" type="date" value={range.to} min={range.from?addDays(range.from,1):undefined} onChange={e=>setRange(r=>({...r,to:e.target.value}))} required/></div>
          <button className="btn btn-secondary" disabled={reportState==='loading'}>{reportState==='loading'?<><Spinner/>{tr('Loading…')}</>:tr('Update report')}</button>
        </form>
        {report?<div className="stat-grid" aria-live="polite">
          <div className="stat"><p className="stat-label">{tr('Occupancy')}</p><p className="stat-value">{Number(report.occupancyPercent).toFixed(1)}%</p><div className="meter" role="img" aria-label={tr('{percent} percent of room nights sold',{percent:Number(report.occupancyPercent).toFixed(1)})}><span style={{width:`${Math.min(100,Number(report.occupancyPercent))}%`}}/></div><p className="stat-note">{tr('Across {rooms}',{rooms:pluralize(report.roomCount,'room')})}</p></div>
          <div className="stat"><p className="stat-label">{tr('Paid reservations')}</p><p className="stat-value">{compact.format(report.reservations)}</p><p className="stat-note">{tr('Staying during this period')}</p></div>
          <div className="stat"><p className="stat-label">{tr('Cancellations')}</p><p className="stat-value">{compact.format(report.cancellations)}</p><p className="stat-note">{tr('By check-in date')}</p></div>
          <div className="stat"><p className="stat-label">{tr('Net revenue')}</p><p className="stat-value">{currency?formatMoney(report.netRevenue,currency):compact.format(Number(report.netRevenue))}</p><p className="stat-note">{tr('Payments minus refunds')}</p></div>
        </div>:reportState==='loading'?<Loading label={tr('Loading report…')}/>:null}
        <section className="card" aria-labelledby="room-status-title"><div className="card-body stack">
          <h2 id="room-status-title" style={{fontSize:'var(--text-lg)'}}>{tr('Rooms right now')}</h2>
          {rooms.length?<div className="cluster">{roomCounts.map(s=><span key={s.value} className="cluster" style={{gap:8}}><StatusBadge kind="room" value={s.value}/><span className="strong num">{s.count}</span></span>)}</div>
            :<p className="muted">{tr('No rooms yet.')} <button type="button" className="link-button" onClick={()=>setSection(types.length?'rooms':'types')}>{types.length?tr('Add your first room'):tr('Start by adding a room type')}</button></p>}
        </div></section>
        {hotel&&<PaymentsToCollect key={hotel.id} base={`/manager/hotels/${hotel.id}`} notify={notify}/>}
      </>}

      {section==='rooms'&&<>
        {inventoryLoading?<Loading/>:rooms.length?<div className="table-wrap"><table className="table table-stack">
          <caption className="visually-hidden">{tr('Physical rooms')}</caption>
          <thead><tr><th scope="col">{tr('Room')}</th><th scope="col">{tr('Floor')}</th><th scope="col">{tr('Type')}</th><th scope="col">{tr('Status')}</th><th scope="col" className="actions">{tr('Change status')}</th></tr></thead>
          <tbody>{rooms.map(r=><tr key={r.id}>
            <td className="primary-cell strong" data-label={tr('Room')}>{r.room_number}</td>
            <td data-label={tr('Floor')}>{r.floor==null?'—':r.floor===0?tr('Ground'):r.floor}</td>
            <td data-label={tr('Type')}>{r.room_type}</td>
            <td data-label={tr('Status')}><StatusBadge kind="room" value={r.operational_status}/></td>
            <td className="actions"><label className="visually-hidden" htmlFor={`status-${r.id}`}>{tr('Status for room {number}',{number:r.room_number})}</label>
              <select id={`status-${r.id}`} className="select" style={{width:'auto',minHeight:36}} value={r.operational_status} disabled={busy===r.id} onChange={e=>void setRoomStatus(r,e.target.value)}>{roomStatuses.map(s=><option key={s.value} value={s.value}>{tr(s.label)}</option>)}</select></td>
          </tr>)}</tbody></table></div>
          :<EmptyState icon="bed" headingLevel={3} title={tr('No rooms yet')}>{types.length?tr('Add the physical rooms guests can book below.'):tr('Add a room type first, then create rooms of that type.')}</EmptyState>}
        <section className="card" aria-labelledby="add-room-title"><form className="card-body form" onSubmit={e=>{e.preventDefault();const f=e.currentTarget;const d=Object.fromEntries(new FormData(f));void post('room',`/manager/hotels/${hotelId}/rooms`,{roomTypeId:d.roomTypeId,roomNumber:d.roomNumber,floor:d.floor===''?null:Number(d.floor)},tr('Room {number} added.',{number:String(d.roomNumber)}),f);}}>
          <h2 id="add-room-title" style={{fontSize:'var(--text-lg)'}}>{tr('Add a room')}</h2>
          {!types.length&&<Alert tone="info">{tr('You need a room type before adding rooms.')} <button type="button" className="link-button" onClick={()=>setSection('types')}>{tr('Add a room type')}</button></Alert>}
          <div className="form-row">
            <div className="form-field"><label htmlFor="roomTypeId">{tr('Room type')}</label><select id="roomTypeId" name="roomTypeId" className="select" required disabled={!types.length}>{types.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
            <div className="form-field"><label htmlFor="roomNumber">{tr('Room number')}</label><input id="roomNumber" name="roomNumber" className="input" required maxLength={40} placeholder={tr('e.g. {example}',{example:'204'})}/></div>
          </div>
          <div className="form-field" style={{maxWidth:240}}><label htmlFor="floor">{tr('Floor')} <span className="optional">({tr('optional')})</span></label><input id="floor" name="floor" className="input" type="number" min={-5} max={200} placeholder={tr('e.g. {example}',{example:'2'})} aria-describedby="floor-hint"/><p id="floor-hint" className="hint">{tr('Use 0 for the ground floor. Leave empty for villas and bungalows. Guests see it with their room number.')}</p></div>
          <div><button className="btn btn-primary" disabled={busy==='room'||!types.length}><Icon name="plus" size={18}/>{busy==='room'?tr('Adding…'):tr('Add room')}</button></div>
        </form></section>
      </>}

      {section==='types'&&<>
        {types.length?<div className="table-wrap"><table className="table table-stack">
          <caption className="visually-hidden">{tr('Room types')}</caption>
          <thead><tr><th scope="col">{tr('Room type')}</th><th scope="col">{tr('Sleeps')}</th><th scope="col" className="text-right">{tr('Base nightly rate')}</th><th scope="col">{tr('Rooms')}</th><th scope="col">{tr('Photos')}</th></tr></thead>
          <tbody>{types.map(t=><tr key={t.id}>
            <td className="primary-cell" data-label={tr('Room type')}><span className="strong">{t.name}</span>{t.description&&<span className="muted small" style={{display:'block'}}>{t.description}</span>}</td>
            <td data-label={tr('Sleeps')}>{t.capacity}</td>
            <td className="text-right num" data-label={tr('Base rate')}>{formatMoney(t.base_price,t.currency)}</td>
            <td data-label={tr('Rooms')}>{rooms.filter(r=>r.room_type===t.name).length}</td>
            <td data-label={tr('Photos')}>{t.photo_count?t.photo_count:<button type="button" className="link-button small" onClick={()=>setSection('photos')}>{tr('Add photos')}</button>}</td>
          </tr>)}</tbody></table></div>:!inventoryLoading&&<EmptyState icon="bed" headingLevel={3} title={tr('No room types yet')}>{tr('Room types describe what guests book, like “Garden King”, with a capacity and base nightly rate.')}</EmptyState>}
        <div className="grid grid-2">
          <section className="card" aria-labelledby="add-type-title"><form className="card-body form" onSubmit={e=>{e.preventDefault();const f=e.currentTarget;const d=Object.fromEntries(new FormData(f));void post('type',`/manager/hotels/${hotelId}/room-types`,{...d,capacity:Number(d.capacity),currency:String(d.currency).toUpperCase()},tr('Room type “{name}” added.',{name:String(d.name)}),f);}}>
            <h2 id="add-type-title" style={{fontSize:'var(--text-lg)'}}>{tr('Add a room type')}</h2>
            <div className="form-field"><label htmlFor="t-name">{tr('Name')}</label><input id="t-name" name="name" className="input" required maxLength={160} placeholder={tr('e.g. {example}',{example:'Deluxe Garden King'})}/></div>
            <div className="form-field"><label htmlFor="t-desc">{tr('Description')} <span className="optional">({tr('optional')})</span></label><input id="t-desc" name="description" className="input" maxLength={4000} placeholder={tr('King bed with a garden view')}/></div>
            <div className="form-row-3">
              <div className="form-field"><label htmlFor="t-cap">{tr('Sleeps')}</label><input id="t-cap" name="capacity" className="input" type="number" min={1} max={20} defaultValue={2} required/></div>
              <div className="form-field"><label htmlFor="t-price">{tr('Base rate')}</label><input id="t-price" name="basePrice" className="input" type="number" min={0} step="0.01" required inputMode="decimal"/></div>
              <div className="form-field"><label htmlFor="t-cur">{tr('Currency')}</label><input id="t-cur" name="currency" className="input" defaultValue={currency??'USD'} pattern="[A-Za-z]{3}" maxLength={3} required style={{textTransform:'uppercase'}} aria-describedby="cur-hint"/></div>
            </div>
            <p id="cur-hint" className="hint">{tr('Most Cambodian hotels price in USD. KHR also works. Use the same currency for every room type.')}</p>
            <div><button className="btn btn-primary" disabled={busy==='type'}><Icon name="plus" size={18}/>{busy==='type'?tr('Adding…'):tr('Add room type')}</button></div>
          </form></section>

          <section className="card" aria-labelledby="add-rate-title"><form className="card-body form" onSubmit={e=>{e.preventDefault();const f=e.currentTarget;const d=Object.fromEntries(new FormData(f)) as Record<string,string>;const type=types.find(t=>t.id===d.roomTypeId);if(!type)return;if(d.endsOn<=d.startsOn){notify({tone:'error',text:tr('The rate end date must be after its start date.')});return;}
              void post('rate',`/manager/hotels/${hotelId}/room-types/${type.id}/pricing-rules`,{startsOn:d.startsOn,endsOn:d.endsOn,nightlyPrice:d.nightlyPrice,currency:type.currency.trim(),priority:Number(d.priority)},tr('Seasonal rate added for {name}.',{name:type.name}),f);}}>
            <h2 id="add-rate-title" style={{fontSize:'var(--text-lg)'}}>{tr('Add a seasonal rate')}</h2>
            <p className="hint">{tr('Overrides the base rate for nights in this range. Existing bookings keep the price they were booked at.')}</p>
            <div className="form-field"><label htmlFor="p-type">{tr('Room type')}</label><select id="p-type" name="roomTypeId" className="select" required disabled={!types.length}>{types.map(t=><option key={t.id} value={t.id}>{t.name} ({t.currency.trim()})</option>)}</select></div>
            <div className="form-row">
              <div className="form-field"><label htmlFor="p-start">{tr('First night')}</label><input id="p-start" name="startsOn" className="input" type="date" min={isoDate()} required/></div>
              <div className="form-field"><label htmlFor="p-end">{tr('Ends before')}</label><input id="p-end" name="endsOn" className="input" type="date" min={isoDate(1)} required/></div>
            </div>
            <div className="form-row">
              <div className="form-field"><label htmlFor="p-price">{tr('Nightly rate')}</label><input id="p-price" name="nightlyPrice" className="input" type="number" min={0} step="0.01" required inputMode="decimal"/></div>
              <div className="form-field"><label htmlFor="p-pri">{tr('Priority')}</label><input id="p-pri" name="priority" className="input" type="number" min={0} max={1000} defaultValue={0} required aria-describedby="pri-hint"/></div>
            </div>
            <p id="pri-hint" className="hint">{tr('When rates overlap, the higher priority wins, e.g. a Khmer New Year rate inside a high-season rate.')}</p>
            <div><button className="btn btn-primary" disabled={busy==='rate'||!types.length}>{busy==='rate'?tr('Saving…'):tr('Add rate')}</button></div>
          </form></section>
        </div>
      </>}

      {section==='policy'&&<section className="card" aria-labelledby="policy-title"><form className="card-body form" style={{maxWidth:640}} onSubmit={e=>{e.preventDefault();const f=e.currentTarget;const d=Object.fromEntries(new FormData(f));void post('policy',`/manager/hotels/${hotelId}/cancellation-policies`,{name:d.name,freeCancelHours:Number(d.freeCancelHours),refundPercent:Number(d.refundPercent)},tr('Cancellation policy saved. It applies to new bookings.'));}}>
        <h2 id="policy-title" style={{fontSize:'var(--text-lg)'}}>{tr('Cancellation policy')}</h2>
        <p className="muted small">{tr('Saving replaces your current policy for new bookings. Existing reservations keep the policy they were booked under.')}</p>
        <div className="form-field"><label htmlFor="c-name">{tr('Policy name')}</label><input id="c-name" name="name" className="input" required maxLength={160} defaultValue={tr('Flexible')}/></div>
        <div className="form-row">
          <div className="form-field"><label htmlFor="c-hours">{tr('Free cancellation up to (hours before check-in)')}</label><input id="c-hours" name="freeCancelHours" className="input" type="number" min={0} max={8760} value={policyPreview.hours} onChange={e=>setPolicyPreview(p=>({...p,hours:Number(e.target.value)}))} required/></div>
          <div className="form-field"><label htmlFor="c-pct">{tr('Refund for later cancellations (%)')}</label><input id="c-pct" name="refundPercent" className="input" type="number" min={0} max={100} step="0.01" value={policyPreview.percent} onChange={e=>setPolicyPreview(p=>({...p,percent:Number(e.target.value)}))} required/></div>
        </div>
        <Alert tone="info" title={tr('What guests will see')}>{policyPreview.hours>0?tr('Cancel at least {hours} before check-in for a full refund. After that, guests get {percent}% back.',{hours:pluralize(policyPreview.hours,'hour'),percent:policyPreview.percent}):tr('Guests get {percent}% back whenever they cancel.',{percent:policyPreview.percent})}</Alert>
        <div><button className="btn btn-primary" disabled={busy==='policy'}>{busy==='policy'?tr('Saving…'):tr('Save policy')}</button></div>
      </form></section>}

      {section==='location'&&<section className="card" aria-labelledby="loc-title"><div className="card-body form">
        <div><h2 id="loc-title" style={{fontSize:'var(--text-lg)'}}>{tr('Map location')}</h2><p className="muted small" style={{marginTop:4}}>{tr('Guests see a map and directions on your hotel page. In Google Maps, right-click your hotel’s entrance and click the coordinates to copy them, then paste them below.')}</p></div>
        <div className="form-field"><label htmlFor="loc-paste">{tr('Paste coordinates')}</label>
          <input id="loc-paste" className="input" placeholder={tr('e.g. {example}',{example:'13.362100, 103.860400'})} aria-describedby="loc-paste-hint"
            onChange={e=>{const c=parseCoordinates(e.target.value);if(c){setPin({lat:String(c.lat),lng:String(c.lng)});setPinError('');}}}/>
          <p id="loc-paste-hint" className="hint">{tr('Fills in latitude and longitude below.')}</p></div>
        <div className="form-row">
          <div className="form-field"><label htmlFor="loc-lat">{tr('Latitude')}</label><input id="loc-lat" className="input" inputMode="decimal" value={pin.lat} onChange={e=>setPin(p=>({...p,lat:e.target.value}))} placeholder={tr('{min} to {max}',{min:CAMBODIA_BOUNDS.minLat,max:CAMBODIA_BOUNDS.maxLat})} aria-invalid={Boolean(pinError)} aria-describedby={pinError?'loc-error':undefined}/></div>
          <div className="form-field"><label htmlFor="loc-lng">{tr('Longitude')}</label><input id="loc-lng" className="input" inputMode="decimal" value={pin.lng} onChange={e=>setPin(p=>({...p,lng:e.target.value}))} placeholder={tr('{min} to {max}',{min:CAMBODIA_BOUNDS.minLng,max:CAMBODIA_BOUNDS.maxLng})} aria-invalid={Boolean(pinError)} aria-describedby={pinError?'loc-error':undefined}/></div>
        </div>
        {pinError&&<p id="loc-error" className="field-error" role="alert">{pinError}</p>}
        <div className="cluster">
          <button type="button" className="btn btn-primary" disabled={busy==='location'} onClick={()=>void saveLocation()}>{busy==='location'?tr('Saving…'):tr('Save location')}</button>
          <button type="button" className="btn btn-secondary" disabled={busy==='locate'} onClick={useCurrentLocation}><Icon name="pin" size={18}/>{busy==='locate'?tr('Locating…'):tr('Use my current location')}</button>
          {hotel?.latitude!=null&&<button type="button" className="btn btn-ghost" disabled={busy==='location'} onClick={()=>void saveLocation(true)}>{tr('Remove pin')}</button>}
        </div>
        {(()=>{const lat=Number(pin.lat),lng=Number(pin.lng);return pin.lat&&pin.lng&&insideCambodia(lat,lng)
          ?<div className="stack-sm"><p className="small strong">{tr('Preview')}</p><HotelMap name={hotel?.name??tr('Your hotel')} address={hotel?.address??''} city={hotel?.city??''} latitude={lat} longitude={lng}/></div>:null;})()}
      </div></section>}

      {section==='promotions'&&hotel&&<Promotions key={hotel.id} base={`/manager/hotels/${hotel.id}/promotions`} currency={types[0]?.currency??'USD'} notify={notify}/>}

      {section==='photos'&&<div className="grid grid-2" style={{alignItems:'start'}}>
      <section className="card" aria-labelledby="room-photo-title"><form className="card-body form" onSubmit={e=>void uploadRoomPhoto(e)}>
        <h2 id="room-photo-title" style={{fontSize:'var(--text-lg)'}}>{tr('Room photos')}</h2>
        <p className="muted small">{tr('Guests open these from each room on your hotel page. Add the room, bathroom, the view and the outside of the building.')}</p>
        {!types.length&&<Alert tone="info">{tr('Add a room type first.')} <button type="button" className="link-button" onClick={()=>setSection('types')}>{tr('Add a room type')}</button></Alert>}
        <div className="form-row">
          <div className="form-field"><label htmlFor="rp-type">{tr('Room type')}</label><select id="rp-type" name="roomTypeId" className="select" required disabled={!types.length}>{types.map(t=><option key={t.id} value={t.id}>{t.name}{t.photo_count?` (${t.photo_count})`:''}</option>)}</select></div>
          <div className="form-field"><label htmlFor="rp-cat">{tr('Shows')}</label><select id="rp-cat" name="category" className="select" required><option value="ROOM">{tr('The room')}</option><option value="BATHROOM">{tr('Bathroom')}</option><option value="VIEW">{tr('View from the room')}</option><option value="EXTERIOR">{tr('Outside of the building')}</option></select></div>
        </div>
        <div className="form-field"><label htmlFor="rp-file">{tr('Photo')}</label>
          <input id="rp-file" type="file" name="file" accept="image/png,image/jpeg,image/webp" required className="input" aria-invalid={Boolean(roomPhoto?.error)}
            onChange={e=>{const file=e.target.files?.[0];if(roomPhoto?.url)URL.revokeObjectURL(roomPhoto.url);setRoomPhoto(file?{url:URL.createObjectURL(file),error:''}:null);}}/>
          {roomPhoto?.error&&<p className="field-error" role="alert">{roomPhoto.error}</p>}
        </div>
        {roomPhoto?.url&&<img src={roomPhoto.url} alt={tr('Preview of the selected room photo')} style={{maxHeight:200,borderRadius:'var(--radius-md)',objectFit:'cover'}}/>}
        <div className="form-field"><label htmlFor="rp-alt">{tr('Photo description')}</label><input id="rp-alt" name="altText" className="input" maxLength={250} placeholder={tr('e.g. {example}',{example:tr('King bed with garden view')})}/></div>
        <div><button className="btn btn-primary" disabled={busy==='roomPhoto'||!types.length}><Icon name="image" size={18}/>{busy==='roomPhoto'?tr('Uploading…'):tr('Upload room photo')}</button></div>
      </form></section>
      <section className="card" aria-labelledby="photo-title"><form className="card-body form" onSubmit={e=>void uploadPhoto(e)}>
        <h2 id="photo-title" style={{fontSize:'var(--text-lg)'}}>{tr('Hotel photos')}</h2>
        <p className="muted small">{tr('The first photo you upload becomes the cover image in search results.')}</p>
        <div className="form-field"><label htmlFor="ph-file">{tr('Photo')}</label>
          <input id="ph-file" type="file" name="file" accept="image/png,image/jpeg,image/webp" required className="input" aria-describedby="ph-hint" aria-invalid={Boolean(photo?.error)}
            onChange={e=>{const file=e.target.files?.[0];if(photo?.url)URL.revokeObjectURL(photo.url);setPhoto(file?{url:URL.createObjectURL(file),error:''}:null);}}/>
          <p id="ph-hint" className="hint">{tr('PNG, JPEG or WebP, up to 10 MB. Landscape photos look best.')}</p>
          {photo?.error&&<p className="field-error" role="alert">{photo.error}</p>}
        </div>
        {photo?.url&&<img src={photo.url} alt={tr('Preview of the selected photo')} style={{maxHeight:240,borderRadius:'var(--radius-md)',objectFit:'cover'}}/>}
        <div className="form-field"><label htmlFor="ph-alt">{tr('Photo description')}</label><input id="ph-alt" name="altText" className="input" maxLength={250} placeholder={tr('e.g. {example}',{example:tr('Pool terrace at sunset')})} aria-describedby="alt-hint"/><p id="alt-hint" className="hint">{tr('Describes the photo for guests using screen readers.')}</p></div>
        <div><button className="btn btn-primary" disabled={busy==='photo'}><Icon name="image" size={18}/>{busy==='photo'?tr('Uploading…'):tr('Upload photo')}</button></div>
      </form></section>
      </div>}
    </div>
  </div>;
}
