'use client';
import { FormEvent, useEffect, useState } from 'react';
import Icon from '../../components/Icon';
import { Alert, Spinner } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { isStaff, safeReturnTo, setProfile, setToken } from '../../lib/session';
import { useT } from '../../lib/i18n';

const notices:Record<string,string>={
  'password-changed':'Your password was changed and all sessions were signed out. Sign in with your new password.',
  'session-expired':'Your session ended for security. Sign in again to pick up where you left off.',
};

export default function SignInPage(){
  const t=useT();
  const [mode,setMode]=useState<'signin'|'register'>('signin');
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [showPassword,setShowPassword]=useState(false);
  const [returning,setReturning]=useState(false);
  const register=mode==='register';

  useEffect(()=>{
    const q=new URLSearchParams(window.location.search);
    const key=q.get('message');if(key&&notices[key])setNotice(notices[key]);
    setReturning(Boolean(q.get('returnTo')));
    if(q.get('mode')==='register')setMode('register');
  },[]);

  function switchMode(next:'signin'|'register'){setMode(next);setError('');}

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError('');setNotice('');
    const form=new FormData(event.currentTarget);
    const body:Record<string,string>={email:String(form.get('email')).trim(),password:String(form.get('password'))};
    if(register)body.fullName=String(form.get('fullName')).trim();
    try{
      const session=await api<{accessToken:string}>(`/auth/${register?'register':'login'}`,{method:'POST',body,auth:false});
      setToken(session.accessToken);
      const profile=await api<{fullName?:string;email:string;roles:string[]}>('/auth/me').catch(()=>({email:body.email,roles:['GUEST']}));
      setProfile(profile);
      const returnTo=safeReturnTo(new URLSearchParams(window.location.search).get('returnTo'),window.location.origin);
      window.location.assign(returnTo||(isStaff(profile.roles)?'/dashboard':'/account/bookings'));
    }catch(e){setError(errorMessage(e,register?'We could not create your account.':'We could not sign you in.'));setBusy(false);}
  }

  return <main id="main" className="page">
    <div className="container container-tight stack-lg">
      <div className="card">
        <div className="card-body stack">
          <div className="segmented" role="group" aria-label={t('Account options')} style={{alignSelf:'flex-start'}}>
            <button type="button" aria-pressed={!register} onClick={()=>switchMode('signin')}>{t('Sign in')}</button>
            <button type="button" aria-pressed={register} onClick={()=>switchMode('register')}>{t('Create account')}</button>
          </div>
          <div>
            <h1>{register?t('Create your guest account'):t('Welcome back')}</h1>
            <p className="muted" style={{marginTop:6}}>{register?t('Book rooms, track payments and manage cancellations in one place.'):returning?t('Sign in to continue where you left off.'):t('Sign in to manage your trips or your hotel.')}</p>
          </div>
          {notice&&<Alert tone="info">{t(notice)}</Alert>}
          {error&&<Alert tone="error">{error}</Alert>}
          <form onSubmit={submit} className="form" aria-busy={busy}>
            {register&&<div className="form-field"><label htmlFor="fullName">{t('Full name')}</label><input id="fullName" name="fullName" className="input" required maxLength={200} autoComplete="name"/></div>}
            <div className="form-field"><label htmlFor="email">{t('Email')}</label><input id="email" name="email" className="input" type="email" required maxLength={320} autoComplete="email" inputMode="email"/></div>
            <div className="form-field">
              <label htmlFor="password">{t('Password')}</label>
              <div className="input-group">
                <input id="password" name="password" className="input" type={showPassword?'text':'password'} required minLength={12} maxLength={128} autoComplete={register?'new-password':'current-password'} aria-describedby="password-hint"/>
                <button type="button" className="btn btn-ghost btn-sm input-action" onClick={()=>setShowPassword(!showPassword)} aria-pressed={showPassword}>
                  <Icon name={showPassword?'eyeOff':'eye'} size={16}/>{showPassword?t('Hide'):t('Show')}
                </button>
              </div>
              <p id="password-hint" className="hint">{register?t('Use at least 12 characters. A short phrase is easy to remember.'):t('At least 12 characters.')}</p>
            </div>
            <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy?<><Spinner/>{register?t('Creating account…'):t('Signing in…')}</>:register?t('Create account'):t('Sign in')}</button>
          </form>
          <p className="small muted" style={{textAlign:'center'}}>{register?t('Already have an account?'):t('New to StayEase?')} <button type="button" className="link-button" onClick={()=>switchMode(register?'signin':'register')}>{register?t('Sign in'):t('Create a guest account')}</button></p>
        </div>
      </div>
      <p className="small muted cluster" style={{justifyContent:'center',gap:6}}><Icon name="shield" size={16}/>{t('Hotel staff accounts are set up by an administrator.')}</p>
    </div>
  </main>;
}
