import { clearToken, getToken, signInUrl } from './session';
import { translate, translateServer } from './lang';

export const API_URL=process.env.NEXT_PUBLIC_API_URL;

export class ApiError extends Error {
  constructor(message:string,public readonly status:number){super(message);}
}

type Options={method?:string;body?:unknown;auth?:boolean;headers?:Record<string,string>};

const fallbackMessages:Record<number,string>={
  400:'Some details need attention. Check the form and try again.',
  401:'Please sign in to continue.',
  403:'You do not have access to this.',
  404:'We could not find what you were looking for.',
  409:'This changed while you were working. Refresh and try again.',
  429:'Too many attempts. Please wait a few minutes and try again.',
};

/**
 * Calls the StayEase API and returns parsed JSON. Errors carry the server's user-facing detail where one exists.
 * An expired session clears local credentials and returns the user to sign-in, then back to this page.
 */
export async function api<T=unknown>(path:string,{method='GET',body,auth=true,headers={}}:Options={}):Promise<T>{
  if(!API_URL)throw new ApiError(translate('StayEase is not connected to its booking service right now. Please try again later.'),-1);
  const token=auth?getToken():null;
  const isForm=typeof FormData!=='undefined'&&body instanceof FormData;
  let response:Response;
  try{
    response=await fetch(`${API_URL}${path}`,{method,headers:{
      ...(token?{Authorization:`Bearer ${token}`}:{}),
      ...(body!==undefined&&!isForm?{'Content-Type':'application/json'}:{}),
      ...headers},
      body:body===undefined?undefined:isForm?body as FormData:JSON.stringify(body)});
  }catch{throw new ApiError(translate('We could not reach StayEase. Check your connection and try again.'),0);}
  if(response.status===204)return undefined as T;
  const data=await response.json().catch(()=>null);
  if(response.status===401&&token){
    clearToken();
    window.location.assign(signInUrl(window.location.pathname+window.location.search,'session-expired'));
    throw new ApiError(translate('Your session has ended. Please sign in again.'),401);
  }
  if(!response.ok)throw new ApiError(data?.detail?translateServer(data.detail):translate(fallbackMessages[response.status]??'Something went wrong on our side. Please try again.'),response.status);
  return data as T;
}

/** Ends the session on the server (best effort), clears it locally and returns to the home page. */
export async function signOut(){
  try{await api('/auth/session',{method:'DELETE'});}catch{}
  finally{clearToken();window.location.assign('/');}
}

/** Image and asset paths from the API are absolute paths on the API origin. */
export function assetUrl(path:string){
  if(!API_URL)return path;
  try{return new URL(path,API_URL).toString();}catch{return path;}
}

const RETRY_DELAYS_MS=[1000,2000,3000,4000,5000,5000,5000,5000];

/**
 * Retries a read when the API can't be reached at all (status 0), e.g. while it restarts.
 * Real error responses (4xx/5xx) are returned immediately. Only use for safe, repeatable requests.
 */
export async function withRetry<T>(request:()=>Promise<T>,onRetry?:(attempt:number)=>void):Promise<T>{
  for(let attempt=0;;attempt++){
    try{return await request();}
    catch(e){
      if(!(e instanceof ApiError)||e.status!==0||attempt>=RETRY_DELAYS_MS.length)throw e;
      onRetry?.(attempt+1);
      await new Promise(resolve=>setTimeout(resolve,RETRY_DELAYS_MS[attempt]));
    }
  }
}

/** Unsplash serves any width from one URL; other images are served as stored. */
export function imageUrl(path:string,width:number){
  if(path.startsWith('https://images.unsplash.com/')){
    try{const url=new URL(path);url.searchParams.set('w',String(width));url.searchParams.set('q','80');url.searchParams.set('auto','format');url.searchParams.set('fit','crop');return url.toString();}catch{return path;}
  }
  return assetUrl(path);
}

export function errorMessage(error:unknown,fallback='Something went wrong. Please try again.'){
  return error instanceof Error&&error.message?translateServer(error.message):translate(fallback);
}
