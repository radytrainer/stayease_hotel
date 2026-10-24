'use client';
import { FormEvent, useEffect, useState } from 'react';
import { Alert, Badge, Loading, NoticeBanner, PageHeader, Spinner, type Notice } from '../../../components/ui';
import { api, errorMessage } from '../../../lib/api';
import { roleLabel } from '../../../lib/format';
import { clearToken, requireSession, setProfile } from '../../../lib/session';
import { useT } from '../../../lib/i18n';

type Profile={id:string;email:string;fullName:string;phone?:string;roles:string[]};

export default function ProfilePage(){
  const t=useT();
  const [profile,setProfileState]=useState<Profile|null>(null);
  const [loadError,setLoadError]=useState('');
  const [detailsNotice,setDetailsNotice]=useState<Notice>(null);
  const [passwordNotice,setPasswordNotice]=useState<Notice>(null);
  const [mismatch,setMismatch]=useState(false);
  const [saving,setSaving]=useState<'details'|'password'|''>('');

  useEffect(()=>{
    if(!requireSession())return;
    api<Profile>('/auth/me').then(p=>{setProfileState(p);setProfile(p);}).catch(e=>setLoadError(errorMessage(e,'Your profile could not be loaded.')));
  },[]);

  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const form=new FormData(event.currentTarget);
    setSaving('details');setDetailsNotice(null);
    try{
      const saved=await api<Profile>('/auth/me',{method:'PATCH',body:{fullName:String(form.get('fullName')).trim(),phone:String(form.get('phone')||'').trim()}});
      setProfileState(saved);setProfile(saved);
      setDetailsNotice({tone:'success',text:t('Your details were saved.')});
    }catch(e){setDetailsNotice({tone:'error',text:errorMessage(e,'Your details could not be saved.')});}
    finally{setSaving('');}
  }

  async function changePassword(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const values=new FormData(event.currentTarget);
    if(values.get('newPassword')!==values.get('confirmPassword')){setMismatch(true);return;}
    setSaving('password');setPasswordNotice(null);
    try{
      await api('/auth/password',{method:'PUT',body:{currentPassword:String(values.get('currentPassword')),newPassword:String(values.get('newPassword'))}});
      clearToken();window.location.assign('/signin?message=password-changed');
    }catch(e){setPasswordNotice({tone:'error',text:errorMessage(e,'Your password could not be changed.')});setSaving('');}
  }

  return <main id="main" className="page">
    <div className="container container-narrow">
      <PageHeader eyebrow={t('Your account')} title={t('Profile')} description={t('Hotels use these details to contact you about your reservations.')}/>
      {loadError&&<Alert tone="error">{loadError}</Alert>}
      {!profile&&!loadError&&<Loading label={t('Loading your profile…')}/>}
      {profile&&<div className="stack-lg">
        <section className="card" aria-labelledby="details-title">
          <div className="card-header cluster-between"><h2 id="details-title" style={{fontSize:'var(--text-lg)'}}>{t('Personal details')}</h2><div className="cluster" style={{gap:6}}>{profile.roles.map(r=><Badge key={r} tone="primary" plain>{roleLabel(r)}</Badge>)}</div></div>
          <form onSubmit={save} className="card-body form" aria-busy={saving==='details'}>
            <NoticeBanner notice={detailsNotice} onDismiss={()=>setDetailsNotice(null)}/>
            <div className="form-field"><label htmlFor="email">{t('Email')}</label><input id="email" className="input" value={profile.email} readOnly aria-describedby="email-hint"/><p id="email-hint" className="hint">{t('Your sign-in email can’t be changed here. Contact support if you need to update it.')}</p></div>
            <div className="form-row">
              <div className="form-field"><label htmlFor="fullName">{t('Full name')}</label><input id="fullName" name="fullName" className="input" defaultValue={profile.fullName} autoComplete="name" required maxLength={200}/></div>
              <div className="form-field"><label htmlFor="phone">{t('Phone')} <span className="optional">({t('optional')})</span></label><input id="phone" name="phone" className="input" defaultValue={profile.phone||''} type="tel" autoComplete="tel" maxLength={40} placeholder="+855 12 345 678"/></div>
            </div>
            <div><button className="btn btn-primary" disabled={Boolean(saving)}>{saving==='details'?<><Spinner/>{t('Saving…')}</>:t('Save details')}</button></div>
          </form>
        </section>

        <section className="card" aria-labelledby="password-title">
          <div className="card-header"><h2 id="password-title" style={{fontSize:'var(--text-lg)'}}>{t('Password')}</h2><p className="hint" style={{marginTop:4}}>{t('Changing your password signs you out on every device.')}</p></div>
          <form onSubmit={changePassword} className="card-body form" aria-busy={saving==='password'}>
            <NoticeBanner notice={passwordNotice} onDismiss={()=>setPasswordNotice(null)}/>
            <div className="form-field"><label htmlFor="currentPassword">{t('Current password')}</label><input id="currentPassword" name="currentPassword" className="input" type="password" autoComplete="current-password" required maxLength={128}/></div>
            <div className="form-row">
              <div className="form-field"><label htmlFor="newPassword">{t('New password')}</label><input id="newPassword" name="newPassword" className="input" type="password" autoComplete="new-password" required minLength={12} maxLength={128} aria-describedby="new-hint" onChange={()=>setMismatch(false)}/><p id="new-hint" className="hint">{t('At least 12 characters, different from your current one.')}</p></div>
              <div className="form-field"><label htmlFor="confirmPassword">{t('Confirm new password')}</label><input id="confirmPassword" name="confirmPassword" className="input" type="password" autoComplete="new-password" required minLength={12} maxLength={128} aria-invalid={mismatch} aria-describedby={mismatch?'confirm-error':undefined} onChange={()=>setMismatch(false)}/>{mismatch&&<p id="confirm-error" className="field-error" role="alert">{t('The passwords don’t match.')}</p>}</div>
            </div>
            <div><button className="btn btn-secondary" disabled={Boolean(saving)}>{saving==='password'?<><Spinner/>{t('Updating…')}</>:t('Change password')}</button></div>
          </form>
        </section>
      </div>}
    </div>
  </main>;
}
