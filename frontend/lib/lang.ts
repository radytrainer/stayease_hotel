import { KM } from './i18n-km';

/** Interface languages. English text is the translation key, so a missing Khmer entry falls back to English. */
export type Lang='en'|'km';
export const LANG_COOKIE='stayease-lang';
export const LOCALES:Record<Lang,string>={en:'en-GB',km:'km-KH'};

/**
 * The active language for plain helpers (dates, plurals, place names) that run outside React. The provider sets
 * it on every render, so it always matches the tree being rendered.
 */
let current:Lang='en';
export function getLang():Lang{return current;}
export function setCurrentLang(lang:Lang){current=lang;}

/** Translates an English source string, filling {name} placeholders. */
export function translate(text:string,vars?:Record<string,string|number>,lang:Lang=current){
  let out=lang==='km'?(KM[text]??text):text;
  if(vars)for(const [k,v] of Object.entries(vars))out=out.split(`{${k}}`).join(String(v));
  return out;
}

/**
 * Server messages are written in English for end users. Exact ones come from the dictionary; the few that carry
 * a value (a date, a number, a code) are matched by pattern so the value survives translation.
 */
const SERVER_PATTERNS:{re:RegExp;km:(m:RegExpMatchArray)=>string}[]=[
  {re:/^This code can be used from (.+)$/,km:m=>`កូដនេះអាចប្រើបានចាប់ពី ${m[1]}`},
  {re:/^This code expired on (.+)$/,km:m=>`កូដនេះបានផុតកំណត់នៅ ${m[1]}`},
  {re:/^This code needs a stay of at least (\d+) nights$/,km:m=>`កូដនេះតម្រូវឱ្យស្នាក់នៅយ៉ាងហោចណាស់ ${m[1]} យប់`},
  {re:/^This code can’t be used for prices in (\w+)$/,km:m=>`កូដនេះមិនអាចប្រើសម្រាប់តម្លៃជា ${m[1]} បានទេ`},
  {re:/^This code can’t be used for prices in (\w+)\.$/,km:m=>`កូដនេះមិនអាចប្រើសម្រាប់តម្លៃជា ${m[1]} បានទេ។`},
  {re:/^This hotel already has a code (.+)$/,km:m=>`សណ្ឋាគារនេះមានកូដ ${m[1]} រួចហើយ`},
  {re:/^A platform promotion already has a code (.+)$/,km:m=>`មានប្រូម៉ូសិនទូទាំងប្រព័ន្ធដែលប្រើកូដ ${m[1]} រួចហើយ`},
  {re:/^Too many attempts\. Please wait (\d+) minutes? and try again\.?$/,km:m=>`ព្យាយាមច្រើនដងពេក។ សូមរង់ចាំ ${m[1]} នាទី រួចព្យាយាមម្ដងទៀត។`},
];
export function translateServer(message:string,lang:Lang=current){
  if(lang!=='km'||!message)return message;
  if(KM[message])return KM[message];
  for(const p of SERVER_PATTERNS){const m=message.match(p.re);if(m)return p.km(m);}
  return message;
}
