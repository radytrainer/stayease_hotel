const TOKEN_KEY='stayease-token';
const ROLES_KEY='stayease-roles';
const PROFILE_KEY='stayease-profile';

export function getToken():string|null{try{return sessionStorage.getItem(TOKEN_KEY);}catch{return null;}}
export function setToken(token:string){sessionStorage.setItem(TOKEN_KEY,token);}
export function clearToken(){try{sessionStorage.removeItem(TOKEN_KEY);sessionStorage.removeItem(ROLES_KEY);sessionStorage.removeItem(PROFILE_KEY);}catch{}}

/** Roles are cached only to decide which navigation to show; the API enforces every permission. */
export function getRoles():string[]{try{return JSON.parse(sessionStorage.getItem(ROLES_KEY)||'[]');}catch{return [];}}
export function setRoles(roles:string[]){try{sessionStorage.setItem(ROLES_KEY,JSON.stringify(roles));}catch{}}
export function isStaff(roles:string[]){return roles.some(role=>role!=='GUEST');}
/** Booking and hotel listing need the GUEST role; admin-only accounts don't have it. Unknown roles count as a guest. */
export function canBook(roles:string[]){return roles.length===0||roles.includes('GUEST');}

export type SessionProfile={name:string;email:string;roles:string[]};
/** Display-only copy of the signed-in profile for the menu bar; refreshed whenever /auth/me is loaded. */
export function getProfile():SessionProfile|null{try{return JSON.parse(sessionStorage.getItem(PROFILE_KEY)||'null');}catch{return null;}}
export function setProfile(profile:{fullName?:string;email:string;roles:string[]}){
  try{sessionStorage.setItem(PROFILE_KEY,JSON.stringify({name:profile.fullName||profile.email,email:profile.email,roles:profile.roles}));}catch{}
  setRoles(profile.roles);
  window.dispatchEvent(new Event('stayease-profile'));
}

/** Only same-origin paths are accepted so a crafted sign-in link cannot forward users to another site. */
export function safeReturnTo(raw:string|null|undefined,origin:string):string|null{
  if(!raw||!raw.startsWith('/')||raw.startsWith('//')||raw.startsWith('/\\'))return null;
  try{const url=new URL(raw,origin);return url.origin===origin?url.pathname+url.search+url.hash:null;}catch{return null;}
}

export function signInUrl(returnTo?:string,message?:string){
  const query=new URLSearchParams();
  if(returnTo)query.set('returnTo',returnTo);
  if(message)query.set('message',message);
  return query.size?`/signin?${query}`:'/signin';
}

/** Sends visitors without a session to sign-in and returns false so the caller can stop. */
export function requireSession():boolean{
  if(getToken())return true;
  window.location.assign(signInUrl(window.location.pathname+window.location.search));
  return false;
}
