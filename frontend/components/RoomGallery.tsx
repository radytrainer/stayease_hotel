'use client';
import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import RoomArt, { type RoomPhotoCategory } from './RoomArt';
import { imageUrl } from '../lib/api';
import PhotoCredit from './PhotoCredit';
import { translate } from '../lib/lang';

export type RoomPhoto={id:string;category:RoomPhotoCategory;altText:string;url:string;creditName?:string;creditUrl?:string};

const tabs:{id:RoomPhotoCategory;label:string}[]=[{id:'ROOM',label:'Room'},{id:'BATHROOM',label:'Bathroom'},{id:'VIEW',label:'View'},{id:'EXTERIOR',label:'Outside'}];

/** Thumbnail for the room card: the first uploaded room photo, otherwise generated sample photography. */
export function RoomThumb({photos,seed,city,capacity}:{photos:RoomPhoto[];seed:string;city:string;capacity:number}){
  const first=photos.find(p=>p.category==='ROOM')??photos[0];
  return first?<img src={imageUrl(first.url,480)} alt="" title={first.creditName?translate('Photo: {name} / Unsplash',{name:first.creditName}):undefined} className="size-full object-cover" loading="lazy"/>:<RoomArt category="ROOM" seed={seed} city={city} capacity={capacity}/>;
}

/**
 * Room photo gallery in a native modal dialog: Room, Bathroom, View and Outside tabs. Categories without
 * an uploaded photo show category-specific generated sample photography.
 */
export default function RoomGallery({open,onClose,roomType,photos,seed,hotelSeed,city,capacity}:{open:boolean;onClose:()=>void;roomType:string;photos:RoomPhoto[];seed:string;hotelSeed:string;city:string;capacity:number}){
  const dialog=useRef<HTMLDialogElement>(null);
  const [tab,setTab]=useState<RoomPhotoCategory>('ROOM');
  const [index,setIndex]=useState(0);

  useEffect(()=>{const d=dialog.current;if(!d)return;if(open&&!d.open){setTab('ROOM');setIndex(0);d.showModal();}if(!open&&d.open)d.close();},[open]);

  const inTab=photos.filter(p=>p.category===tab);
  const current=inTab[Math.min(index,inTab.length-1)];
  const count=(c:RoomPhotoCategory)=>photos.filter(p=>p.category===c).length;
  const step=(d:number)=>{if(inTab.length>1)setIndex(i=>(i+d+inTab.length)%inTab.length);};
  const choose=(t:RoomPhotoCategory)=>{setTab(t);setIndex(0);};

  return <dialog ref={dialog} onClose={onClose} onCancel={e=>{e.preventDefault();onClose();}} aria-labelledby="gallery-title"
    onKeyDown={e=>{if(e.key==='ArrowRight')step(1);if(e.key==='ArrowLeft')step(-1);}}
    className="m-auto w-[min(960px,calc(100vw-2rem))] overflow-hidden rounded-2xl p-0 text-ink shadow-2xl backdrop:bg-brand-950/70 backdrop:backdrop-blur-sm">
    <div className="flex items-center justify-between gap-4 border-b border-ink/10 px-5 py-3">
      <h2 id="gallery-title" className="font-display text-lg font-bold">{roomType}</h2>
      <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full text-ink-muted hover:bg-ink/5 hover:text-ink" aria-label={translate('Close photos')}><Icon name="close"/></button>
    </div>
    <div role="tablist" aria-label={translate('Photo type')} className="flex gap-1 overflow-x-auto border-b border-ink/10 px-3">
      {tabs.map(t=><button key={t.id} role="tab" aria-selected={tab===t.id} onClick={()=>choose(t.id)}
        className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold whitespace-nowrap ${tab===t.id?'border-brand-600 text-brand-700':'border-transparent text-ink-muted hover:text-ink'}`}>
        {translate(t.label)}{count(t.id)>0&&<span className={`rounded-full px-2 py-0.5 text-[11px] ${tab===t.id?'bg-brand-100 text-brand-700':'bg-ink/5'}`}>{count(t.id)}</span>}
      </button>)}
    </div>
    <div role="tabpanel" className="relative aspect-[16/10] bg-ink/5">
      {current
        ?<><img src={imageUrl(current.url,1600)} alt={current.altText||`${roomType}: ${translate(tabs.find(t=>t.id===tab)?.label??'Room')}`} className="size-full object-cover"/><PhotoCredit name={current.creditName} url={current.creditUrl} className="absolute bottom-3 left-3"/></>
        :<div className="size-full"><RoomArt category={tab} seed={tab==='EXTERIOR'?hotelSeed:seed} city={city} capacity={capacity}/></div>}
      {!current&&<p className="absolute top-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-ink shadow-sm">{translate('Generated sample photo')}</p>}
      {inTab.length>1&&<>
        <button type="button" onClick={()=>step(-1)} className="absolute top-1/2 left-3 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow hover:bg-white" aria-label={translate('Previous photo')}><Icon name="arrowLeft"/></button>
        <button type="button" onClick={()=>step(1)} className="absolute top-1/2 right-3 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow hover:bg-white" aria-label={translate('Next photo')}><Icon name="arrowRight"/></button>
        <p className="absolute right-3 bottom-3 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-semibold text-white" aria-live="polite">{Math.min(index,inTab.length-1)+1} / {inTab.length}</p>
      </>}
    </div>
    {current?.altText&&<p className="px-5 py-3 text-sm text-ink-muted">{current.altText}</p>}
  </dialog>;
}
