import { themeFor, type Theme } from '../lib/cambodia';

const photoPools:Record<Theme,number[]>={
  city:[1,0,7,14,15],
  temple:[2,3,12,13,14,15],
  river:[4,5,6,7,13,14,15],
  beach:[8,9,10,11,4,14],
  hills:[11,10,13,4,14,15],
  countryside:[13,12,7,15,14],
};

/** A generated, photo-realistic fallback for hotel cards without property photos. */
export default function HotelPhoto({city,variant=0}:{city:string;variant?:number}){
  const pool=photoPools[themeFor(city)];
  const index=pool[variant%pool.length];
  const column=index%4;
  const row=Math.floor(index/4);
  return <span aria-hidden="true" className="absolute inset-0 overflow-hidden">
    <img
      src="/images/hotel-photo-grid.png"
      alt=""
      loading="lazy"
      className="absolute left-0 top-0 max-w-none"
      style={{width:'400%',height:'auto',transform:`translate(${-column*25}%,-${row*25+1}%)`}}
    />
  </span>;
}
