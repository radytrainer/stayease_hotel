'use client';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, EmptyState, Loading, StatusBadge, onTabListKeyDown } from '../ui';
import { useConfirm } from '../useConfirm';
import { api, errorMessage } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { placeName } from '../../lib/cambodia';
import { useT } from '../../lib/i18n';
import type { Notify } from './types';
import Promotions from './Promotions';

type Hotel={id:string;name:string;slug:string;city:string;country:string;status:string;created_at:string};
type User={id:string;email:string;full_name:string|null;enabled:boolean;created_at:string};
type Section='approvals'|'hotels'|'users'|'staff'|'promotions';

export default function AdminConsole({notify,currentUserId}:{notify:Notify;currentUserId:string}){
  const t=useT();
  const [section,setSection]=useState<Section>('approvals');
  const [hotels,setHotels]=useState<Hotel[]|null>(null);
  const [users,setUsers]=useState<User[]|null>(null);
  const [loadError,setLoadError]=useState('');
  const [busy,setBusy]=useState('');
  const [userQuery,setUserQuery]=useState('');
  const [staff,setStaff]=useState({hotelId:'',userId:'',role:'RECEPTIONIST'});
  const [confirm,dialog]=useConfirm();

  const load=useCallback(async()=>{
    setLoadError('');
    try{
      const [groups,people]=await Promise.all([Promise.all(['PENDING_APPROVAL','APPROVED','SUSPENDED'].map(s=>api<Hotel[]>(`/admin/hotels?status=${s}`))),api<User[]>('/admin/users?limit=200')]);
      setHotels(groups.flat());setUsers(people);
    }catch(e){setLoadError(errorMessage(e,'Administration data could not be loaded.'));}
  },[]);
  useEffect(()=>{void load();},[load]);

  const pending=useMemo(()=>(hotels??[]).filter(h=>h.status==='PENDING_APPROVAL'),[hotels]);
  const listed=useMemo(()=>(hotels??[]).filter(h=>h.status!=='PENDING_APPROVAL').sort((a,b)=>a.name.localeCompare(b.name)),[hotels]);
  const filteredUsers=useMemo(()=>{const q=userQuery.trim().toLowerCase();return (users??[]).filter(u=>!q||u.email.toLowerCase().includes(q)||(u.full_name??'').toLowerCase().includes(q));},[users,userQuery]);

  async function setHotelStatus(hotel:Hotel,status:'APPROVED'|'SUSPENDED'){
    const verb=status==='SUSPENDED'?'Suspend':hotel.status==='SUSPENDED'?'Reinstate':'Approve';
    if(!await confirm({title:t(`${verb} {name}?`,{name:hotel.name}),danger:status==='SUSPENDED',confirmLabel:t(`${verb} hotel`),
      body:status==='SUSPENDED'?t('The hotel disappears from search and can’t take new bookings. Existing reservations are kept.'):t('The hotel becomes visible to guests and can take bookings.')}))return;
    setBusy(hotel.id);
    try{await api(`/admin/hotels/${hotel.id}/status`,{method:'PATCH',body:{status}});notify({tone:'success',text:status==='APPROVED'?t('{name} is now live.',{name:hotel.name}):t('{name} is now suspended.',{name:hotel.name})});await load();}
    catch(e){notify({tone:'error',text:errorMessage(e)});}
    finally{setBusy('');}
  }

  async function toggleUser(user:User){
    const disabling=user.enabled;
    const name=user.full_name||user.email;
    if(!await confirm({title:disabling?t('Disable {name}?',{name}):t('Enable {name}?',{name}),danger:disabling,confirmLabel:disabling?t('Disable account'):t('Enable account'),
      body:disabling?t('They are signed out everywhere and can’t sign in until the account is enabled again.'):t('They will be able to sign in again.')}))return;
    setBusy(user.id);
    try{await api(`/admin/users/${user.id}/enabled?enabled=${!disabling}`,{method:'PATCH'});setUsers(us=>us?.map(u=>u.id===user.id?{...u,enabled:!disabling}:u)??null);notify({tone:'success',text:disabling?t('Account disabled.'):t('Account enabled.')});}
    catch(e){notify({tone:'error',text:errorMessage(e)});}
    finally{setBusy('');}
  }

  async function assign(e:FormEvent){
    e.preventDefault();setBusy('staff');
    try{
      await api(`/admin/hotels/${staff.hotelId}/staff`,{method:'POST',body:{userId:staff.userId,role:staff.role}});
      const hotel=hotels?.find(h=>h.id===staff.hotelId),user=users?.find(u=>u.id===staff.userId);
      const vars={name:user?.full_name||user?.email||'',hotel:hotel?.name??''};
      notify({tone:'success',text:staff.role==='HOTEL_MANAGER'?t('{name} is now a manager at {hotel}.',vars):t('{name} is now a receptionist at {hotel}.',vars)});
      setStaff(s=>({...s,userId:''}));
    }catch(err){notify({tone:'error',text:errorMessage(err)});}
    finally{setBusy('');}
  }

  if(loadError)return <Alert tone="error" title={t('Administration unavailable')}>{loadError} <button type="button" className="link-button" onClick={()=>void load()}>{t('Try again')}</button></Alert>;
  if(!hotels||!users)return <Loading label={t('Loading administration…')}/>;

  const tabs:{id:Section;label:string;count?:number}[]=[{id:'approvals',label:'Hotel approvals',count:pending.length},{id:'hotels',label:'All hotels',count:listed.length},{id:'users',label:'Users',count:users.length},{id:'staff',label:'Staff assignments'},{id:'promotions',label:'Promotions'}];

  return <div className="stack">
    {dialog}
    <div className="tabs" role="tablist" onKeyDown={onTabListKeyDown} aria-label={t('Administration')}>
      {tabs.map(tab=><button key={tab.id} role="tab" id={`atab-${tab.id}`} aria-controls="apanel" aria-selected={section===tab.id} tabIndex={section===tab.id?0:-1} className="tab" onClick={()=>setSection(tab.id)}>{t(tab.label)}{tab.count!==undefined&&<span className="count">{tab.count}</span>}</button>)}
    </div>
    <div id="apanel" role="tabpanel" aria-labelledby={`atab-${section}`} className="stack">
      {section==='approvals'&&(pending.length?<div className="table-wrap"><table className="table table-stack">
        <caption className="visually-hidden">{t('Hotels waiting for approval, oldest first')}</caption>
        <thead><tr><th scope="col">{t('Hotel')}</th><th scope="col">{t('Location')}</th><th scope="col">{t('Submitted')}</th><th scope="col" className="actions"><span className="visually-hidden">{t('Actions')}</span></th></tr></thead>
        <tbody>{pending.map(h=><tr key={h.id}>
          <td className="primary-cell strong" data-label={t('Hotel')}>{h.name}</td>
          <td data-label={t('Location')}>{placeName(h.city)}, {t(h.country)}</td>
          <td data-label={t('Submitted')}>{formatDateTime(h.created_at)}</td>
          <td className="actions"><div className="cluster"><button type="button" className="btn btn-primary btn-sm" disabled={busy===h.id} onClick={()=>void setHotelStatus(h,'APPROVED')}>{t('Approve')}</button><button type="button" className="btn btn-danger-outline btn-sm" disabled={busy===h.id} onClick={()=>void setHotelStatus(h,'SUSPENDED')}>{t('Decline')}</button></div></td>
        </tr>)}</tbody></table></div>
        :<EmptyState icon="checkCircle" headingLevel={3} title={t('You’re all caught up')}>{t('No hotels are waiting for review.')}</EmptyState>)}

      {section==='hotels'&&(listed.length?<div className="table-wrap"><table className="table table-stack">
        <thead><tr><th scope="col">{t('Hotel')}</th><th scope="col">{t('Location')}</th><th scope="col">{t('Status')}</th><th scope="col" className="actions"><span className="visually-hidden">{t('Actions')}</span></th></tr></thead>
        <tbody>{listed.map(h=><tr key={h.id}>
          <td className="primary-cell" data-label={t('Hotel')}><span className="strong">{h.name}</span>{h.status==='APPROVED'&&<a className="small" style={{display:'block'}} href={`/hotels/${encodeURIComponent(h.slug)}`}>{t('View public page')}</a>}</td>
          <td data-label={t('Location')}>{placeName(h.city)}, {t(h.country)}</td>
          <td data-label={t('Status')}><StatusBadge kind="hotel" value={h.status}/></td>
          <td className="actions">{h.status==='APPROVED'?<button type="button" className="btn btn-danger-outline btn-sm" disabled={busy===h.id} onClick={()=>void setHotelStatus(h,'SUSPENDED')}>{t('Suspend')}</button>:<button type="button" className="btn btn-secondary btn-sm" disabled={busy===h.id} onClick={()=>void setHotelStatus(h,'APPROVED')}>{t('Reinstate')}</button>}</td>
        </tr>)}</tbody></table></div>
        :<EmptyState icon="building" headingLevel={3} title={t('No approved hotels yet')}>{t('Approved and suspended hotels appear here.')}</EmptyState>)}

      {section==='users'&&<>
        <div className="cluster-between">
          <p className="muted small">{t('Showing the {count} most recent accounts.',{count:users.length})}</p>
          <div className="form-field" style={{minWidth:'min(280px, 100%)'}}><label htmlFor="user-search" className="visually-hidden">{t('Search users')}</label><input id="user-search" type="search" className="input" placeholder={t('Search by name or email')} value={userQuery} onChange={e=>setUserQuery(e.target.value)}/></div>
        </div>
        {filteredUsers.length?<div className="table-wrap"><table className="table table-stack">
          <thead><tr><th scope="col">{t('Name')}</th><th scope="col">{t('Email')}</th><th scope="col">{t('Joined')}</th><th scope="col">{t('Status')}</th><th scope="col" className="actions"><span className="visually-hidden">{t('Actions')}</span></th></tr></thead>
          <tbody>{filteredUsers.map(u=><tr key={u.id}>
            <td className="primary-cell strong" data-label={t('Name')}>{u.full_name||'—'}{u.id===currentUserId&&<span className="muted small"> ({t('you')})</span>}</td>
            <td data-label={t('Email')}>{u.email}</td>
            <td data-label={t('Joined')}>{formatDateTime(u.created_at)}</td>
            <td data-label={t('Status')}>{u.enabled?<Badge tone="success">{t('Active')}</Badge>:<Badge tone="error">{t('Disabled')}</Badge>}</td>
            <td className="actions">{u.id!==currentUserId&&<button type="button" className={`btn btn-sm ${u.enabled?'btn-danger-outline':'btn-secondary'}`} disabled={busy===u.id} onClick={()=>void toggleUser(u)}>{u.enabled?t('Disable'):t('Enable')}</button>}</td>
          </tr>)}</tbody></table></div>
          :<EmptyState icon="users" headingLevel={3} title={t('No matching users')}>{t('Try a different name or email.')}</EmptyState>}
      </>}

      {section==='promotions'&&<Promotions base="/admin/promotions" currency="USD" notify={notify} platform/>}

      {section==='staff'&&<section className="card" aria-labelledby="staff-title"><form className="card-body form" style={{maxWidth:640}} onSubmit={e=>void assign(e)}>
        <h2 id="staff-title" style={{fontSize:'var(--text-lg)'}}>{t('Assign hotel staff')}</h2>
        <p className="muted small">{t('Managers control inventory, rates and reports. Receptionists handle check-in and check-out. Staff only see the hotels they’re assigned to.')}</p>
        <div className="form-field"><label htmlFor="s-hotel">{t('Hotel')}</label><select id="s-hotel" className="select" required value={staff.hotelId} onChange={e=>setStaff(s=>({...s,hotelId:e.target.value}))}><option value="">{t('Choose a hotel')}</option>{[...listed,...pending].map(h=><option key={h.id} value={h.id}>{h.name}{h.status==='PENDING_APPROVAL'?` (${t('awaiting approval')})`:h.status==='SUSPENDED'?` (${t('suspended')})`:''}</option>)}</select></div>
        <div className="form-field"><label htmlFor="s-user">{t('Person')}</label><select id="s-user" className="select" required value={staff.userId} onChange={e=>setStaff(s=>({...s,userId:e.target.value}))}><option value="">{t('Choose a user')}</option>{users.filter(u=>u.enabled).map(u=><option key={u.id} value={u.id}>{u.full_name?`${u.full_name} · ${u.email}`:u.email}</option>)}</select><p className="hint">{t('They need a StayEase account first. Disabled accounts aren’t listed.')}</p></div>
        <fieldset><legend className="form-label" style={{marginBottom:6}}>{t('Role')}</legend><div className="segmented" role="group">
          <button type="button" aria-pressed={staff.role==='RECEPTIONIST'} onClick={()=>setStaff(s=>({...s,role:'RECEPTIONIST'}))}>{t('Receptionist')}</button>
          <button type="button" aria-pressed={staff.role==='HOTEL_MANAGER'} onClick={()=>setStaff(s=>({...s,role:'HOTEL_MANAGER'}))}>{t('Hotel manager')}</button>
        </div></fieldset>
        <div><button className="btn btn-primary" disabled={busy==='staff'||!staff.hotelId||!staff.userId}>{busy==='staff'?t('Assigning…'):t('Assign role')}</button></div>
      </form></section>}
    </div>
  </div>;
}
