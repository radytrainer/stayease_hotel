'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Badge, EmptyState, Loading, Spinner } from '../ui';
import { api, errorMessage } from '../../lib/api';
import { formatDate, formatMoney } from '../../lib/format';
import { useT } from '../../lib/i18n';
import { PROMO_THEMES, type PromoTheme } from '../../lib/promotions';
import type { Notify } from './types';

type Promotion={id:string;code:string;description:string|null;discountType:'PERCENT'|'FIXED';discountValue:number;currency:string|null;
  startsOn:string|null;endsOn:string|null;minNights:number;maxUses:number|null;onePerGuest:boolean;active:boolean;uses:number;discountGiven:number;
  headline?:string|null;theme?:PromoTheme;featured?:boolean};

const empty={code:'',description:'',discountType:'PERCENT',discountValue:'',startsOn:'',endsOn:'',minNights:'1',maxUses:'',onePerGuest:true,headline:'',theme:'GENERAL',featured:true};

/**
 * Discount codes: a hotel manager's codes for one hotel, or (platform) the administrator's codes for every hotel,
 * which can be advertised on the home page during their dates.
 */
export default function Promotions({base,currency,notify,platform=false}:{base:string;currency:string;notify:Notify;platform?:boolean}){
  const t=useT();
  const [rows,setRows]=useState<Promotion[]|null>(null);
  const [form,setForm]=useState(empty);
  const [busy,setBusy]=useState('');

  const load=useCallback(async()=>{
    try{setRows(await api<Promotion[]>(base));}
    catch(e){setRows([]);notify({tone:'error',text:errorMessage(e,'Promotion codes could not be loaded.')});}
  },[base,notify]);
  useEffect(()=>{setRows(null);void load();},[load]);

  const set=(key:keyof typeof empty,value:string|boolean)=>setForm(f=>({...f,[key]:value}));

  async function create(e:FormEvent){
    e.preventDefault();setBusy('create');
    try{
      await api(base,{method:'POST',body:{code:form.code.trim(),description:form.description.trim()||null,discountType:form.discountType,discountValue:Number(form.discountValue),
        startsOn:form.startsOn||null,endsOn:form.endsOn||null,minNights:Number(form.minNights)||1,maxUses:form.maxUses?Number(form.maxUses):null,onePerGuest:form.onePerGuest,
        ...(platform?{headline:form.headline.trim()||null,theme:form.theme,featured:form.featured}:{})}});
      const code=form.code.trim().toUpperCase();
      notify({tone:'success',text:platform&&form.featured?t('Code {code} created and advertised on the home page during its dates.',{code}):t('Code {code} is live.',{code})});setForm(empty);await load();
    }catch(err){notify({tone:'error',text:errorMessage(err,'The code could not be created.')});}
    finally{setBusy('');}
  }
  async function toggle(p:Promotion){
    setBusy(p.id);
    try{await api(`${base}/${p.id}?active=${!p.active}`,{method:'PATCH'});notify({tone:'success',text:p.active?t('{code} paused.',{code:p.code}):t('{code} resumed.',{code:p.code})});await load();}
    catch(err){notify({tone:'error',text:errorMessage(err)});}
    finally{setBusy('');}
  }
  async function feature(p:Promotion){
    setBusy(p.id);
    try{await api(`${base}/${p.id}?featured=${!p.featured}`,{method:'PATCH'});notify({tone:'success',text:p.featured?t('{code} removed from the home page.',{code:p.code}):t('{code} will be advertised on the home page during its dates.',{code:p.code})});await load();}
    catch(err){notify({tone:'error',text:errorMessage(err)});}
    finally{setBusy('');}
  }
  const today=new Date().toISOString().slice(0,10);
  const advertisedNow=(p:Promotion)=>Boolean(p.featured&&p.active&&(!p.startsOn||p.startsOn<=today)&&(!p.endsOn||p.endsOn>=today));

  const value=(p:Promotion)=>t('{amount} off',{amount:p.discountType==='PERCENT'?`${Number(p.discountValue)}%`:formatMoney(p.discountValue,p.currency??currency)});
  const bookable=(p:Promotion)=>p.startsOn&&p.endsOn?`${formatDate(p.startsOn)} – ${formatDate(p.endsOn)}`:p.startsOn?t('From {date}',{date:formatDate(p.startsOn)}):p.endsOn?t('Until {date}',{date:formatDate(p.endsOn)}):t('Always');
  const rules=(p:Promotion)=>[p.minNights>1?t('{count}+ nights',{count:p.minNights}):null,p.onePerGuest?t('once per guest'):null].filter(Boolean).join(' · ')||t('No limits');

  return <div className="stack-lg">
    <section className="card" aria-labelledby="new-promo-title"><form className="card-body form" onSubmit={create}>
      <div><h2 id="new-promo-title" style={{fontSize:'var(--text-lg)'}}>{platform?t('New platform promotion'):t('New promo code')}</h2><p className="muted small" style={{marginTop:4}}>{platform
        ?t('Works at every StayEase hotel. Featured promotions are advertised on the home page only between their dates, so you can prepare holiday offers in advance.')
        :t('Guests type the code on your hotel page before reserving. The discount comes off the whole stay.')}</p></div>
      {platform&&<div className="form-row">
        <div className="form-field"><label htmlFor="p-theme">{t('Occasion')}</label><select id="p-theme" className="select" value={form.theme} onChange={e=>set('theme',e.target.value)}>{(Object.keys(PROMO_THEMES) as PromoTheme[]).map(k=><option key={k} value={k}>{t(PROMO_THEMES[k].label)}</option>)}</select><p className="hint">{t('Sets the banner colour and label')}</p></div>
        <div className="form-field"><label htmlFor="p-headline">{t('Banner headline')}</label><input id="p-headline" className="input" maxLength={80} value={form.headline} onChange={e=>set('headline',e.target.value)} placeholder={t('Water Festival: 20% off every hotel')}/></div>
      </div>}
      <div className="form-row">
        <div className="form-field"><label htmlFor="p-code">{t('Code')}</label><input id="p-code" className="input" required maxLength={32} value={form.code} onChange={e=>set('code',e.target.value.toUpperCase())} placeholder={t('e.g. {example}',{example:'RAINY15'})} style={{textTransform:'uppercase'}}/><p className="hint">{t('3–32 letters, digits, - or _')}</p></div>
        <div className="form-field"><label htmlFor="p-desc">{t('Description')} <span className="optional">({t('shown to guests')})</span></label><input id="p-desc" className="input" maxLength={200} value={form.description} onChange={e=>set('description',e.target.value)} placeholder={t('Rainy season offer')}/></div>
      </div>
      <div className="form-row">
        <div className="form-field"><label htmlFor="p-type">{t('Discount')}</label><select id="p-type" className="select" value={form.discountType} onChange={e=>set('discountType',e.target.value)}><option value="PERCENT">{t('Percent off the stay')}</option><option value="FIXED">{t('Fixed amount off ({currency})',{currency})}</option></select></div>
        <div className="form-field"><label htmlFor="p-value">{form.discountType==='PERCENT'?t('Percent (%)'):t('Amount ({currency})',{currency})}</label><input id="p-value" className="input" type="number" required min="0.01" max={form.discountType==='PERCENT'?100:undefined} step="0.01" value={form.discountValue} onChange={e=>set('discountValue',e.target.value)}/></div>
      </div>
      <div className="form-row">
        <div className="form-field"><label htmlFor="p-start">{t('Bookable from')} <span className="optional">({t('optional')})</span></label><input id="p-start" className="input" type="date" value={form.startsOn} onChange={e=>set('startsOn',e.target.value)}/></div>
        <div className="form-field"><label htmlFor="p-end">{t('Bookable until')} <span className="optional">({t('optional')})</span></label><input id="p-end" className="input" type="date" min={form.startsOn||undefined} value={form.endsOn} onChange={e=>set('endsOn',e.target.value)}/></div>
      </div>
      <div className="form-row">
        <div className="form-field"><label htmlFor="p-nights">{t('Minimum stay (nights)')}</label><input id="p-nights" className="input" type="number" min="1" max="60" value={form.minNights} onChange={e=>set('minNights',e.target.value)}/></div>
        <div className="form-field"><label htmlFor="p-uses">{t('Total uses')} <span className="optional">({t('blank = unlimited')})</span></label><input id="p-uses" className="input" type="number" min="1" value={form.maxUses} onChange={e=>set('maxUses',e.target.value)}/></div>
      </div>
      <label className="checkbox"><input type="checkbox" checked={form.onePerGuest} onChange={e=>set('onePerGuest',e.target.checked)}/><span>{t('Each guest can use it once')}</span></label>
      {platform&&<label className="checkbox"><input type="checkbox" checked={form.featured} onChange={e=>set('featured',e.target.checked)}/><span>{t('Advertise on the home page while it’s bookable')}</span></label>}
      <div><button className="btn btn-primary" disabled={busy==='create'}>{busy==='create'?<><Spinner/>{t('Creating…')}</>:t('Create code')}</button></div>
    </form></section>

    <section className="stack" aria-labelledby="promo-list-title">
      <h2 id="promo-list-title" style={{fontSize:'var(--text-lg)'}}>{t('Your codes')}</h2>
      {!rows?<Loading label={t('Loading codes…')}/>:!rows.length?<EmptyState icon="card" title={t('No promo codes yet')} headingLevel={3}>{t('Create a code above to offer guests a discount.')}</EmptyState>
        :<div className="table-wrap"><table className="table table-stack">
          <thead><tr><th scope="col">{t('Code')}</th><th scope="col">{t('Discount')}</th><th scope="col">{t('Bookable')}</th><th scope="col">{t('Rules')}</th><th scope="col">{t('Used')}</th><th scope="col">{t('Status')}</th>{platform&&<th scope="col">{t('Home page')}</th>}<th scope="col" className="actions"><span className="visually-hidden">{t('Action')}</span></th></tr></thead>
          <tbody>{rows.map(p=><tr key={p.id}>
            <td className="primary-cell" data-label={t('Code')}><span className="strong mono">{p.code}</span>{platform&&p.theme&&PROMO_THEMES[p.theme]&&<span className="muted small"> · {t(PROMO_THEMES[p.theme].label)}</span>}<span className="muted small" style={{display:'block'}}>{p.headline||p.description}</span></td>
            <td data-label={t('Discount')}>{value(p)}</td>
            <td data-label={t('Bookable')}>{bookable(p)}</td>
            <td data-label={t('Rules')}>{rules(p)}</td>
            <td data-label={t('Used')} className="num">{p.uses}{p.maxUses?` / ${p.maxUses}`:''}<span className="muted small" style={{display:'block'}}>{t('{amount} given',{amount:formatMoney(p.discountGiven,p.currency??currency)})}</span></td>
            <td data-label={t('Status')}>{p.active?<Badge tone="success">{t('Active')}</Badge>:<Badge>{t('Paused')}</Badge>}</td>
            {platform&&<td data-label={t('Home page')}>{advertisedNow(p)?<Badge tone="primary">{t('Showing now')}</Badge>:p.featured?<Badge tone="info">{t('Scheduled')}</Badge>:<span className="muted small">{t('Not advertised')}</span>}</td>}
            <td className="actions"><div className="cluster">
              {platform&&<button type="button" className="btn btn-ghost btn-sm" disabled={busy===p.id} onClick={()=>void feature(p)}>{p.featured?t('Hide from home'):t('Advertise')}</button>}
              <button type="button" className="btn btn-secondary btn-sm" disabled={busy===p.id} onClick={()=>void toggle(p)}>{p.active?t('Pause'):t('Resume')}</button>
            </div></td>
          </tr>)}</tbody></table></div>}
    </section>
  </div>;
}
