'use client';
import { FormEvent, useEffect, useState } from 'react';
import Icon from '../../components/Icon';
import { Alert, GuestOnlyNotice, PageHeader, Spinner } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { canBook, getRoles, getToken, signInUrl } from '../../lib/session';
import { COUNTRY, OTHER_PROVINCES, POPULAR_DESTINATIONS, TIMEZONE, placeLabel } from '../../lib/cambodia';
import { useT } from '../../lib/i18n';
import { insideCambodia, parseCoordinates } from '../../lib/location';


export default function ListHotelPage(){
  const t=useT();
  const [signedIn,setSignedIn]=useState<boolean|null>(null);
  const [guestOnly,setGuestOnly]=useState(false);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [coords,setCoords]=useState('');
  const pin=coords.trim()?parseCoordinates(coords):null;
  const pinError=coords.trim()&&(!pin||!insideCambodia(pin.lat,pin.lng))?t('Paste coordinates inside Cambodia, like 13.362100, 103.860400.'):'';

  useEffect(()=>{
    setSignedIn(Boolean(getToken()));
    setGuestOnly(Boolean(getToken())&&!canBook(getRoles()));
  },[]);

  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(pinError)return;setBusy(true);setError('');
    const data={...Object.fromEntries(new FormData(e.currentTarget).entries()),country:COUNTRY,timezone:TIMEZONE,...(pin?{latitude:Number(pin.lat.toFixed(6)),longitude:Number(pin.lng.toFixed(6))}:{})};
    delete (data as Record<string,unknown>).coords;
    try{await api('/hotels',{method:'POST',body:data});window.location.assign('/dashboard?registered=1');}
    catch(err){setError(errorMessage(err,'Your hotel could not be submitted.'));setBusy(false);}
  }

  if(guestOnly)return <main id="main" className="page"><div className="container container-narrow"><GuestOnlyNotice task={t('list a hotel')}/></div></main>;

  return <main id="main" className="page">
    <div className="container">
      <PageHeader eyebrow={t('For hotels')} title={t('List your hotel on StayEase')} description={t('StayEase lists hotels across Cambodia. Tell us about your property. Once an administrator approves it, you can add rooms, set rates and start taking bookings.')}/>
      <div className="layout-sidebar">
        <div className="card">
          {signedIn===false?<div className="card-body stack" style={{alignItems:'flex-start'}}>
            <h2>{t('Sign in to continue')}</h2>
            <p className="muted">{t('Your hotel is linked to your account, which becomes its manager account after approval.')}</p>
            <div className="cluster"><a className="btn btn-primary" href={signInUrl('/list-hotel')}>{t('Sign in')}</a><a className="btn btn-secondary" href={`/signin?mode=register&returnTo=${encodeURIComponent('/list-hotel')}`}>{t('Create an account')}</a></div>
          </div>
          :<form onSubmit={submit} className="card-body form" aria-busy={busy}>
            {error&&<Alert tone="error" title={t('Submission failed')}>{error}</Alert>}
            <fieldset className="form">
              <legend><h2 style={{fontSize:'var(--text-lg)'}}>{t('Property')}</h2></legend>
              <div className="form-field"><label htmlFor="name">{t('Hotel name')}</label><input id="name" name="name" className="input" required maxLength={200} autoComplete="organization"/></div>
              <div className="form-field"><label htmlFor="description">{t('Description')} <span className="optional">({t('optional')})</span></label><textarea id="description" name="description" className="textarea" rows={4} maxLength={10000} aria-describedby="description-hint"/><p id="description-hint" className="hint">{t('Guests see this on your hotel page. Mention what makes your stay special.')}</p></div>
            </fieldset>
            <hr className="divider" style={{margin:0}}/>
            <fieldset className="form">
              <legend><h2 style={{fontSize:'var(--text-lg)'}}>{t('Location')}</h2></legend>
              <div className="form-field"><label htmlFor="address">{t('Street address')}</label><input id="address" name="address" className="input" required maxLength={1000} autoComplete="street-address" placeholder={t('e.g. {example}',{example:'No. 18, Wat Bo Road, Sala Kamreuk'})}/></div>
              <div className="form-row">
                <div className="form-field"><label htmlFor="city">{t('City or province')}</label><select id="city" name="city" className="select" required defaultValue="">
                  <option value="" disabled>{t('Choose a location')}</option>
                  <optgroup label={t('Popular destinations')}>{POPULAR_DESTINATIONS.map(c=><option key={c} value={c}>{placeLabel(c)}</option>)}</optgroup>
                  <optgroup label={t('Other provinces')}>{OTHER_PROVINCES.map(c=><option key={c} value={c}>{placeLabel(c)}</option>)}</optgroup>
                </select></div>
                <div className="form-field"><label htmlFor="country">{t('Country')}</label><input id="country" className="input" value={t(COUNTRY)} readOnly aria-describedby="country-hint"/></div>
              </div>
              <p id="country-hint" className="hint">{t('StayEase currently lists hotels in Cambodia only. Check-in and check-out days follow Cambodia time (UTC+7).')}</p>
              <div className="form-field"><label htmlFor="coords">{t('Map location')} <span className="optional">({t('optional')})</span></label>
                <input id="coords" name="coords" className="input" value={coords} onChange={e=>setCoords(e.target.value)} placeholder={t('e.g. {example}',{example:'13.362100, 103.860400'})} aria-invalid={Boolean(pinError)} aria-describedby="coords-hint"/>
                <p id="coords-hint" className={pinError?'field-error':'hint'}>{pinError||t('In Google Maps, right-click your hotel and click the coordinates to copy them. Guests get a map and directions. You can add or change this later.')}</p></div>
            </fieldset>
            <div><button className="btn btn-primary btn-lg" disabled={busy||signedIn===null}>{busy?<><Spinner/>{t('Submitting…')}</>:t('Submit for review')}</button></div>
          </form>}
        </div>
        <aside className="card"><div className="card-body stack">
          <h2 style={{fontSize:'var(--text-lg)'}}>{t('What happens next')}</h2>
          <ol className="stack list-decimal pl-5 marker:font-bold marker:text-brand-600" style={{margin:0}}>
            <li><strong>{t('We review your listing.')}</strong><p className="muted small">{t('An administrator checks the details. Your hotel isn’t visible to guests until it’s approved.')}</p></li>
            <li><strong>{t('Set up your rooms.')}</strong><p className="muted small">{t('In your workspace, add room types, physical rooms, seasonal rates, photos and a cancellation policy.')}</p></li>
            <li><strong>{t('Start taking bookings.')}</strong><p className="muted small">{t('Guests pay online or at your front desk, and your team checks them in from the reception desk.')}</p></li>
          </ol>
          <p className="hint cluster" style={{gap:6}}><Icon name="shield" size={14}/>{t('Online card payments are handled by Stripe.')}</p>
        </div></aside>
      </div>
    </div>
  </main>;
}
