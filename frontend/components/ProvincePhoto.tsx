const photoPosition:Record<string,number>={
  'Phnom Penh':0,'Siem Reap':1,Kampot:2,'Preah Sihanouk':3,Battambang:4,Kep:5,'Koh Kong':6,Mondulkiri:7,
  'Banteay Meanchey':8,'Kampong Cham':9,'Kampong Chhnang':10,'Kampong Speu':11,'Kampong Thom':12,Kandal:13,
  'Oddar Meanchey':14,Pailin:15,'Preah Vihear':16,'Prey Veng':17,Pursat:18,Ratanakiri:19,'Stung Treng':20,
  'Svay Rieng':21,Takeo:22,'Tbong Khmum':23,Kratie:24,
};

export default function ProvincePhoto({city,eager=false}:{city:string;eager?:boolean}){
  const name=city.replace(/\s*\(.+\)$/,'');
  const index=photoPosition[name]??4;
  const column=index%5;
  const row=Math.floor(index/5);
  return <span aria-hidden="true" className="absolute inset-0 overflow-hidden">
    <img
      src="/images/province-photo-grid.png"
      alt=""
      loading={eager?'eager':'lazy'}
      className="absolute left-0 top-0 max-w-none"
      style={{width:'500%',transform:`translate(${-column*20}%,${-(row*20+2)}%)`}}
    />
  </span>;
}
