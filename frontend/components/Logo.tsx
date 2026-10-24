/** StayEase mark: three temple towers under a rising sun, in a rounded tile. */
export function LogoMark({className='size-9'}:{className?:string}){
  return <svg viewBox="0 0 40 40" className={className} aria-hidden="true" focusable="false">
    <rect width="40" height="40" rx="11" className="fill-brand-600"/>
    <circle cx="28" cy="12.5" r="4.2" className="fill-laterite-300"/>
    <path d="M20 7.5c1 1.6 1.4 3 1.4 4.3h1.3v2.6h1.2v3h1.4v3.3h1.3V30H13.4v-9.3h1.3v-3.3h1.4v-3h1.2v-2.6h1.3c0-1.3.4-2.7 1.4-4.3Z" className="fill-white"/>
    <path d="M11.6 15.8c.7 1.1 1 2.1 1 3h.9v2h.9v2.4h.9V30H7.7v-6.8h.9v-2.4h.9v-2h.9c0-.9.3-1.9 1.2-3ZM28.4 15.8c.9 1.1 1.2 2.1 1.2 3h.9v2h.9v2.4h.9V30h-7.6v-6.8h.9v-2.4h.9v-2h.9c0-.9.3-1.9 1-3Z" className="fill-white/75"/>
    <rect x="6" y="30" width="28" height="2.4" rx="1.2" className="fill-white"/>
  </svg>;
}

export default function Logo({compact=false}:{compact?:boolean}){
  return <span className="inline-flex items-center gap-2.5">
    <LogoMark/>
    {!compact&&<span className="font-display text-[1.375rem] leading-none font-extrabold tracking-[-0.04em] text-brand-700">stay<span className="text-laterite-500">ease</span></span>}
  </span>;
}
