import type { KeyboardEvent, ReactNode } from 'react';
import Icon, { type IconName } from './Icon';
import { statusMeta, type Tone } from '../lib/format';
import { translate } from '../lib/lang';

type AlertTone='info'|'success'|'warning'|'error';
const alertIcons:Record<AlertTone,IconName>={info:'info',success:'checkCircle',warning:'alert',error:'error'};

/** Errors interrupt screen readers (role=alert); everything else is announced politely. */
export function Alert({tone='info',title,children,onDismiss}:{tone?:AlertTone;title?:string;children?:ReactNode;onDismiss?:()=>void}){
  return <div className={`alert alert-${tone}`} role={tone==='error'?'alert':'status'}>
    <span className="alert-icon"><Icon name={alertIcons[tone]}/></span>
    <div className="alert-body">{title&&<p className="alert-title">{title}</p>}{children&&<div>{children}</div>}</div>
    {onDismiss&&<button type="button" className="alert-dismiss" onClick={onDismiss} aria-label={translate('Dismiss message')}>×</button>}
  </div>;
}

export type Notice={tone:AlertTone;text:string}|null;
export function NoticeBanner({notice,onDismiss}:{notice:Notice;onDismiss?:()=>void}){
  return <div aria-live="polite">{notice&&<Alert tone={notice.tone} onDismiss={onDismiss}>{notice.text}</Alert>}</div>;
}

export function Badge({tone='neutral',children,plain}:{tone?:Tone;children:ReactNode;plain?:boolean}){
  return <span className={`badge badge-${tone}${plain?' badge-plain':''}`}>{children}</span>;
}

export function StatusBadge({kind,value}:{kind:'reservation'|'hotel'|'room';value:string}){
  const meta=statusMeta(kind,value);
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function EmptyState({icon='info',title,children,action,headingLevel=2}:{icon?:IconName;title:string;children?:ReactNode;action?:ReactNode;headingLevel?:2|3}){
  const Heading=headingLevel===2?'h2':'h3';
  return <div className="empty-state"><div className="empty-state-icon"><Icon name={icon} size={24}/></div><Heading>{title}</Heading>{children&&<p>{children}</p>}{action}</div>;
}

/** Shown instead of guest-only pages to administrator and staff-only accounts, which the API refuses with 403. */
export function GuestOnlyNotice({task}:{task:string}){
  return <EmptyState icon="building" title={translate('This account manages StayEase')} action={<a className="btn btn-primary" href="/dashboard">{translate('Go to Workspace')}</a>}>
    {translate('You’re signed in with an administrator account, which can’t book stays or list hotels. To {task}, sign out and use a guest account.',{task})}
  </EmptyState>;
}

export function Loading({label}:{label?:string}){
  return <div className="loading-block" role="status"><span className="spinner" aria-hidden="true"/>{label??translate('Loading…')}</div>;
}

export function Spinner(){return <span className="spinner" aria-hidden="true"/>;}

export function PageHeader({eyebrow,title,description,actions}:{eyebrow?:string;title:string;description?:ReactNode;actions?:ReactNode}){
  return <header className="page-header"><div>{eyebrow&&<p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description&&<p>{description}</p>}</div>{actions&&<div className="cluster">{actions}</div>}</header>;
}

export function Breadcrumbs({items}:{items:{label:string;href?:string}[]}){
  return <nav aria-label={translate('Breadcrumb')}><ol className="breadcrumb">{items.map((item,i)=><li key={item.label}>{item.href&&i<items.length-1?<a href={item.href}>{item.label}</a>:<span aria-current="page">{item.label}</span>}</li>)}</ol></nav>;
}

export function Skeleton({height=16,width='100%',radius}:{height?:number|string;width?:number|string;radius?:number}){
  return <div className="skeleton" style={{height,width,borderRadius:radius}} aria-hidden="true"/>;
}

/** Arrow/Home/End keys move between tabs in a role="tablist", per the WAI-ARIA tabs pattern. */
export function onTabListKeyDown(event:KeyboardEvent<HTMLElement>){
  const tabs=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]'));
  const index=tabs.indexOf(document.activeElement as HTMLElement);
  if(index<0)return;
  const next={ArrowRight:index+1,ArrowLeft:index-1,Home:0,End:tabs.length-1}[event.key];
  if(next===undefined)return;
  event.preventDefault();
  const target=tabs[(next+tabs.length)%tabs.length];
  target.focus();target.click();
}
