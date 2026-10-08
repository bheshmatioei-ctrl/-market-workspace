export default async function handler(req,res){
  res.setHeader("Cache-Control","s-maxage=300, stale-while-revalidate=60");
  const series=(req.query.series||"CUUR0000SA0").toString();
  if(!/^[A-Z0-9]{3,30}$/.test(series)) return res.status(400).json({ok:false,error:"invalid_series"});
  const end=new Date().getUTCFullYear(), start=end-1;
  const url="https://api.bls.gov/publicAPI/v2/timeseries/data/"+encodeURIComponent(series)+"?startyear="+start+"&endyear="+end;
  try{
    const r=await fetch(url,{headers:{"User-Agent":"Market-Catalyst-Radar/0.3"}});
    if(!r.ok) return res.status(502).json({ok:false,error:"upstream_http",status:r.status,checkedAt:new Date().toISOString()});
    const j=await r.json();
    const data=j?.Results?.series?.[0]?.data;
    if(!Array.isArray(data)) return res.status(502).json({ok:false,error:"malformed_upstream",checkedAt:new Date().toISOString()});
    return res.status(200).json({ok:true,source:"BLS Public Data API v2",series,checkedAt:new Date().toISOString(),data});
  }catch(e){
    return res.status(502).json({ok:false,error:"upstream_unavailable",checkedAt:new Date().toISOString()});
  }
}