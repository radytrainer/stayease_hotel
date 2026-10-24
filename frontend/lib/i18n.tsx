'use client';
import { createContext, Fragment, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { LANG_COOKIE, setCurrentLang, translate, type Lang } from './lang';

type Ctx={lang:Lang;setLang:(lang:Lang)=>void};
const LanguageContext=createContext<Ctx>({lang:'en',setLang:()=>{}});

/** Holds the interface language. The initial value comes from a cookie read by the server, so the first paint matches. */
export function LanguageProvider({initial,children}:{initial:Lang;children:ReactNode}){
  const [lang,setLangState]=useState<Lang>(initial);
  setCurrentLang(lang);
  const setLang=useCallback((next:Lang)=>{
    document.cookie=`${LANG_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
    document.documentElement.lang=next;
    setCurrentLang(next);
    setLangState(next);
  },[]);
  const value=useMemo(()=>({lang,setLang}),[lang,setLang]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang(){return useContext(LanguageContext);}

/**
 * Translation function for the current language. Components that call it re-render when the language changes,
 * which also refreshes the dates, plurals and place names they format.
 */
export function useT(){
  const {lang}=useContext(LanguageContext);
  return useCallback((text:string,vars?:Record<string,string|number>)=>translate(text,vars,lang),[lang]);
}

/** A translated sentence with React elements in it, e.g. <Trans text="Pay {amount} now" vars={{amount:<b>$5</b>}}/>. */
export function Trans({text,vars}:{text:string;vars:Record<string,ReactNode>}){
  const t=useT();
  const parts=t(text).split(/(\{\w+\})/);
  return <>{parts.map((part,i)=>{const key=part.match(/^\{(\w+)\}$/)?.[1];return <Fragment key={i}>{key&&key in vars?vars[key]:part}</Fragment>;})}</>;
}
