'use client';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { translate } from '../lib/lang';

type Options={title:string;body?:ReactNode;confirmLabel:string;cancelLabel?:string;danger?:boolean};

/**
 * Accessible confirmation built on the native <dialog>: focus moves into it, Escape cancels,
 * and focus returns to the trigger afterwards.
 *   const [confirm, dialog] = useConfirm();  if (!(await confirm({...}))) return;
 */
export function useConfirm():[(options:Options)=>Promise<boolean>,ReactNode]{
  const [options,setOptions]=useState<Options|null>(null);
  const resolver=useRef<((value:boolean)=>void)|null>(null);
  const dialog=useRef<HTMLDialogElement>(null);
  const opener=useRef<Element|null>(null);

  const confirm=useCallback((next:Options)=>{
    opener.current=document.activeElement;
    setOptions(next);
    return new Promise<boolean>(resolve=>{resolver.current=resolve;});
  },[]);

  useEffect(()=>{if(options&&dialog.current&&!dialog.current.open)dialog.current.showModal();},[options]);

  const settle=(value:boolean)=>{
    resolver.current?.(value);resolver.current=null;
    dialog.current?.close();setOptions(null);
    if(opener.current instanceof HTMLElement)opener.current.focus();
  };

  const element=options?<dialog ref={dialog} className="dialog" aria-labelledby="confirm-title" onCancel={e=>{e.preventDefault();settle(false);}}>
    <div className="dialog-body"><h2 id="confirm-title">{options.title}</h2>{options.body&&<div className="muted">{options.body}</div>}</div>
    <div className="dialog-actions">
      <button type="button" className="btn btn-secondary" onClick={()=>settle(false)} autoFocus>{options.cancelLabel??translate('Go back')}</button>
      <button type="button" className={`btn ${options.danger?'btn-danger':'btn-primary'}`} onClick={()=>settle(true)}>{options.confirmLabel}</button>
    </div>
  </dialog>:null;
  return [confirm,element];
}
