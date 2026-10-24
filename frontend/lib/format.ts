import { getLang, LOCALES, translate } from './lang';

export type Tone='success'|'warning'|'error'|'info'|'neutral'|'primary';

/** Money is formatted from the server's decimal string or number; the client never computes totals it submits. */
export function formatMoney(amount:number|string|null|undefined,currency='USD'){
  const value=Number(amount??0);
  try{return new Intl.NumberFormat('en-US',{style:'currency',currency:currency.trim(),minimumFractionDigits:value%1===0?0:2,maximumFractionDigits:2}).format(value);}
  catch{return `${currency} ${value.toLocaleString('en-US',{maximumFractionDigits:2})}`;}
}

/** Parses YYYY-MM-DD as a calendar date so it never shifts across time zones. */
function parseDate(iso:string){const [y,m,d]=iso.slice(0,10).split('-').map(Number);return new Date(y,m-1,d);}

/** Khmer day and month names, written out because many browsers ship without Khmer locale data for Intl. */
const KM_DAYS=['អាទិត្យ','ច័ន្ទ','អង្គារ','ពុធ','ព្រហស្បតិ៍','សុក្រ','សៅរ៍'];
const KM_MONTHS=['មករា','កុម្ភៈ','មីនា','មេសា','ឧសភា','មិថុនា','កក្កដា','សីហា','កញ្ញា','តុលា','វិច្ឆិកា','ធ្នូ'];
const khmerDate=(d:Date,long=false)=>`${long?'ថ្ងៃ':''}${KM_DAYS[d.getDay()]} ${d.getDate()} ${KM_MONTHS[d.getMonth()]} ${d.getFullYear()}`;

export function formatDate(iso:string|null|undefined,style:'short'|'long'='short'){
  if(!iso)return '';
  const date=parseDate(iso);
  if(Number.isNaN(date.getTime()))return iso;
  if(getLang()==='km')return khmerDate(date,style==='long');
  return date.toLocaleDateString(LOCALES[getLang()],style==='long'?{weekday:'long',day:'numeric',month:'long',year:'numeric'}:{weekday:'short',day:'numeric',month:'short',year:'numeric'});
}

export function formatDateRange(checkIn:string,checkOut:string){return `${formatDate(checkIn)} – ${formatDate(checkOut)}`;}

export function formatDateTime(iso:string|null|undefined){
  if(!iso)return '';
  const date=new Date(iso);
  if(!Number.isNaN(date.getTime())&&getLang()==='km')
    return `${date.getDate()} ${KM_MONTHS[date.getMonth()]} ${date.getFullYear()}, ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
  return Number.isNaN(date.getTime())?iso:date.toLocaleString(LOCALES[getLang()],{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
}

export function nightsBetween(checkIn:string,checkOut:string){
  if(!checkIn||!checkOut)return 0;
  return Math.round((parseDate(checkOut).getTime()-parseDate(checkIn).getTime())/86_400_000);
}
/** Khmer has no plural forms: the number is followed by the unit word. */
const KM_UNITS:Record<string,string>={night:'យប់',guest:'ភ្ញៀវ',room:'បន្ទប់',stay:'កន្លែងស្នាក់នៅ',hour:'ម៉ោង',photo:'រូបភាព',hotel:'សណ្ឋាគារ',province:'ខេត្ត'};
export function pluralize(count:number,one:string,many=`${one}s`){
  if(getLang()==='km')return `${count} ${KM_UNITS[one]??one}`;
  return `${count} ${count===1?one:many}`;
}

export function isoDate(offsetDays=0,from=new Date()){
  const d=new Date(from.getFullYear(),from.getMonth(),from.getDate()+offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function addDays(iso:string,days:number){return isoDate(days,parseDate(iso));}

type Meta={label:string;tone:Tone};
const reservation:Record<string,Meta>={
  CREATED:{label:'Created',tone:'neutral'},
  PENDING_PAYMENT:{label:'Awaiting payment',tone:'warning'},
  CONFIRMED:{label:'Confirmed',tone:'success'},
  CHECKED_IN:{label:'Checked in',tone:'info'},
  CHECKED_OUT:{label:'Checked out',tone:'neutral'},
  COMPLETED:{label:'Completed',tone:'neutral'},
  EXPIRED:{label:'Hold expired',tone:'neutral'},
  CANCELLED:{label:'Cancelled',tone:'error'},
};
const hotel:Record<string,Meta>={
  PENDING_APPROVAL:{label:'Awaiting approval',tone:'warning'},
  APPROVED:{label:'Live',tone:'success'},
  SUSPENDED:{label:'Suspended',tone:'error'},
};
const room:Record<string,Meta>={
  AVAILABLE:{label:'Available',tone:'success'},
  CLEANING:{label:'Cleaning',tone:'info'},
  OUT_OF_SERVICE:{label:'Out of service',tone:'error'},
};
const roleLabels:Record<string,string>={GUEST:'Guest',RECEPTIONIST:'Receptionist',HOTEL_MANAGER:'Hotel manager',SYSTEM_ADMIN:'Administrator'};

const humanize=(value:string)=>value.charAt(0)+value.slice(1).toLowerCase().replaceAll('_',' ');
export function statusMeta(kind:'reservation'|'hotel'|'room',value:string):Meta{
  const table=kind==='reservation'?reservation:kind==='hotel'?hotel:room;
  const meta=table[value];
  return meta?{label:translate(meta.label),tone:meta.tone}:{label:humanize(value),tone:'neutral'};
}
export function roleLabel(role:string){return roleLabels[role]?translate(roleLabels[role]):humanize(role);}

const templates:Record<string,string>={
  RESERVATION_HOLD_CREATED:'Rooms held for checkout',
  RESERVATION_CONFIRMED:'Reservation confirmed',
  RESERVATION_CANCELLED:'Reservation cancelled',
  RESERVATION_EXPIRED:'Room hold expired',
  RESERVATION_CHECKED_IN:'Checked in',
  RESERVATION_CHECKED_OUT:'Checked out',
  REFUND_ISSUED:'Refund issued',
};
export function notificationTitle(template:string){return templates[template]?translate(templates[template]):humanize(template);}

/** Short, copyable reference instead of a full UUID in the interface. */
export function shortRef(id:string){return id.slice(0,8).toUpperCase();}
