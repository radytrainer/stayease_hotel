import type { ReactNode } from 'react';
import { themeFor, type Theme } from '../lib/cambodia';
import { translate } from '../lib/lang';

/**
 * A generated illustration used when a hotel has no uploaded photo. The scene comes from the province's
 * landscape and is varied per hotel by a seed, so every card looks different but the same hotel always
 * looks the same. Purely decorative: real photos uploaded by managers always take priority.
 */

function hash(text:string){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function prng(seed:number){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

type Sky={top:string;bottom:string;sun:string;far:string;near:string;ground:string;water:string;stone:string;night:boolean};
const skies:Sky[]=[
  {top:'#9fd3e6',bottom:'#fbe7c6',sun:'#fff3c4',far:'#a9c7b6',near:'#6f9e83',ground:'#4f7d61',water:'#7fb8c9',stone:'#c2a88a',night:false}, // morning
  {top:'#f6b26b',bottom:'#fde6b5',sun:'#fff1b8',far:'#c99a73',near:'#8f6b4e',ground:'#5f6f45',water:'#e8b27c',stone:'#b8875f',night:false}, // golden hour
  {top:'#6b5b95',bottom:'#f4a582',sun:'#ffd59a',far:'#8a6f8f',near:'#5a4a6b',ground:'#4c5e45',water:'#b98ca0',stone:'#9a7484',night:false}, // dusk
  {top:'#1e2a4a',bottom:'#4b5d8a',sun:'#f4f1de',far:'#3a4a6a',near:'#2a3550',ground:'#1f2a3a',water:'#33456b',stone:'#4a5878',night:true}, // night
];

function SugarPalm({x,y,h,color}:{x:number;y:number;h:number;color:string}){
  const fronds=Array.from({length:11},(_,i)=>{const a=(i/11)*Math.PI*2;const len=h*0.22;return <line key={i} x1={x} y1={y-h} x2={x+Math.cos(a)*len} y2={y-h+Math.sin(a)*len*0.75} stroke={color} strokeWidth={2.6} strokeLinecap="round"/>;});
  return <g><line x1={x} y1={y} x2={x+1} y2={y-h} stroke={color} strokeWidth={2.4}/><circle cx={x} cy={y-h} r={h*0.1} fill={color}/>{fronds}</g>;
}

function Prasat({x,y,w,h,color}:{x:number;y:number;w:number;h:number;color:string}){
  const tiers=5;const parts:ReactNode[]=[];
  for(let i=0;i<tiers;i++){const tw=w*(1-i*0.16);const th=h*0.15;const ty=y-h*0.12-(i+1)*th;parts.push(<rect key={i} x={x-tw/2} y={ty} width={tw} height={th+1} rx={tw*0.18} fill={color}/>);}
  return <g><rect x={x-w*0.62} y={y-h*0.14} width={w*1.24} height={h*0.14} fill={color}/>{parts}<ellipse cx={x} cy={y-h*0.93} rx={w*0.12} ry={h*0.09} fill={color}/></g>;
}

function Building({style,x,y,s,wall,roof,glow}:{style:number;x:number;y:number;s:number;wall:string;roof:string;glow:string}){
  if(style===0){ // Khmer villa: steep layered roof with upturned eaves
    const w=120*s,h=48*s;
    return <g>
      <rect x={x-w/2} y={y-h} width={w} height={h} fill={wall}/>
      <path d={`M${x-w*0.62} ${y-h+2} Q${x-w*0.5} ${y-h-6*s} ${x-w*0.3} ${y-h-26*s} L${x} ${y-h-52*s} L${x+w*0.3} ${y-h-26*s} Q${x+w*0.5} ${y-h-6*s} ${x+w*0.62} ${y-h+2} Z`} fill={roof}/>
      <path d={`M${x-w*0.2} ${y-h-34*s} L${x} ${y-h-62*s} L${x+w*0.2} ${y-h-34*s} Z`} fill={roof} opacity={0.85}/>
      {[-0.32,-0.12,0.12,0.32].map(f=><rect key={f} x={x+w*f-6*s} y={y-h+12*s} width={12*s} height={18*s} rx={2} fill={glow}/>)}
      <rect x={x-9*s} y={y-26*s} width={18*s} height={26*s} fill={roof} opacity={0.9}/>
    </g>;
  }
  if(style===1){ // modern hotel block with a grid of windows
    const w=96*s,h=104*s,cols=5,rows=6;
    return <g>
      <rect x={x-w/2} y={y-h} width={w} height={h} fill={wall}/>
      <rect x={x-w/2-4*s} y={y-h-6*s} width={w+8*s} height={7*s} fill={roof}/>
      {Array.from({length:rows*cols},(_,i)=>{const c=i%cols,r=Math.floor(i/cols);return <rect key={i} x={x-w/2+8*s+c*(w-16*s)/cols} y={y-h+10*s+r*(h-30*s)/rows} width={(w-16*s)/cols-5*s} height={(h-30*s)/rows-6*s} rx={1.5} fill={(c+r)%3===0?glow:roof} opacity={(c+r)%3===0?1:0.55}/>;})}
      <rect x={x-12*s} y={y-16*s} width={24*s} height={16*s} fill={roof}/>
    </g>;
  }
  // bungalow on stilts with a thatched roof
  const w=78*s,h=34*s,post=16*s;
  return <g>
    {[-0.4,-0.1,0.2,0.42].map(f=><rect key={f} x={x+w*f-2*s} y={y-post} width={4*s} height={post} fill={roof}/>)}
    <rect x={x-w/2} y={y-post-h} width={w} height={h} fill={wall}/>
    <path d={`M${x-w*0.64} ${y-post-h+3} L${x} ${y-post-h-36*s} L${x+w*0.64} ${y-post-h+3} Z`} fill={roof}/>
    <rect x={x-w*0.3} y={y-post-h+9*s} width={14*s} height={13*s} fill={glow}/><rect x={x+w*0.1} y={y-post-h+9*s} width={14*s} height={13*s} fill={glow}/>
    <rect x={x-w*0.5-6*s} y={y-post-2*s} width={w+12*s} height={3*s} fill={roof}/>
  </g>;
}

function Backdrop({theme,sky,rand}:{theme:Theme;sky:Sky;rand:()=>number}){
  const horizon=150;
  switch(theme){
    case 'temple':return <g>
      <Prasat x={200+(rand()-0.5)*40} y={horizon} w={46} h={118} color={sky.stone}/>
      <Prasat x={140+(rand()-0.5)*20} y={horizon} w={32} h={82} color={sky.stone}/>
      <Prasat x={260+(rand()-0.5)*20} y={horizon} w={32} h={82} color={sky.stone}/>
      <rect x={0} y={horizon} width={400} height={30} fill={sky.water} opacity={0.75}/>
    </g>;
    case 'city':return <g>{Array.from({length:16},(_,i)=>{const w=18+rand()*22,h=40+rand()*80,x=i*26-10;return <g key={i}><rect x={x} y={horizon-h} width={w} height={h} fill={sky.far}/>{sky.night||rand()>0.5?Array.from({length:Math.floor(h/14)},(_,j)=><rect key={j} x={x+4} y={horizon-h+6+j*14} width={w-8} height={3} fill={sky.sun} opacity={0.35}/>):null}</g>;})}
      <rect x={0} y={horizon} width={400} height={26} fill={sky.water}/></g>;
    case 'beach':return <g>
      <rect x={0} y={horizon-30} width={400} height={60} fill={sky.water}/>
      {Array.from({length:6},(_,i)=><path key={i} d={`M${i*70-20+rand()*20} ${horizon-20+i%3*12} q12 -5 24 0 t24 0`} stroke="#ffffff" strokeOpacity={0.55} strokeWidth={2} fill="none"/>)}
      <path d={`M0 ${horizon+18} Q120 ${horizon+4} 240 ${horizon+14} T400 ${horizon+8} L400 250 L0 250 Z`} fill="#ecd9ad"/>
      <path d={`M300 ${horizon-30} q24 -26 60 -8 l40 8 Z`} fill={sky.far}/>
    </g>;
    case 'river':return <g>
      <path d={`M0 ${horizon-20} Q90 ${horizon-70} 180 ${horizon-24} T400 ${horizon-36} L400 ${horizon} L0 ${horizon} Z`} fill={sky.far}/>
      <rect x={0} y={horizon} width={400} height={34} fill={sky.water}/>
      <path d={`M${60+rand()*200} ${horizon+16} q30 10 70 0 l-8 7 h-54 Z`} fill={sky.near}/>
    </g>;
    case 'hills':return <g>
      <path d={`M0 ${horizon-40} Q80 ${horizon-110} 170 ${horizon-50} T400 ${horizon-70} L400 ${horizon} L0 ${horizon} Z`} fill={sky.far}/>
      <path d={`M0 ${horizon-10} Q120 ${horizon-60} 250 ${horizon-16} T400 ${horizon-28} L400 ${horizon+10} L0 ${horizon+10} Z`} fill={sky.near} opacity={0.9}/>
      {Array.from({length:7},(_,i)=>{const x=20+i*55+rand()*20,y=horizon+6,h=26+rand()*18;return <path key={i} d={`M${x} ${y-h} L${x+9} ${y} L${x-9} ${y} Z`} fill={sky.ground}/>;})}
      <rect x={0} y={horizon-60} width={400} height={18} fill="#ffffff" opacity={0.18}/>
    </g>;
    default:return <g>{Array.from({length:6},(_,i)=><rect key={i} x={0} y={horizon+i*7} width={400} height={4} fill={i%2?sky.near:sky.far} opacity={0.6}/>)}</g>;
  }
}

/** building: 0 = Khmer villa, 1 = modern block, 2 = stilt bungalow, 'none' = landscape only; chosen from the seed when omitted. */
export default function HotelArt({seed,city,className,building}:{seed:string;city:string;className?:string;building?:0|1|2|'none'}){
  const theme=themeFor(city);
  const rand=prng(hash(seed));
  const sky=skies[Math.floor(rand()*skies.length)];
  const style=building??(theme==='city'?1:theme==='beach'||theme==='river'?(rand()<0.6?2:0):Math.floor(rand()*3));
  const wall=['#f3e3c3','#efe6d8','#e9d2b4','#f6ede1'][Math.floor(rand()*4)];
  const roof=['#8c3b2a','#6b4a2f','#2f5d50','#7a5230'][Math.floor(rand()*4)];
  const glow=sky.night?'#ffd77a':'#bfe0ea';
  const sunX=60+rand()*280,sunY=40+rand()*40;
  const palms=Array.from({length:2+Math.floor(rand()*3)},(_,i)=>({x:i%2?330+rand()*60:10+rand()*60,h:60+rand()*50}));
  const id=`sky-${hash(seed)}`;
  return <svg className={className} viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" role="img" aria-label={translate('Illustration of a {setting} setting',{setting:translate(theme)})} focusable="false">
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={sky.top}/><stop offset="1" stopColor={sky.bottom}/></linearGradient></defs>
    <rect width="400" height="250" fill={`url(#${id})`}/>
    <circle cx={sunX} cy={sunY} r={sky.night?14:22} fill={sky.sun} opacity={0.95}/>
    {sky.night&&Array.from({length:18},(_,i)=><circle key={i} cx={rand()*400} cy={rand()*110} r={rand()*1.2+0.4} fill="#fff" opacity={0.8}/>)}
    <Backdrop theme={theme} sky={sky} rand={rand}/>
    <rect x={0} y={theme==='beach'?205:182} width={400} height={80} fill={theme==='beach'?'#e4cc98':sky.ground}/>
    {palms.map((p,i)=><SugarPalm key={i} x={p.x} y={theme==='beach'?212:190} h={p.h} color={sky.night?'#141c2b':'#2f4a35'}/>)}
    {style!=='none'&&<Building style={style} x={200+(rand()-0.5)*90} y={theme==='beach'?210:188} s={0.85+rand()*0.3} wall={sky.night?'#c9b99c':wall} roof={roof} glow={glow}/>}
  </svg>;
}
