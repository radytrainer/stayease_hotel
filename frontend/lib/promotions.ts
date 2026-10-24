import { formatMoney } from './format';
import { translate } from './lang';

export type PromoTheme='GENERAL'|'KHMER_NEW_YEAR'|'PCHUM_BEN'|'WATER_FESTIVAL'|'INTERNATIONAL_NEW_YEAR'|'GREEN_SEASON'|'HIGH_SEASON';
export type FeaturedPromo={code:string;headline:string|null;description:string|null;discountType:'PERCENT'|'FIXED';discountValue:number;currency:string|null;endsOn:string|null;minNights:number;theme:PromoTheme};

/** Occasion names and banner colours; dark enough for white text (4.5:1 or better). */
export const PROMO_THEMES:Record<PromoTheme,{label:string;from:string;to:string}>={
  GENERAL:{label:'Special offer',from:'#0b3d39',to:'#13766b'},
  KHMER_NEW_YEAR:{label:'Khmer New Year',from:'#7a2e0e',to:'#b4541a'},
  PCHUM_BEN:{label:'Pchum Ben',from:'#4a1d3d',to:'#7c3164'},
  WATER_FESTIVAL:{label:'Water Festival',from:'#0c3a66',to:'#1b5a8c'},
  INTERNATIONAL_NEW_YEAR:{label:'New Year',from:'#1e1b4b',to:'#3730a3'},
  GREEN_SEASON:{label:'Green season',from:'#14532d',to:'#17683f'},
  HIGH_SEASON:{label:'High season',from:'#7c2d12',to:'#a65a1f'},
};

/** The code a guest chose from an advert, carried to the hotel page they open next. */
export const PROMO_STORAGE_KEY='stayease-promo';
export function rememberPromo(code:string){try{sessionStorage.setItem(PROMO_STORAGE_KEY,code);}catch{}}
export function rememberedPromo(){try{return sessionStorage.getItem(PROMO_STORAGE_KEY)||'';}catch{return '';}}

export function promoValue(p:{discountType:'PERCENT'|'FIXED';discountValue:number;currency:string|null}){
  return translate('{amount} off',{amount:p.discountType==='PERCENT'?`${Number(p.discountValue)}%`:formatMoney(p.discountValue,p.currency??'USD')});
}
