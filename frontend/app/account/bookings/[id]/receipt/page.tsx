'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Icon from '../../../../../components/Icon';
import { LogoMark } from '../../../../../components/Logo';
import { EmptyState, Loading } from '../../../../../components/ui';
import { api, ApiError, errorMessage } from '../../../../../lib/api';
import { COMPANY } from '../../../../../lib/company';
import { formatDate, formatDateRange, formatDateTime, formatMoney, nightsBetween, pluralize, shortRef } from '../../../../../lib/format';
import { requireSession } from '../../../../../lib/session';
import { useT } from '../../../../../lib/i18n';
import { placeName } from '../../../../../lib/cambodia';

type Night={date:string;amount:number};
type Payment={receiptNumber:string;method:'CARD_ONLINE'|'PAY_AT_HOTEL';status:string;amount:number;currency:string;paidAt:string|null;refunded:number};
type Summary={id:string;status:string;checkIn:string;checkOut:string;guests:number;currency:string;total:number;createdAt:string;subtotal?:number|null;discount?:number|null;promoCode?:string|null;
  hotel:{name:string;address:string;city:string;country:string};guest:{name:string;email:string;phone:string|null};payment:Payment|null;
  rooms:{roomType:string;lineTotal:number;currency:string;nightlyRates:Night[];roomNumber?:string}[]};

/** A printable receipt once paid, or a booking confirmation showing the amount due at the hotel. */
export default function ReceiptPage(){
  const {id}=useParams<{id:string}>();
  const t=useT();
  const [booking,setBooking]=useState<Summary|null>(null);
  const [error,setError]=useState<{status:number;message:string}|null>(null);

  useEffect(()=>{
    if(!requireSession())return;
    api<Summary>(`/reservations/${encodeURIComponent(id)}/summary`).then(setBooking)
      .catch(e=>setError({status:e instanceof ApiError?e.status:0,message:errorMessage(e,'This receipt could not be loaded.')}));
  },[id]);

  if(error)return <main id="main" className="page"><div className="container container-narrow"><EmptyState icon="search" title={error.status===404?t('Receipt not found'):t('We couldn’t load this receipt')} action={<a className="btn btn-primary" href="/account/bookings">{t('Back to my trips')}</a>}>{error.status===404?t('It may belong to a different account.'):error.message}</EmptyState></div></main>;
  if(!booking)return <main id="main" className="page"><div className="container"><Loading label={t('Preparing your receipt…')}/></div></main>;

  const payment=booking.payment;
  if(!payment)return <main id="main" className="page"><div className="container container-narrow"><EmptyState icon="card" title={t('No receipt yet')} action={<a className="btn btn-primary" href={`/account/bookings/${booking.id}`}>{t('Back to booking')}</a>}>{t('A receipt is available once the booking is paid or confirmed to pay at the hotel.')}</EmptyState></div></main>;

  const paid=payment.status==='SUCCEEDED'||payment.status==='REFUNDED';
  const refunded=Number(payment.refunded)||0;
  const fullyRefunded=paid&&refunded>=Number(payment.amount);
  const balance=paid?0:Number(booking.total);
  const nights=nightsBetween(booking.checkIn,booking.checkOut);
  const money=(n:number|string)=>formatMoney(n,booking.currency);
  const title=paid?t('Receipt'):t('Booking confirmation');
  const methodLabel=payment.method==='CARD_ONLINE'?t('Card, paid online via Stripe'):paid?t('Paid at the hotel front desk'):t('Pay at the hotel on arrival');
  const stamp=fullyRefunded?{label:t('Refunded'),tone:'refunded'}:paid?{label:t('Paid'),tone:'paid'}:{label:t('Due at hotel'),tone:'due'};

  return <main id="main" className="page receipt-page">
    <div className="container" style={{maxWidth:880}}>
      <div className="receipt-actions cluster-between">
        <a href={`/account/bookings/${booking.id}`} className="btn btn-ghost"><Icon name="arrowLeft" size={18}/>{t('Back to booking')}</a>
        <button type="button" className="btn btn-primary" onClick={()=>window.print()}><Icon name="card" size={18}/>{t('Print or save as PDF')}</button>
      </div>

      <article className="receipt-sheet" aria-labelledby="receipt-title">
        <header className="receipt-head">
          <div className="receipt-brand">
            <div className="cluster" style={{gap:12}}>
              <LogoMark className="size-12"/>
              <div><p className="receipt-wordmark">stay<span>ease</span></p><p className="receipt-tagline">{t(COMPANY.tagline)}</p></div>
            </div>
            <address className="receipt-company">
              {COMPANY.addressLines.map(line=><span key={line}>{line}</span>)}
              <span>{t('Tel')} {COMPANY.phone}</span>
              <span>{COMPANY.email} · {COMPANY.website}</span>
              {COMPANY.taxId&&<span>{t('VAT TIN')} {COMPANY.taxId}</span>}
            </address>
          </div>
          <div className="receipt-meta">
            <h1 id="receipt-title">{title}</h1>
            <dl>
              <div><dt>{paid?t('Receipt no.'):t('Confirmation no.')}</dt><dd className="mono">{payment.receiptNumber}</dd></div>
              <div><dt>{t('Booking ref')}</dt><dd className="mono">{shortRef(booking.id)}</dd></div>
              <div><dt>{paid?t('Paid on'):t('Issued on')}</dt><dd>{paid&&payment.paidAt?formatDateTime(payment.paidAt):formatDateTime(booking.createdAt)}</dd></div>
            </dl>
          </div>
        </header>

        <section className="receipt-parties">
          <div>
            <h2>{t('Billed to')}</h2>
            <p className="strong">{booking.guest.name}</p>
            <p>{booking.guest.email}</p>
            {booking.guest.phone&&<p>{booking.guest.phone}</p>}
          </div>
          <div>
            <h2>{t('Stay')}</h2>
            <p className="strong">{booking.hotel.name}</p>
            <p>{booking.hotel.address}, {placeName(booking.hotel.city)}</p>
            <p>{formatDateRange(booking.checkIn,booking.checkOut)}</p>
            <p>{pluralize(nights,'night')} · {pluralize(booking.guests,'guest')}</p>
          </div>
        </section>

        <table className="receipt-lines">
          <thead><tr><th scope="col">{t('Description')}</th><th scope="col">{t('Nights')}</th><th scope="col" className="text-right">{t('Amount')}</th></tr></thead>
          <tbody>{booking.rooms.map((room,i)=><tr key={`${room.roomType}-${i}`}>
            <td><span className="strong">{room.roomType}</span>{room.roomNumber&&<span className="muted"> · {t('Room {number}',{number:room.roomNumber})}</span>}
              <span className="receipt-nightly">{room.nightlyRates.map(n=>`${formatDate(n.date)} ${money(n.amount)}`).join(' · ')}</span></td>
            <td className="num">{room.nightlyRates.length}</td>
            <td className="text-right num">{money(room.lineTotal)}</td>
          </tr>)}</tbody>
        </table>

        <div className="receipt-bottom">
          <div className="receipt-payment">
            <h2>{t('Payment')}</h2>
            <p><span className="muted">{t('Method')}</span> {methodLabel}</p>
            <p><span className="muted">{t('Status')}</span> {fullyRefunded?t('Refunded'):paid?t('Paid in full'):t('Not yet paid')}</p>
            <div className={`receipt-stamp ${stamp.tone}`} aria-label={t('Stamp: {label}',{label:stamp.label})}>
              <LogoMark className="size-7"/>
              <span className="receipt-stamp-label">{stamp.label}</span>
              <span className="receipt-stamp-date">{paid&&payment.paidAt?formatDate(payment.paidAt):formatDate(booking.checkIn)}</span>
            </div>
          </div>
          <dl className="receipt-totals">
            <div><dt>{t('Room charges')}</dt><dd className="num">{money(booking.subtotal??booking.total)}</dd></div>
            {Number(booking.discount)>0&&<div><dt>{booking.promoCode?t('Discount ({code})',{code:booking.promoCode}):t('Discount')}</dt><dd className="num">−{money(Number(booking.discount))}</dd></div>}
            <div className="receipt-total"><dt>{t('Total')}</dt><dd className="num">{money(booking.total)}</dd></div>
            <div><dt>{t('Amount paid')}</dt><dd className="num">{money(paid?payment.amount:0)}</dd></div>
            {refunded>0&&<div><dt>{t('Refunded')}</dt><dd className="num">−{money(refunded)}</dd></div>}
            <div className="receipt-balance"><dt>{paid?t('Balance'):t('Due at check-in')}</dt><dd className="num">{money(balance)}</dd></div>
          </dl>
        </div>

        <section className="receipt-signatures">
          <div>
            <p className="receipt-script" aria-hidden="true">StayEase</p>
            <div className="receipt-sign-line"/>
            <p className="strong">{COMPANY.signatory.name}</p>
            <p className="muted">{t(COMPANY.signatory.title)}</p>
          </div>
          <div>
            <div className="receipt-sign-space"/>
            <div className="receipt-sign-line"/>
            <p className="strong">{t('Guest signature')}</p>
            <p className="muted">{booking.guest.name}</p>
          </div>
        </section>

        <footer className="receipt-foot">
          <p className="strong">{t('Thank you for booking with StayEase.')}</p>
          <p>{paid?t('This receipt was issued electronically and is valid without a stamp.'):t('Please show this confirmation at reception and pay the amount due when you check in.')} {t('Questions? Call {phone} or email {email} and quote booking ref {ref}.',{phone:COMPANY.phone,email:COMPANY.email,ref:shortRef(booking.id)})}</p>
        </footer>
      </article>
    </div>
  </main>;
}
