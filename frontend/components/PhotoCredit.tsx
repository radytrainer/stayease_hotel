/** Photographer credit required by the Unsplash API guidelines. Plain text inside links (e.g. hotel cards). */
import { Trans } from '../lib/i18n';
import { translate } from '../lib/lang';

const UNSPLASH='https://unsplash.com/?utm_source=stayease&utm_medium=referral';

export default function PhotoCredit({name,url,plain=false,className=''}:{name?:string|null;url?:string|null;plain?:boolean;className?:string}){
  if(!name||!url)return null;
  const base=`rounded-full bg-black/55 px-2 py-0.5 text-[10px] leading-4 text-white/95 backdrop-blur-sm ${className}`;
  if(plain)return <span className={base}>{translate('Photo: {name} / Unsplash',{name})}</span>;
  return <span className={base}><Trans text="Photo by {name} on {site}" vars={{name:<a href={url} target="_blank" rel="noopener noreferrer" className="font-semibold text-white underline-offset-2 hover:underline">{name}</a>,site:<a href={UNSPLASH} target="_blank" rel="noopener noreferrer" className="font-semibold text-white underline-offset-2 hover:underline">Unsplash</a>}}/></span>;
}
