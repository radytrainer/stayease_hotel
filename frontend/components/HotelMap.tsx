import Icon from './Icon';
import { translate } from '../lib/lang';
import { placeName } from '../lib/cambodia';

/**
 * Hotel location on an OpenStreetMap embed (no API key), with links to directions. Without a pin, the
 * address links to a map search instead.
 */
export default function HotelMap({name,address,city,latitude,longitude}:{name:string;address:string;city:string;latitude?:number|string|null;longitude?:number|string|null}){
  const lat=latitude==null?null:Number(latitude),lng=longitude==null?null:Number(longitude);
  const fullAddress=`${address}, ${city}, Cambodia`;
  const shownAddress=`${address}, ${placeName(city)}, ${translate('Cambodia')}`;
  if(lat==null||lng==null||Number.isNaN(lat)||Number.isNaN(lng))
    return <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white p-5">
      <p className="flex items-start gap-2 text-sm text-ink"><span className="mt-0.5 text-brand-600"><Icon name="pin" size={18}/></span>{shownAddress}</p>
      <a className="btn btn-secondary btn-sm" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${fullAddress}`)}`} target="_blank" rel="noopener noreferrer">{translate('Search on Google Maps')}</a>
    </div>;

  const d=0.006,box=[lng-d*1.6,lat-d,lng+d*1.6,lat+d].map(v=>v.toFixed(5)).join(',');
  const embed=`https://www.openstreetmap.org/export/embed.html?bbox=${box}&layer=mapnik&marker=${lat.toFixed(6)},${lng.toFixed(6)}`;
  return <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm">
    <iframe title={translate('Map showing the location of {name}',{name})} src={embed} loading="lazy" className="block h-72 w-full border-0" referrerPolicy="no-referrer-when-downgrade"/>
    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
      <p className="flex items-start gap-2 text-sm text-ink"><span className="mt-0.5 text-brand-600"><Icon name="pin" size={18}/></span>{shownAddress}</p>
      <div className="flex flex-wrap gap-2">
        <a className="btn btn-primary btn-sm" href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`} target="_blank" rel="noopener noreferrer">{translate('Get directions')}</a>
        <a className="btn btn-secondary btn-sm" href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`} target="_blank" rel="noopener noreferrer">{translate('Open in OpenStreetMap')}</a>
      </div>
    </div>
    <p className="border-t border-ink/10 px-4 py-2 text-[11px] text-ink-muted">{translate('Map data © OpenStreetMap contributors')}</p>
  </div>;
}
