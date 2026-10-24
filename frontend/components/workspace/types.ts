import type { Notice } from '../ui';

export type Notify=(notice:NonNullable<Notice>)=>void;
export type StaffHotel={id:string;name:string;city:string;country:string;status:string;slug?:string;address?:string;latitude?:number|null;longitude?:number|null};
