import { themeFor, type Theme } from '../lib/cambodia';

export type RoomPhotoCategory='ROOM'|'BATHROOM'|'VIEW'|'EXTERIOR';

const categoryRow:Record<RoomPhotoCategory,number>={ROOM:0,BATHROOM:1,VIEW:2,EXTERIOR:3};
const viewColumns:Record<Theme,number[]>={
  city:[0],
  countryside:[1,2],
  river:[3,1],
  beach:[3],
  hills:[3,1],
  temple:[2,1],
};

function hash(text:string){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}

/** Generated, photo-realistic sample photography for unphotographed hotel and room categories. */
export default function RoomArt({category,seed,city}:{category:RoomPhotoCategory;seed:string;city:string;capacity?:number}){
  const row=categoryRow[category];
  const viewOptions=viewColumns[themeFor(city)];
  const column=category==='VIEW'
    ?viewOptions[hash(`${city}:${seed}:${category}`)%viewOptions.length]
    :hash(`${city}:${seed}:${category}`)%4;
  return <div className="relative size-full overflow-hidden" aria-hidden="true">
    <img
      src="/images/room-photo-grid.png"
      alt=""
      loading="lazy"
      className="absolute left-0 top-0 max-w-none"
      style={{width:'400%',height:'auto',transform:`translate(${-column*25}%,-${row*25+1}%)`}}
    />
  </div>;
}
