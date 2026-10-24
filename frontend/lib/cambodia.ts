import { getLang } from './lang';

/** StayEase lists hotels in Cambodia only. Every province shares one time zone (UTC+7). */
export const COUNTRY='Cambodia';
export const TIMEZONE='Asia/Phnom_Penh';

/**
 * Cambodia's 24 provinces and the capital, Phnom Penh (https://en.wikipedia.org/wiki/Provinces_of_Cambodia).
 * Where the provincial capital has a different name it follows in brackets, so a search for either finds the hotel.
 * These labels are stored as the hotel's city, and the demo seed (db/local) uses exactly the same values.
 */
export const POPULAR_DESTINATIONS=['Siem Reap','Phnom Penh','Preah Sihanouk (Kampong Som, Sihanoukville)','Kampot','Kep','Battambang','Koh Kong','Mondulkiri (Sen Monorom)','Kratie'];
export const OTHER_PROVINCES=['Banteay Meanchey (Serei Saophoan)','Kampong Cham','Kampong Chhnang','Kampong Speu (Chbar Mon)','Kampong Thom (Stung Sen)','Kandal (Ta Khmau)','Oddar Meanchey (Samraong)','Pailin','Preah Vihear','Prey Veng','Pursat','Ratanakiri (Banlung)','Stung Treng','Svay Rieng','Takeo (Doun Kaev)','Tbong Khmum (Suong)'];
export const DESTINATIONS=[...POPULAR_DESTINATIONS,...OTHER_PROVINCES];

/** Short name for buttons, e.g. "Preah Sihanouk (Kampong Som, Sihanoukville)" becomes "Preah Sihanouk". */
export function shortName(destination:string){return destination.replace(/\s*\(.*\)$/,'');}

/** Khmer names of the 24 provinces and the capital, keyed by the English short name. */
export const KHMER_PLACE:Record<string,string>={
  'Phnom Penh':'ភ្នំពេញ','Siem Reap':'សៀមរាប','Preah Sihanouk':'ព្រះសីហនុ','Kampot':'កំពត','Kep':'កែប','Battambang':'បាត់ដំបង',
  'Koh Kong':'កោះកុង','Mondulkiri':'មណ្ឌលគិរី','Kratie':'ក្រចេះ','Banteay Meanchey':'បន្ទាយមានជ័យ','Kampong Cham':'កំពង់ចាម',
  'Kampong Chhnang':'កំពង់ឆ្នាំង','Kampong Speu':'កំពង់ស្ពឺ','Kampong Thom':'កំពង់ធំ','Kandal':'កណ្ដាល','Oddar Meanchey':'ឧត្ដរមានជ័យ',
  'Pailin':'ប៉ៃលិន','Preah Vihear':'ព្រះវិហារ','Prey Veng':'ព្រៃវែង','Pursat':'ពោធិ៍សាត់','Ratanakiri':'រតនគិរី','Stung Treng':'ស្ទឹងត្រែង',
  'Svay Rieng':'ស្វាយរៀង','Takeo':'តាកែវ','Tbong Khmum':'ត្បូងឃ្មុំ',
};
const ENGLISH_PLACE=Object.fromEntries(Object.entries(KHMER_PLACE).map(([en,km])=>[km,en]));

/** A province or city as the guest reads it: Khmer in the Khmer interface, otherwise the English short name. */
export function placeName(destination:string){
  const short=shortName(destination);
  return getLang()==='km'?(KHMER_PLACE[short]??short):short;
}

/** Full label for pickers: the Khmer name, or the English name with its capital, e.g. "Kampot" / "Ratanakiri (Banlung)". */
export function placeLabel(destination:string){return getLang()==='km'?(KHMER_PLACE[shortName(destination)]??destination):destination;}

/** Search matches part of the stored (English) city, so the province name alone is enough; Khmer names are mapped back. */
export function searchTerm(destination:string){
  const short=shortName(destination.trim());
  return ENGLISH_PLACE[short]??short;
}

export type Theme='temple'|'city'|'beach'|'river'|'hills'|'countryside';
const themes:Record<string,Theme>={
  'Siem Reap':'temple','Preah Vihear':'temple','Kampong Thom':'temple','Takeo':'temple','Banteay Meanchey':'temple','Oddar Meanchey':'temple',
  'Phnom Penh':'city',
  'Preah Sihanouk':'beach','Kep':'beach','Koh Kong':'beach',
  'Kampot':'river','Kratie':'river','Stung Treng':'river','Kampong Cham':'river','Kampong Chhnang':'river','Prey Veng':'river','Battambang':'river','Kandal':'river','Svay Rieng':'river','Pursat':'river',
  'Mondulkiri':'hills','Ratanakiri':'hills','Pailin':'hills','Kampong Speu':'hills',
  'Tbong Khmum':'countryside',
};
/** The landscape a province is known for, used for generated hotel illustrations. */
export function themeFor(city:string):Theme{return themes[shortName(city)]??'countryside';}

/** Provinces grouped by the kind of trip, for the Destinations menu. Labels match DESTINATIONS exactly. */
export const DESTINATION_GROUPS:{title:string;theme:Theme;blurb:string;places:string[]}[]=[
  {title:'Temples & heritage',theme:'temple',blurb:'Angkor and ancient sanctuaries',places:['Siem Reap','Preah Vihear','Kampong Thom (Stung Sen)','Takeo (Doun Kaev)','Banteay Meanchey (Serei Saophoan)','Oddar Meanchey (Samraong)']},
  {title:'City & Mekong',theme:'river',blurb:'The capital and river towns',places:['Phnom Penh','Kandal (Ta Khmau)','Kampong Cham','Kratie','Stung Treng','Prey Veng','Tbong Khmum (Suong)','Kampong Chhnang']},
  {title:'Coast & islands',theme:'beach',blurb:'Beaches, crab and pepper country',places:['Preah Sihanouk (Kampong Som, Sihanoukville)','Kep','Kampot','Koh Kong']},
  {title:'Highlands & countryside',theme:'hills',blurb:'Waterfalls, forests and rural life',places:['Mondulkiri (Sen Monorom)','Ratanakiri (Banlung)','Battambang','Pursat','Pailin','Kampong Speu (Chbar Mon)','Svay Rieng']},
];
