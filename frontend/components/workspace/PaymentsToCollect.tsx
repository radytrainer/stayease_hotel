'use client';
import { useCallback, useEffect, useState } from 'react';
import { EmptyState, Loading, StatusBadge } from '../ui';
import { useConfirm } from '../useConfirm';
import { api, errorMessage } from '../../lib/api';
import { formatDateRange, formatMoney, shortRef } from '../../lib/format';
import { useT } from '../../lib/i18n';
import type { Notify } from './types';

type Due={id:string;status:string;check_in:string;check_out:string;amount:number;currency:string;guest_name:string;email:string};

/** Pay-at-hotel balances still to collect for one hotel; `base` is the manager or reception API path for that hotel. */
export default function PaymentsToCollect({base,notify}:{base:string;notify:Notify}){
  const t=useT();
  const [rows,setRows]=useState<Due[]|null>(null);
  const [busy,setBusy]=useState('');
  const [confirm,dialog]=useConfirm();

  const load=useCallback(async()=>{
    setRows(null);
    try{setRows(await api<Due[]>(`${base}/payments/outstanding`));}
    catch(e){setRows([]);notify({tone:'error',text:errorMessage(e,'Payments to collect could not be loaded.')});}
  },[base,notify]);
  useEffect(()=>{void load();},[load]);

  async function received(row:Due){
    const ok=await confirm({title:t('Mark {amount} as received?',{amount:formatMoney(row.amount,row.currency)}),confirmLabel:t('Mark paid'),
      body:<>{row.guest_name} · {formatDateRange(row.check_in,row.check_out)}<br/>{t('Only confirm once the money is in the till or the card payment has gone through. This is recorded in the audit log.')}</>});
    if(!ok)return;
    setBusy(row.id);
    try{await api(`${base}/reservations/${row.id}/payment-received`,{method:'POST'});notify({tone:'success',text:t('Payment from {name} recorded.',{name:row.guest_name})});await load();}
    catch(e){notify({tone:'error',text:errorMessage(e)});}
    finally{setBusy('');}
  }

  return <section className="stack" aria-labelledby="collect-title">
    {dialog}
    <h2 id="collect-title" style={{fontSize:'var(--text-lg)'}}>{t('Payments to collect at the desk')}</h2>
    {!rows?<Loading label={t('Loading payments…')}/>
      :!rows.length?<EmptyState icon="card" title={t('Nothing to collect')} headingLevel={3}>{t('Guests who choose “Pay at hotel” appear here until their payment is recorded.')}</EmptyState>
      :<div className="table-wrap"><table className="table table-stack">
        <thead><tr><th scope="col">{t('Guest')}</th><th scope="col">{t('Stay')}</th><th scope="col">{t('Status')}</th><th scope="col" className="text-right">{t('Amount due')}</th><th scope="col" className="actions"><span className="visually-hidden">{t('Action')}</span></th></tr></thead>
        <tbody>{rows.map(r=><tr key={r.id}>
          <td className="primary-cell" data-label={t('Guest')}><span className="strong">{r.guest_name}</span><span className="muted small" style={{display:'block'}}>{r.email} · {t('Ref')} <span className="mono">{shortRef(r.id)}</span></span></td>
          <td data-label={t('Stay')}>{formatDateRange(r.check_in,r.check_out)}</td>
          <td data-label={t('Status')}><StatusBadge kind="reservation" value={r.status}/></td>
          <td data-label={t('Amount due')} className="text-right num strong">{formatMoney(r.amount,r.currency)}</td>
          <td className="actions"><button type="button" className="btn btn-primary btn-sm" disabled={busy===r.id} onClick={()=>void received(r)}>{busy===r.id?t('Saving…'):t('Mark paid')}</button></td>
        </tr>)}</tbody></table></div>}
  </section>;
}
