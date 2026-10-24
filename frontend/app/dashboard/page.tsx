'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, EmptyState, Loading, PageHeader, type Notice } from '../../components/ui';
import AdminConsole from '../../components/workspace/AdminConsole';
import ManagerWorkspace from '../../components/workspace/ManagerWorkspace';
import ReceptionDesk from '../../components/workspace/ReceptionDesk';
import { api, errorMessage } from '../../lib/api';
import { requireSession, setProfile } from '../../lib/session';
import { useT } from '../../lib/i18n';
import { translate } from '../../lib/lang';

type User={id:string;email:string;fullName?:string;roles:string[]};
type Workspace='SYSTEM_ADMIN'|'HOTEL_MANAGER'|'RECEPTIONIST';
type Toast=NonNullable<Notice>&{id:number};

const workspaces:{role:Workspace;label:string;title:string;description:string}[]=[
  {role:'RECEPTIONIST',label:'Reception',title:'Reception desk',description:'Check guests in and out for the selected day.'},
  {role:'HOTEL_MANAGER',label:'Hotel management',title:'Hotel management',description:'Manage rooms, rates, policies and photos, and track performance.'},
  {role:'SYSTEM_ADMIN',label:'Administration',title:'Administration',description:'Approve hotels, manage accounts and assign hotel staff.'},
];

export default function DashboardPage(){
  const t=useT();
  const [user,setUser]=useState<User|null>(null);
  const [error,setError]=useState('');
  const [active,setActive]=useState<Workspace|null>(null);
  const [toasts,setToasts]=useState<Toast[]>([]);
  const nextId=useRef(0);

  const dismiss=useCallback((id:number)=>setToasts(t=>t.filter(x=>x.id!==id)),[]);
  const notify=useCallback((notice:NonNullable<Notice>)=>{
    const id=++nextId.current;
    setToasts(t=>[...t.slice(-2),{...notice,id}]);
    if(notice.tone!=='error')setTimeout(()=>dismiss(id),6000);
  },[dismiss]);

  useEffect(()=>{
    if(!requireSession())return;
    api<User>('/auth/me').then(profile=>{
      setUser(profile);setProfile(profile);
      const available=workspaces.filter(w=>profile.roles.includes(w.role));
      const requested=new URLSearchParams(window.location.search).get('view');
      setActive((available.find(w=>w.role===requested)??available.find(w=>w.role==='HOTEL_MANAGER')??available[0])?.role??null);
      if(new URLSearchParams(window.location.search).get('registered'))notify({tone:'success',text:translate('Your hotel was submitted for review. You can start adding rooms and rates now.')});
    }).catch(e=>setError(errorMessage(e,'Your workspace could not be loaded.')));
  },[notify]);

  function choose(role:Workspace){setActive(role);window.history.replaceState(null,'',`?view=${role}`);}

  if(error)return <main id="main" className="page"><div className="container"><Alert tone="error" title={t('Workspace unavailable')}>{error}</Alert></div></main>;
  if(!user)return <main id="main" className="page"><div className="container"><Loading label={t('Loading your workspace…')}/></div></main>;

  const available=workspaces.filter(w=>user.roles.includes(w.role));
  const current=available.find(w=>w.role===active);

  return <main id="main" className="page">
    <div className="container">
      <PageHeader eyebrow={t('Signed in as {name}',{name:user.fullName||user.email})} title={current?t(current.title):t('Your workspace')} description={current?t(current.description):undefined}
        actions={available.length>1?<div className="segmented" role="group" aria-label={t('Switch workspace')}>{available.map(w=><button key={w.role} type="button" aria-pressed={active===w.role} onClick={()=>choose(w.role)}>{t(w.label)}</button>)}</div>:undefined}/>

      {!current&&<EmptyState icon="building" title={t('No staff workspace yet')} action={<div className="cluster" style={{justifyContent:'center'}}><a className="btn btn-primary" href="/list-hotel">{t('List your hotel')}</a><a className="btn btn-secondary" href="/account/bookings">{t('My trips')}</a></div>}>
        {t('Your account is a guest account. List a hotel to get a manager workspace, or ask an administrator to add you to a hotel team.')}
      </EmptyState>}
      {current?.role==='SYSTEM_ADMIN'&&<AdminConsole notify={notify} currentUserId={user.id}/>}
      {current?.role==='HOTEL_MANAGER'&&<ManagerWorkspace notify={notify}/>}
      {current?.role==='RECEPTIONIST'&&<ReceptionDesk notify={notify}/>}
    </div>

    <div className="toast-region" aria-live="polite" aria-relevant="additions">
      {toasts.map(t=><Alert key={t.id} tone={t.tone} onDismiss={()=>dismiss(t.id)}>{t.text}</Alert>)}
    </div>
  </main>;
}
