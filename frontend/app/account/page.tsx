import { redirect } from 'next/navigation';

/** Sign-in moved to /signin; keep older /account links working. */
export default async function AccountPage({searchParams}:{searchParams:Promise<{[key:string]:string|string[]|undefined}>}) {
  const query=new URLSearchParams();
  for(const [key,value] of Object.entries(await searchParams)) for(const v of [value].flat()) if(v!==undefined) query.append(key,v);
  redirect(query.size?`/signin?${query}`:'/signin');
}
