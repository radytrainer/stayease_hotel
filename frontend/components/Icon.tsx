const paths={
  search:'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35',
  pin:'M12 22s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Zm0-9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  calendar:'M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  users:'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm10 9v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.15a3.5 3.5 0 0 1 0 6.7',
  check:'m5 12.5 4.5 4.5L19 7.5',
  checkCircle:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm-4-10 3 3 5-6',
  info:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-6v-5m0-3h.01',
  alert:'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0ZM12 9v4m0 4h.01',
  error:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm3-13-6 6m0-6 6 6',
  shield:'M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Zm-3-10 2 2 4-4',
  bed:'M3 18v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7M3 14h18M3 18v2m18-2v2M7 9V6a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3',
  menu:'M4 7h16M4 12h16M4 17h16',
  close:'M6 6l12 12M18 6 6 18',
  image:'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm0 12 4-4 3 3 3-3 5 5M15.5 9.5h.01',
  clock:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-15v5l3 2',
  bell:'M18 16v-5a6 6 0 1 0-12 0v5l-2 2h16l-2-2Zm-8 4a2 2 0 0 0 4 0',
  arrowLeft:'M19 12H5m6-6-6 6 6 6',
  arrowRight:'M5 12h14m-6-6 6 6-6 6',
  card:'M3 6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6Zm0 4h18M7 15h4',
  building:'M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16m0-11h4a1 1 0 0 1 1 1v10M2 21h20M8 8h3m-3 4h3m-3 4h3',
  logIn:'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5m5 5H3',
  logOut:'M9 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3m7 13 5-5-5-5m5 5H9',
  plus:'M12 5v14M5 12h14',
  eye:'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  eyeOff:'M3 3l18 18M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6A17.4 17.4 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2',
} as const;

export type IconName=keyof typeof paths;

/** Decorative by default; pass a label when the icon is the only content of a control. */
export default function Icon({name,size=20,label}:{name:IconName;size?:number;label?:string}){
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
    role={label?'img':undefined} aria-label={label} aria-hidden={label?undefined:true} focusable="false"><path d={paths[name]}/></svg>;
}
