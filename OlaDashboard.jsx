import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

/* ═══════════════════════════════════════════════════════════════
   CONFIG — point to your FastAPI server or use mock data
═══════════════════════════════════════════════════════════════ */
const API_BASE = "http://localhost:8000";
const USE_MOCK  = true; // set false when FastAPI is running

/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS
═══════════════════════════════════════════════════════════════ */
const C = {
  bg:      "#09090b",
  surf:    "#111113",
  card:    "#18181b",
  border:  "#27272a",
  muted:   "#3f3f46",
  dim:     "#52525b",
  sub:     "#a1a1aa",
  text:    "#e4e4e7",
  neon:    "#D7DF23",
  neonLo:  "#D7DF2318",
  neonMd:  "#D7DF2340",
  teal:    "#2DD4BF",
  orange:  "#FB923C",
  rose:    "#FB7185",
  sky:     "#38BDF8",
  violet:  "#A78BFA",
  green:   "#4ADE80",
};
const PIE  = [C.neon, C.teal, C.sky, C.violet, C.orange, C.rose];

/* ═══════════════════════════════════════════════════════════════
   MOCK DATA (from seeded SQLite — values from test run)
═══════════════════════════════════════════════════════════════ */
const MOCK = {
  kpis: {
    total_rides:10500, total_revenue:276815.25, avg_fare:26.36,
    avg_distance:11.70, cancellations:532, avg_rating:4.25, solo_pct:59.6
  },
  yearly:[
    {year:"2009",rides:1154,revenue:30759.85,avg_fare:26.66},
    {year:"2010",rides:1252,revenue:33446.29,avg_fare:26.71},
    {year:"2011",rides:1461,revenue:37291.42,avg_fare:25.52},
    {year:"2012",rides:1930,revenue:50512.71,avg_fare:26.17},
    {year:"2013",rides:1980,revenue:50885.93,avg_fare:25.70},
    {year:"2014",rides:1841,revenue:49147.39,avg_fare:26.70},
    {year:"2015",rides:882, revenue:24771.66,avg_fare:28.09},
  ],
  monthly:[
    {month:"Jan '13",revenue:4132,rides:163},{month:"Feb '13",revenue:3987,rides:158},
    {month:"Mar '13",revenue:4423,rides:175},{month:"Apr '13",revenue:4890,rides:189},
    {month:"May '13",revenue:4201,rides:166},{month:"Jun '13",revenue:4567,rides:181},
    {month:"Jul '13",revenue:3876,rides:153},{month:"Aug '13",revenue:4102,rides:162},
    {month:"Sep '13",revenue:4789,rides:190},{month:"Oct '13",revenue:5123,rides:202},
    {month:"Nov '13",revenue:4654,rides:184},{month:"Dec '13",revenue:4141,rides:157},
    {month:"Jan '14",revenue:3900,rides:152},{month:"Feb '14",revenue:4211,rides:166},
    {month:"Mar '14",revenue:4888,rides:193},{month:"Apr '14",revenue:4323,rides:171},
    {month:"May '14",revenue:4711,rides:186},{month:"Jun '14",revenue:4090,rides:162},
  ],
  hourly: Array.from({length:24},(_,h)=>{
    const w=[3,2,1,1,1,2,6,9,9,7,6,6,7,7,6,6,8,10,10,9,8,7,5,4];
    const base=120+w[h]*55+Math.round(Math.sin(h*0.6)*40);
    return {hour:h<12?`${h||12}${h<1?"am":"am"}`:`${h===12?12:h-12}pm`,
      rides:base, avg_fare:+(24+Math.cos(h*0.4)*5).toFixed(2), hour_num:h};
  }),
  pax:[
    {pax:"1 Pax",rides:6255,revenue:164140,color:C.neon},
    {pax:"2 Pax",rides:1907,revenue:50467, color:C.teal},
    {pax:"3 Pax",rides:748, revenue:18910, color:C.sky},
    {pax:"4 Pax",rides:308, revenue:8082,  color:C.violet},
    {pax:"5 Pax",rides:957, revenue:25762, color:C.orange},
    {pax:"6 Pax",rides:325, revenue:9452,  color:C.rose},
  ],
  fareDist:[
    {range:"$0–5",  trips:620},{range:"$5–10", trips:1840},
    {range:"$10–15",trips:2210},{range:"$15–20",trips:1980},
    {range:"$20–30",trips:1870},{range:"$30+",  trips:1980},
  ],
  zones:[
    {zone:"Downtown",rides:1148,revenue:32540,avg_fare:28.3},
    {zone:"Airport",  rides:1071,revenue:61450,avg_fare:57.4},
    {zone:"CBD",      rides:1098,revenue:29100,avg_fare:26.5},
    {zone:"Midtown",  rides:1082,revenue:28900,avg_fare:26.7},
    {zone:"Suburbs",  rides:1056,revenue:22100,avg_fare:20.9},
    {zone:"Uptown",   rides:1034,revenue:25200,avg_fare:24.4},
    {zone:"Harbor",   rides:1021,revenue:27800,avg_fare:27.2},
    {zone:"Station",  rides:1010,revenue:21400,avg_fare:21.2},
    {zone:"University",rides:987,revenue:19800,avg_fare:20.1},
    {zone:"Industrial",rides:993,revenue:18530,avg_fare:18.7},
  ],
  routes:[
    {route:"Downtown → Airport",  trips:139,avg_fare:57.28,avg_dist:22.4},
    {route:"Airport → Harbor",    trips:134,avg_fare:58.74,avg_dist:23.1},
    {route:"Uptown → Suburbs",    trips:134,avg_fare:25.41,avg_dist:9.8},
    {route:"Suburbs → Station",   trips:133,avg_fare:18.54,avg_dist:7.1},
    {route:"Industrial → Station",trips:141,avg_fare:28.43,avg_dist:10.9},
    {route:"CBD → Midtown",       trips:128,avg_fare:18.20,avg_dist:6.8},
    {route:"Harbor → Downtown",   trips:121,avg_fare:27.90,avg_dist:9.4},
    {route:"University → CBD",    trips:118,avg_fare:22.10,avg_dist:8.3},
  ],
  drivers: Array.from({length:12},(_,i)=>({
    driver_id:`DRV-${1001+i}`,
    name:["Vikram Shah","Rahul Sharma","Kavya Sharma","Rahul Pillai","Rajesh Bose",
          "Anjali Nair","Arjun Kumar","Priya Patel","Deepa Iyer","Sanjay Verma",
          "Neha Gupta","Manoj Reddy"][i],
    rides:[235,234,231,230,230,225,220,218,215,210,205,198][i],
    revenue:[5940,6388,6048,5584,6026,5780,5640,5420,5310,5200,4980,4850][i],
    rating:[4.9,4.8,4.8,4.7,4.8,4.7,4.6,4.6,4.5,4.7,4.5,4.4][i],
    completion_rate:[97,96,95,94,96,93,92,94,91,95,90,88][i],
    trend_pct:[12,8,5,-2,15,-4,9,-1,7,3,-6,11][i],
    zone:["Downtown","Airport","CBD","Midtown","Suburbs","Uptown","Harbor","Station","University","Industrial","CBD","Downtown"][i],
  })),
  rawRides: Array.from({length:500},(_,i)=>{
    const zones=["Downtown","Airport","CBD","Midtown","Suburbs","Uptown","Harbor","Station","University","Industrial"];
    const pz=zones[i%10], dz=zones[(i+3)%10];
    const yr=2009+(i%7), mo=(i%12)+1, dy=(i%28)+1, hr=(i*7)%24;
    const fare=+(8+Math.abs(Math.sin(i*1.7))*60).toFixed(2);
    const dist=+(1+Math.abs(Math.cos(i*1.3))*18).toFixed(2);
    const status=i%15===0?"Cancelled":i%8===0?"Late":"Completed";
    const pax=[1,1,1,1,2,2,3,5][i%8];
    return {
      ride_id:`OLA-${100000+i}`,
      pickup_dt:`${yr}-${String(mo).padStart(2,"0")}-${String(dy).padStart(2,"0")} ${String(hr).padStart(2,"0")}:${String((i*13)%60).padStart(2,"0")}`,
      fare, distance:dist, passenger_count:pax,
      zone:pz, pickup_zone:pz, dropoff_zone:dz,
      status, rating:status==="Cancelled"?null:+(3.5+Math.random()*1.5).toFixed(1),
      driver_id:`DRV-${1001+(i%50)}`,
    };
  }),
};

/* ═══════════════════════════════════════════════════════════════
   API HOOK
═══════════════════════════════════════════════════════════════ */
function useAPI(endpoint, mockKey, params={}) {
  const [data,  setData]  = useState(null);
  const [loading, setLoading] = useState(true);
  const qs = new URLSearchParams(Object.entries(params).filter(([,v])=>v!=null)).toString();

  useEffect(()=>{
    if(USE_MOCK){ setData(MOCK[mockKey]); setLoading(false); return; }
    setLoading(true);
    fetch(`${API_BASE}${endpoint}${qs?"?"+qs:""}`)
      .then(r=>r.json()).then(d=>{ setData(d); setLoading(false); })
      .catch(()=>{ setData(MOCK[mockKey]); setLoading(false); });
  },[endpoint, mockKey, qs]);
  return { data, loading };
}

/* ═══════════════════════════════════════════════════════════════
   SMALL COMPONENTS
═══════════════════════════════════════════════════════════════ */

// Tooltip
const NT = ({ active, payload, label, pre="" }) => {
  if(!active||!payload?.length) return null;
  return (
    <div style={{background:C.card,border:`1px solid ${C.neonMd}`,borderRadius:8,
      padding:"10px 14px",boxShadow:`0 0 20px ${C.neonLo}`,
      fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>
      <p style={{color:C.neon,fontWeight:700,margin:"0 0 5px",letterSpacing:1}}>{label}</p>
      {payload.map((p,i)=>(
        <p key={i} style={{color:p.color||C.text,margin:"2px 0"}}>
          {p.name}: <b style={{color:"#fff"}}>{pre}{typeof p.value==="number"?p.value.toLocaleString():p.value}</b>
        </p>
      ))}
    </div>
  );
};

// KPI Card
const KPI = ({ label, value, sub, delta, color=C.neon, icon }) => (
  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,
    padding:"16px 18px",position:"relative",overflow:"hidden"}}>
    <div style={{position:"absolute",top:-16,right:-16,width:72,height:72,borderRadius:"50%",
      background:`radial-gradient(circle, ${color}20, transparent 70%)`}}/>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
      <span style={{fontSize:18}}>{icon}</span>
      {delta!=null&&(
        <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,
          color:delta>0?C.neon:C.rose,background:delta>0?`${C.neon}15`:`${C.rose}15`,
          padding:"2px 8px",borderRadius:20}}>{delta>0?"+":""}{delta}%</span>
      )}
    </div>
    <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:24,fontWeight:700,
      color,letterSpacing:-1,lineHeight:1.1}}>{value}</div>
    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,color:C.dim,
      letterSpacing:2,textTransform:"uppercase",marginTop:5}}>{label}</div>
    {sub&&<div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:C.muted,marginTop:2}}>{sub}</div>}
  </div>
);

// Bento card
const Card = ({children,style={}}) => (
  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,
    padding:"18px 20px",overflow:"hidden",...style}}>
    {children}
  </div>
);

// Section heading
const H = ({title,sub}) => (
  <div style={{marginBottom:14}}>
    <p style={{margin:0,fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,
      fontWeight:700,color:C.neon,letterSpacing:3,textTransform:"uppercase"}}>{title}</p>
    {sub&&<p style={{margin:"3px 0 0",fontFamily:"'DM Sans',sans-serif",fontSize:11,color:C.dim}}>{sub}</p>}
  </div>
);

// Spinner
const Spin = () => (
  <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",minHeight:120}}>
    <div style={{width:28,height:28,borderRadius:"50%",border:`2px solid ${C.border}`,
      borderTopColor:C.neon,animation:"spin 0.7s linear infinite"}}/>
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   VIRTUAL TABLE
═══════════════════════════════════════════════════════════════ */
const ROW_H = 34, VIS = 14;

function VTable({ data, onDrill }) {
  const [scroll,  setScroll]  = useState(0);
  const [filter,  setFilter]  = useState("");
  const [sort,    setSort]    = useState({k:"pickup_dt",d:-1});
  const [hoverId, setHoverId] = useState(null);

  const filtered = useMemo(()=>{
    let d = filter ? data.filter(r=>Object.values(r).some(v=>String(v).toLowerCase().includes(filter.toLowerCase()))) : data;
    return [...d].sort((a,b)=>(String(a[sort.k])>String(b[sort.k])?1:-1)*sort.d);
  },[data,filter,sort]);

  const start = Math.floor(scroll/ROW_H);
  const end   = Math.min(start+VIS+2, filtered.length);
  const slice = filtered.slice(start, end);

  const cols = [
    {k:"ride_id",      label:"TRIP ID",   w:"14%"},
    {k:"pickup_dt",    label:"DATETIME",  w:"18%"},
    {k:"fare",         label:"FARE",      w:"9%"},
    {k:"distance",     label:"DIST KM",   w:"9%"},
    {k:"passenger_count",label:"PAX",     w:"6%"},
    {k:"pickup_zone",  label:"FROM",      w:"12%"},
    {k:"dropoff_zone", label:"TO",        w:"12%"},
    {k:"status",       label:"STATUS",    w:"11%"},
    {k:"rating",       label:"★",         w:"7%"},
  ];

  const sColor = s => s==="Completed"?C.green:s==="Late"?C.orange:C.rose;

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Controls */}
      <div style={{display:"flex",gap:10,marginBottom:10,alignItems:"center"}}>
        <div style={{position:"relative",flex:1}}>
          <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:C.dim,fontSize:12}}>⌕</span>
          <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Filter by trip ID, zone, status…"
            style={{width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,
              padding:"7px 10px 7px 30px",color:C.text,fontFamily:"'DM Sans',sans-serif",
              fontSize:12,outline:"none",boxSizing:"border-box"}}/>
        </div>
        <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.dim,flexShrink:0}}>
          {filtered.length.toLocaleString()} / {data.length.toLocaleString()} rows
        </span>
      </div>
      {/* Header */}
      <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,paddingBottom:7,marginBottom:1}}>
        {cols.map(c=>(
          <div key={c.k} onClick={()=>setSort(s=>({k:c.k,d:s.k===c.k?-s.d:1}))}
            style={{width:c.w,fontSize:10,color:sort.k===c.k?C.neon:C.dim,cursor:"pointer",
              fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:2,fontWeight:700,
              userSelect:"none",display:"flex",alignItems:"center",gap:2}}>
            {c.label}{sort.k===c.k&&<span style={{fontSize:8}}>{sort.d>0?"▲":"▼"}</span>}
          </div>
        ))}
      </div>
      {/* Virtualized rows */}
      <div style={{flex:1,overflowY:"auto"}} onScroll={e=>setScroll(e.currentTarget.scrollTop)}>
        <div style={{height:filtered.length*ROW_H,position:"relative"}}>
          <div style={{position:"absolute",top:start*ROW_H,width:"100%"}}>
            {slice.map((row,i)=>{
              const isHov = hoverId===row.ride_id;
              return (
                <div key={row.ride_id} onClick={()=>onDrill(row)}
                  onMouseEnter={()=>setHoverId(row.ride_id)}
                  onMouseLeave={()=>setHoverId(null)}
                  style={{display:"flex",alignItems:"center",height:ROW_H,
                    borderBottom:`1px solid ${C.border}30`,cursor:"pointer",
                    background:isHov?C.neonLo:(start+i)%2===0?"transparent":"#ffffff03",
                    transition:"background 0.1s"}}>
                  {cols.map(c=>(
                    <div key={c.k} style={{width:c.w,fontFamily:"'JetBrains Mono',monospace",
                      fontSize:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",paddingRight:6,
                      color: c.k==="ride_id"?C.neon : c.k==="fare"?C.teal :
                             c.k==="status"?sColor(row.status) :
                             c.k==="rating"?C.orange : C.text}}>
                      {c.k==="fare"?`$${row[c.k]}` : c.k==="distance"?`${row[c.k]} km` :
                       c.k==="rating"?row[c.k]??"-" : row[c.k]}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DRILL-THROUGH MODAL
═══════════════════════════════════════════════════════════════ */
function DrillModal({ row, onClose }) {
  if(!row) return null;
  const zoneData = MOCK.zones.find(z=>z.zone===row.pickup_zone);
  const routeTrips = MOCK.rawRides.filter(r=>r.pickup_zone===row.pickup_zone&&r.dropoff_zone===row.dropoff_zone).slice(0,20);

  return (
    <div style={{position:"fixed",inset:0,background:"#000000cc",zIndex:200,
      display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onClose}>
      <div style={{background:C.card,border:`1px solid ${C.neonMd}`,borderRadius:16,
        padding:28,width:580,maxHeight:"82vh",overflowY:"auto",
        boxShadow:`0 0 60px ${C.neonLo}`}} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
          <div>
            <h2 style={{margin:0,fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,
              color:C.neon,letterSpacing:2}}>DRILL-THROUGH · {row.ride_id}</h2>
            <p style={{margin:"4px 0 0",fontFamily:"'DM Sans',sans-serif",fontSize:12,color:C.dim}}>
              {row.pickup_zone} → {row.dropoff_zone} · {row.pickup_dt}
            </p>
          </div>
          <button onClick={onClose} style={{background:"none",border:`1px solid ${C.border}`,
            borderRadius:6,color:C.sub,cursor:"pointer",padding:"5px 12px",
            fontFamily:"'DM Sans',sans-serif",fontSize:12}}>✕</button>
        </div>

        {/* Trip metrics */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:18}}>
          {[
            {label:"Fare",      value:`$${row.fare}`,    color:C.teal},
            {label:"Distance",  value:`${row.distance}km`,color:C.sky},
            {label:"Passengers",value:row.passenger_count,color:C.neon},
            {label:"Rating",    value:row.rating??"-",   color:C.orange},
          ].map(m=>(
            <div key={m.label} style={{background:C.bg,border:`1px solid ${C.border}`,
              borderRadius:8,padding:"12px 14px"}}>
              <div style={{fontSize:9,color:C.dim,fontFamily:"'Barlow Condensed',sans-serif",
                letterSpacing:2,textTransform:"uppercase"}}>{m.label}</div>
              <div style={{fontSize:22,fontWeight:700,color:m.color,fontFamily:"'JetBrains Mono',monospace",marginTop:3}}>
                {m.value}
              </div>
            </div>
          ))}
        </div>

        {/* Status badge */}
        <div style={{marginBottom:18,display:"flex",gap:10,alignItems:"center"}}>
          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,color:C.dim,letterSpacing:2}}>STATUS</span>
          <span style={{
            background:row.status==="Completed"?`${C.green}20`:row.status==="Late"?`${C.orange}20`:`${C.rose}20`,
            color:row.status==="Completed"?C.green:row.status==="Late"?C.orange:C.rose,
            border:`1px solid currentColor`,borderRadius:20,padding:"3px 12px",
            fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>
            {row.status}
          </span>
          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,color:C.dim,letterSpacing:2,marginLeft:8}}>DRIVER</span>
          <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:C.neon}}>{row.driver_id}</span>
        </div>

        {/* Zone summary */}
        {zoneData && (
          <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,
            padding:"12px 16px",marginBottom:18}}>
            <p style={{margin:"0 0 8px",fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,
              color:C.dim,letterSpacing:2}}>PICKUP ZONE SUMMARY · {row.pickup_zone}</p>
            <div style={{display:"flex",gap:20}}>
              {[{k:"rides",v:zoneData.rides.toLocaleString(),l:"Total Rides"},
                {k:"revenue",v:`$${zoneData.revenue.toLocaleString()}`,l:"Zone Revenue"},
                {k:"avg_fare",v:`$${zoneData.avg_fare}`,l:"Avg Fare"},
              ].map(s=>(
                <div key={s.k}>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:16,fontWeight:700,color:C.neon}}>{s.v}</div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:C.dim}}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Route fare mini-chart */}
        <H title={`Route Fares · ${row.pickup_zone} → ${row.dropoff_zone}`} sub={`${routeTrips.length} sample trips`}/>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={routeTrips.slice(0,16)} barSize={12}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
            <XAxis dataKey="ride_id" tick={false} axisLine={false} tickLine={false}/>
            <YAxis tickFormatter={v=>`$${v}`} tick={{fill:C.dim,fontSize:9}} axisLine={false} tickLine={false}/>
            <Tooltip content={<NT pre="$"/>}/>
            <Bar dataKey="fare" name="Fare" fill={C.neon} radius={[3,3,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAP PLACEHOLDER
═══════════════════════════════════════════════════════════════ */
function MapViz({ activeZone, zones }) {
  const pos = [
    {z:"Downtown",  t:"45%", l:"47%"},
    {z:"Airport",   t:"12%", l:"74%"},
    {z:"CBD",       t:"40%", l:"54%"},
    {z:"Midtown",   t:"55%", l:"62%"},
    {z:"Suburbs",   t:"72%", l:"28%"},
    {z:"Uptown",    t:"25%", l:"34%"},
    {z:"Harbor",    t:"76%", l:"70%"},
    {z:"Station",   t:"32%", l:"60%"},
    {z:"University",t:"20%", l:"45%"},
    {z:"Industrial",t:"65%", l:"20%"},
  ];
  return (
    <div style={{position:"relative",width:"100%",height:"100%",borderRadius:10,overflow:"hidden",
      background:"linear-gradient(160deg, #0a1a0a 0%, #050d05 60%, #0c170c 100%)"}}>
      <svg style={{position:"absolute",inset:0,width:"100%",height:"100%"}}>
        {/* Grid */}
        {Array.from({length:10},(_,i)=>(
          <g key={i} opacity="0.08">
            <line x1={`${i*11}%`} y1="0" x2={`${i*11}%`} y2="100%" stroke={C.neon} strokeWidth="0.5"/>
            <line x1="0" y1={`${i*11}%`} x2="100%" y2={`${i*11}%`} stroke={C.neon} strokeWidth="0.5"/>
          </g>
        ))}
        {/* Roads */}
        <path d="M 15% 50% Q 50% 25% 85% 48%" stroke={C.neon} strokeWidth="1.2" fill="none" opacity="0.3"/>
        <path d="M 48% 8% L 50% 92%" stroke={C.teal} strokeWidth="0.8" fill="none" opacity="0.25"/>
        <path d="M 8% 72% Q 45% 78% 92% 68%" stroke={C.sky} strokeWidth="0.8" fill="none" opacity="0.2"/>
        <path d="M 20% 30% Q 60% 55% 80% 70%" stroke={C.violet} strokeWidth="0.8" fill="none" opacity="0.2"/>
      </svg>
      {pos.map(p=>{
        const z = zones?.find(zd=>zd.zone===p.z);
        const isActive = p.z===activeZone;
        const size = z ? 4 + z.rides/300 : 6;
        return (
          <div key={p.z} style={{position:"absolute",top:p.t,left:p.l,transform:"translate(-50%,-50%)"}}>
            {isActive && (
              <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",
                width:size*5,height:size*5,borderRadius:"50%",
                background:`radial-gradient(circle, ${C.neon}30, transparent 70%)`,
                animation:"ping 1.5s ease-out infinite"}}/>
            )}
            <div style={{width:isActive?size*2:size,height:isActive?size*2:size,borderRadius:"50%",
              background:isActive?C.neon:C.teal+"70",
              boxShadow:isActive?`0 0 10px ${C.neon}, 0 0 20px ${C.neon}50`:"none",
              border:`1px solid ${isActive?C.neon:C.teal}60`,transition:"all 0.3s"}}/>
            {isActive && (
              <div style={{position:"absolute",top:-22,left:"50%",transform:"translateX(-50%)",
                background:C.card,border:`1px solid ${C.neon}`,borderRadius:4,
                padding:"2px 7px",fontSize:9,color:C.neon,whiteSpace:"nowrap",
                fontFamily:"'JetBrains Mono',monospace",zIndex:5}}>
                {p.z}
              </div>
            )}
          </div>
        );
      })}
      <div style={{position:"absolute",bottom:8,left:10,fontFamily:"'JetBrains Mono',monospace",
        fontSize:9,color:C.dim,letterSpacing:1}}>📍 ZONE HEATMAP · {zones?.length||0} ZONES</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE: OVERVIEW
═══════════════════════════════════════════════════════════════ */
function PageOverview({ yearFilter }) {
  const { data: kpis }   = useAPI("/api/kpis",            "kpis",   { year: yearFilter });
  const { data: yearly } = useAPI("/api/revenue/yearly",  "yearly");
  const { data: hourly } = useAPI("/api/rides/hourly",    "hourly", { year: yearFilter });
  const { data: fare }   = useAPI("/api/revenue/fare-distribution","fareDist");

  const filtYear = yearFilter && yearly ? yearly.filter(y=>y.year===String(yearFilter)) : yearly;

  return (
    <div>
      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:12,marginBottom:14}}>
        {kpis ? [
          {label:"Total Revenue",  value:`$${(kpis.total_revenue/1000).toFixed(0)}K`,  delta:5,  color:C.neon,   icon:"💰",sub:"All time"},
          {label:"Total Rides",    value:kpis.total_rides?.toLocaleString(),            delta:3,  color:C.teal,   icon:"🚗",sub:"Cleaned records"},
          {label:"Avg Fare",       value:`$${kpis.avg_fare}`,                           delta:8,  color:C.sky,    icon:"🏷️",sub:"Per ride"},
          {label:"Avg Distance",   value:`${kpis.avg_distance} km`,                    delta:-1, color:C.violet, icon:"📍",sub:"Haversine"},
          {label:"Cancellations",  value:kpis.cancellations?.toLocaleString(),          delta:-5, color:C.rose,   icon:"❌",sub:"5.1% of total"},
          {label:"Avg Rating",     value:`★ ${kpis.avg_rating}`,                       delta:2,  color:C.orange, icon:"⭐",sub:"Passenger score"},
          {label:"Solo Rides",     value:`${kpis.solo_pct}%`,                          delta:1,  color:C.green,  icon:"👤",sub:"Single pax"},
        ].map(k=><KPI key={k.label} {...k}/>) : Array.from({length:7},(_,i)=>(
          <div key={i} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:16}}>
            <Spin/>
          </div>
        ))}
      </div>

      {/* Bento grid row 1 */}
      <div style={{display:"grid",gridTemplateColumns:"7fr 5fr",gap:14,marginBottom:14}}>
        <Card>
          <H title="Annual Revenue & Ride Volume" sub={yearFilter?`Filtered: ${yearFilter}`:"All years 2009–2015"}/>
          <ResponsiveContainer width="100%" height={230}>
            <ComposedChart data={filtYear||[]}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="year" tick={{fill:C.dim,fontSize:11,fontFamily:"JetBrains Mono"}} axisLine={false} tickLine={false}/>
              <YAxis yAxisId="r" orientation="left"  tick={{fill:C.dim,fontSize:10}} tickFormatter={v=>`$${(v/1000).toFixed(0)}K`} axisLine={false} tickLine={false}/>
              <YAxis yAxisId="t" orientation="right" tick={{fill:C.dim,fontSize:10}} axisLine={false} tickLine={false}/>
              <Tooltip content={<NT/>}/>
              <Legend wrapperStyle={{fontSize:11,color:C.sub}}/>
              <Bar yAxisId="r" dataKey="revenue" name="Revenue ($)" fill={C.neon} radius={[5,5,0,0]} maxBarSize={44}/>
              <Line yAxisId="t" type="monotone" dataKey="rides" name="Rides" stroke={C.teal} strokeWidth={2.5} dot={{fill:C.teal,r:4}} activeDot={{r:6}}/>
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <H title="Fare Distribution" sub="Trips by fare bracket"/>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={fare||[]} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false}/>
              <XAxis type="number" tick={{fill:C.dim,fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis dataKey="range" type="category" tick={{fill:C.sub,fontSize:11,fontFamily:"JetBrains Mono"}} axisLine={false} tickLine={false} width={52}/>
              <Tooltip content={<NT/>}/>
              <Bar dataKey="trips" name="Trips" radius={[0,5,5,0]}>
                {(fare||[]).map((_,i)=><Cell key={i} fill={PIE[i%PIE.length]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Bento grid row 2 */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <Card>
          <H title="Hourly Demand Pattern" sub="Rides per hour of day"/>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={hourly||[]}>
              <defs>
                <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.neon} stopOpacity={0.35}/>
                  <stop offset="95%" stopColor={C.neon} stopOpacity={0.02}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="hour" tick={{fill:C.dim,fontSize:10,fontFamily:"JetBrains Mono"}} axisLine={false} tickLine={false} interval={3}/>
              <YAxis tick={{fill:C.dim,fontSize:10}} axisLine={false} tickLine={false}/>
              <Tooltip content={<NT/>}/>
              <Area type="monotone" dataKey="rides" name="Rides" stroke={C.neon} fill="url(#hg)" strokeWidth={2} dot={false} activeDot={{r:4,fill:C.neon}}/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <H title="Avg Fare by Hour" sub="Pricing pattern overlay"/>
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={hourly||[]}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="hour" tick={{fill:C.dim,fontSize:10,fontFamily:"JetBrains Mono"}} axisLine={false} tickLine={false} interval={3}/>
              <YAxis tickFormatter={v=>`$${v}`} tick={{fill:C.dim,fontSize:10}} axisLine={false} tickLine={false}/>
              <Tooltip content={<NT pre="$"/>}/>
              <Line type="monotone" dataKey="avg_fare" name="Avg Fare" stroke={C.orange} strokeWidth={2.5} dot={false} activeDot={{r:5,fill:C.orange}}/>
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE: REVENUE
═══════════════════════════════════════════════════════════════ */
function PageRevenue({ yearFilter }) {
  const { data: monthly } = useAPI("/api/revenue/monthly","monthly",{ year: yearFilter||2013 });
  const { data: pax }     = useAPI("/api/revenue/by-pax", "pax");
  const { data: yearly }  = useAPI("/api/revenue/yearly", "yearly");

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"8fr 4fr",gap:14,marginBottom:14}}>
        <Card>
          <H title="Monthly Revenue Trend" sub={`Year: ${yearFilter||"2013–2014 sample"}`}/>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={monthly||[]}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="month" tick={{fill:C.dim,fontSize:10,fontFamily:"JetBrains Mono"}} axisLine={false} tickLine={false} interval={1}/>
              <YAxis yAxisId="r" orientation="left"  tick={{fill:C.dim,fontSize:10}} tickFormatter={v=>`$${(v/1000).toFixed(1)}K`} axisLine={false} tickLine={false}/>
              <YAxis yAxisId="t" orientation="right" tick={{fill:C.dim,fontSize:10}} axisLine={false} tickLine={false}/>
              <Tooltip content={<NT/>}/>
              <Legend wrapperStyle={{fontSize:11,color:C.sub}}/>
              <Bar yAxisId="r" dataKey="revenue" name="Revenue" fill={C.neon} radius={[4,4,0,0]} maxBarSize={24}/>
              <Line yAxisId="t" type="monotone" dataKey="rides" name="Rides" stroke={C.violet} strokeWidth={2} dot={false}/>
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <H title="Revenue by Pax" sub="Donut breakdown"/>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pax||[]} dataKey="revenue" nameKey="pax" cx="50%" cy="50%"
                outerRadius={88} innerRadius={50} paddingAngle={3}>
                {(pax||[]).map((d,i)=><Cell key={i} fill={d.color||PIE[i]}/>)}
              </Pie>
              <Tooltip formatter={v=>[`$${v.toLocaleString()}`,"Revenue"]}
                contentStyle={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8}}/>
              <Legend wrapperStyle={{fontSize:11,color:C.sub}}/>
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <Card>
          <H title="Avg Fare by Year" sub="Revenue efficiency trajectory"/>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={yearly||[]}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="year" tick={{fill:C.dim,fontSize:11,fontFamily:"JetBrains Mono"}} axisLine={false} tickLine={false}/>
              <YAxis tickFormatter={v=>`$${v}`} tick={{fill:C.dim,fontSize:10}} axisLine={false} tickLine={false}/>
              <Tooltip content={<NT pre="$"/>}/>
              <Line type="monotone" dataKey="avg_fare" name="Avg Fare" stroke={C.orange} strokeWidth={3} dot={{fill:C.orange,r:5}} activeDot={{r:7}}/>
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <H title="Revenue Highlights" sub="Key financial metrics"/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {[
              {label:"Peak Year",   value:"2013",    sub:"$50,885 revenue",   color:C.neon},
              {label:"Best Month",  value:"Oct '13", sub:"$5,123 revenue",    color:C.teal},
              {label:"Top Route",   value:"Airport", sub:"$57 avg fare",      color:C.sky},
              {label:"Solo Share",  value:"59.6%",   sub:"6,255 rides",       color:C.violet},
              {label:"YoY Growth",  value:"+35.5%",  sub:"2011 → 2012",       color:C.orange},
              {label:"Group Rev",   value:"$62K",    sub:"Pax 2–6 combined",  color:C.rose},
            ].map(k=>(
              <div key={k.label} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 14px"}}>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:19,fontWeight:700,color:k.color}}>{k.value}</div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:9,color:C.dim,letterSpacing:2,marginTop:3,textTransform:"uppercase"}}>{k.label}</div>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:C.muted,marginTop:1}}>{k.sub}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE: BOOKINGS
═══════════════════════════════════════════════════════════════ */
function PageBookings() {
  const [activeZone, setActiveZone] = useState("Downtown");
  const { data: zones }  = useAPI("/api/rides/by-zone","zones");
  const { data: hourly } = useAPI("/api/rides/hourly", "hourly");
  const { data: pax }    = useAPI("/api/revenue/by-pax","pax");
  const { data: routes } = useAPI("/api/routes/top",   "routes");

  return (
    <div>
      {/* Row 1: Hourly + Map */}
      <div style={{display:"grid",gridTemplateColumns:"8fr 4fr",gap:14,marginBottom:14}}>
        <Card>
          <H title="Hourly Demand · Avg Fare Overlay" sub="Bars = rides · Line = avg fare"/>
          <ResponsiveContainer width="100%" height={230}>
            <ComposedChart data={hourly||[]} onClick={d=>d?.activePayload?.[0]&&setActiveZone(["Downtown","CBD","Midtown","Airport"][(d.activeLabel?.charCodeAt(0)||0)%4])}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="hour" tick={{fill:C.dim,fontSize:10,fontFamily:"JetBrains Mono"}} axisLine={false} tickLine={false}/>
              <YAxis yAxisId="a" orientation="left"  tick={{fill:C.dim,fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis yAxisId="b" orientation="right" tickFormatter={v=>`$${v}`} tick={{fill:C.dim,fontSize:10}} axisLine={false} tickLine={false}/>
              <Tooltip content={<NT/>}/>
              <Legend wrapperStyle={{fontSize:11,color:C.sub}}/>
              <Bar yAxisId="a" dataKey="rides"    name="Rides"    fill={C.teal}   radius={[3,3,0,0]} maxBarSize={20} opacity={0.85}/>
              <Line yAxisId="b" type="monotone" dataKey="avg_fare" name="Avg Fare ($)" stroke={C.neon} strokeWidth={2.5} dot={false}/>
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <H title="Zone Heatmap" sub={`Active: ${activeZone}`}/>
          <div style={{height:222}}>
            <MapViz activeZone={activeZone} zones={zones}/>
          </div>
        </Card>
      </div>

      {/* Row 2: Pax + Zones + Routes */}
      <div style={{display:"grid",gridTemplateColumns:"4fr 4fr 4fr",gap:14}}>
        <Card>
          <H title="Passenger Mix" sub="Rides by group size"/>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={pax||[]} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false}/>
              <XAxis type="number" tick={{fill:C.dim,fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis dataKey="pax" type="category" tick={{fill:C.sub,fontSize:11,fontFamily:"JetBrains Mono"}} axisLine={false} tickLine={false} width={48}/>
              <Tooltip content={<NT/>}/>
              <Bar dataKey="rides" name="Rides" radius={[0,5,5,0]}>
                {(pax||[]).map((d,i)=><Cell key={i} fill={d.color||PIE[i]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card style={{padding:"18px 14px"}}>
          <H title="Zone Activity" sub="Click to activate map"/>
          <div style={{display:"flex",flexDirection:"column",gap:5,maxHeight:230,overflowY:"auto"}}>
            {(zones||[]).map(z=>(
              <div key={z.zone} onClick={()=>setActiveZone(z.zone)}
                style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                  padding:"7px 10px",borderRadius:7,cursor:"pointer",transition:"all 0.15s",
                  background:activeZone===z.zone?C.neonLo:C.bg,
                  border:`1px solid ${activeZone===z.zone?C.neonMd:C.border}`}}>
                <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,
                  color:activeZone===z.zone?C.neon:C.sub}}>{z.zone}</span>
                <div style={{textAlign:"right"}}>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.teal}}>{z.rides}</div>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.dim}}>${z.avg_fare}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card style={{padding:"18px 14px"}}>
          <H title="Top Routes" sub="By trip volume"/>
          <div style={{display:"flex",flexDirection:"column",gap:5,maxHeight:230,overflowY:"auto"}}>
            {(routes||[]).map((r,i)=>(
              <div key={r.route} style={{padding:"8px 10px",borderRadius:7,background:C.bg,
                border:`1px solid ${C.border}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:C.text}}>{r.route}</span>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:PIE[i%PIE.length]}}>{r.trips}</span>
                </div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.dim,marginTop:2}}>
                  avg ${r.avg_fare} · {r.avg_dist} km
                </div>
                <div style={{height:3,background:C.border,borderRadius:2,marginTop:5}}>
                  <div style={{height:"100%",width:`${Math.min(100,r.trips/1.5)}%`,
                    background:PIE[i%PIE.length],borderRadius:2,transition:"width 0.5s"}}/>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE: DRIVERS
═══════════════════════════════════════════════════════════════ */
function PageDrivers() {
  const { data: drivers } = useAPI("/api/drivers","drivers");
  const [selectedDriver, setSelectedDriver] = useState(null);
  const sd = drivers?.find(d=>d.driver_id===selectedDriver) || drivers?.[0];

  return (
    <div style={{display:"grid",gridTemplateColumns:"5fr 7fr",gap:14}}>
      {/* Leaderboard */}
      <Card style={{maxHeight:600,overflowY:"auto"}}>
        <H title="Driver Leaderboard" sub="Ranked by rides · Click for detail"/>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {(drivers||[]).map((d,i)=>{
            const isSelected = d.driver_id===selectedDriver || (!selectedDriver && i===0);
            const rankColor  = i===0?C.neon:i===1?"#C0C0C0":i===2?"#CD7F32":C.dim;
            return (
              <div key={d.driver_id} onClick={()=>setSelectedDriver(d.driver_id)}
                style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",
                  borderRadius:10,cursor:"pointer",transition:"all 0.15s",
                  background:isSelected?C.neonLo:C.bg,
                  border:`1px solid ${isSelected?C.neonMd:C.border}`}}>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,
                  color:rankColor,width:20,flexShrink:0,fontWeight:700}}>#{i+1}</span>
                <div style={{width:34,height:34,borderRadius:"50%",flexShrink:0,
                  background:`conic-gradient(${rankColor}40, ${C.muted}40)`,
                  border:`2px solid ${rankColor}50`,display:"flex",alignItems:"center",
                  justifyContent:"center",fontFamily:"'Barlow Condensed',sans-serif",
                  fontSize:12,fontWeight:700,color:rankColor}}>
                  {d.name.split(" ").map(n=>n[0]).join("")}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:600,color:C.text,
                    overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.name}</div>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.dim}}>{d.driver_id} · {d.zone}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:C.neon}}>{d.rides} rides</div>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.orange}}>★ {d.rating}</div>
                </div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,
                  color:d.trend_pct>0?C.neon:C.rose,flexShrink:0,width:34,textAlign:"right"}}>
                  {d.trend_pct>0?"+":""}{d.trend_pct}%
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Detail panel */}
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {sd && (
          <>
            <Card>
              <H title={`${sd.name} · ${sd.driver_id}`} sub={`Zone: ${sd.zone}`}/>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
                {[
                  {label:"Rides",      value:sd.rides,           color:C.neon},
                  {label:"Revenue",    value:`$${sd.revenue?.toLocaleString()}`, color:C.teal},
                  {label:"Avg Rating", value:`★ ${sd.rating}`,   color:C.orange},
                  {label:"Completion", value:`${sd.completion_rate}%`, color:C.green},
                ].map(m=>(
                  <div key={m.label} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 14px"}}>
                    <div style={{fontSize:9,color:C.dim,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:2,textTransform:"uppercase"}}>{m.label}</div>
                    <div style={{fontSize:20,fontWeight:700,color:m.color,fontFamily:"'JetBrains Mono',monospace",marginTop:3}}>{m.value}</div>
                  </div>
                ))}
              </div>
              {/* Completion progress bar */}
              <div style={{marginBottom:4}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,color:C.dim,letterSpacing:2}}>COMPLETION RATE</span>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.green}}>{sd.completion_rate}%</span>
                </div>
                <div style={{height:6,background:C.border,borderRadius:3}}>
                  <div style={{height:"100%",width:`${sd.completion_rate}%`,background:C.neon,borderRadius:3,
                    boxShadow:`0 0 8px ${C.neon}60`,transition:"width 0.6s ease"}}/>
                </div>
              </div>
            </Card>
            <Card>
              <H title="Driver Performance Matrix" sub="All drivers · Revenue vs Rides"/>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={drivers||[]} barGap={3}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                  <XAxis dataKey="name" tick={{fill:C.dim,fontSize:9}} axisLine={false} tickLine={false}
                    tickFormatter={v=>v.split(" ")[0]}/>
                  <YAxis yAxisId="a" orientation="left"  tick={{fill:C.dim,fontSize:9}} tickFormatter={v=>`$${(v/1000).toFixed(0)}K`} axisLine={false} tickLine={false}/>
                  <YAxis yAxisId="b" orientation="right" tick={{fill:C.dim,fontSize:9}} axisLine={false} tickLine={false}/>
                  <Tooltip content={<NT/>}/>
                  <Bar yAxisId="a" dataKey="revenue" name="Revenue" fill={C.neon}  radius={[3,3,0,0]} maxBarSize={20}/>
                  <Bar yAxisId="b" dataKey="rides"   name="Rides"   fill={C.teal} radius={[3,3,0,0]} maxBarSize={20} opacity={0.8}/>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE: RAW DATA
═══════════════════════════════════════════════════════════════ */
function PageRawData() {
  const [drillRow, setDrillRow] = useState(null);
  // In production, this would call GET /api/rides?page=1&page_size=200
  return (
    <div>
      <Card style={{height:"calc(100vh - 160px)"}}>
        <H title="Raw Trip Data · Virtualized Table"
           sub={`Showing ${MOCK.rawRides.length} of 10,500 records (paginated in production) · Click any row to drill through`}/>
        <div style={{height:"calc(100% - 55px)"}}>
          <VTable data={MOCK.rawRides} onDrill={setDrillRow}/>
        </div>
      </Card>
      <DrillModal row={drillRow} onClose={()=>setDrillRow(null)}/>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR NAV
═══════════════════════════════════════════════════════════════ */
const NAV_ITEMS = [
  { id:"overview",  icon:"⬡",  label:"Overview"  },
  { id:"revenue",   icon:"$",  label:"Revenue"   },
  { id:"bookings",  icon:"🗓", label:"Bookings"  },
  { id:"drivers",   icon:"👤", label:"Drivers"   },
  { id:"raw",       icon:"⊞",  label:"Raw Data"  },
];

/* ═══════════════════════════════════════════════════════════════
   ROOT APP
═══════════════════════════════════════════════════════════════ */
export default function App() {
  const [page,       setPage]       = useState("overview");
  const [yearFilter, setYearFilter] = useState(null);
  const [collapsed,  setCollapsed]  = useState(false);

  const SB_W = collapsed ? 56 : 200;

  return (
    <div style={{display:"flex",height:"100vh",background:C.bg,color:C.text,overflow:"hidden",
      fontFamily:"'DM Sans',sans-serif"}}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap');
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px;height:4px;background:${C.bg}}
        ::-webkit-scrollbar-thumb{background:${C.muted};border-radius:3px}
        input{outline:none}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes ping{0%{transform:translate(-50%,-50%) scale(1);opacity:0.6}100%{transform:translate(-50%,-50%) scale(2.5);opacity:0}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        .nav-item:hover{background:${C.neonLo}!important}
        .page-enter{animation:fadeUp 0.3s ease forwards}
      `}</style>

      {/* ── SIDEBAR ── */}
      <div style={{width:SB_W,background:C.surf,borderRight:`1px solid ${C.border}`,
        display:"flex",flexDirection:"column",flexShrink:0,transition:"width 0.2s ease",
        overflow:"hidden"}}>

        {/* Logo */}
        <div style={{padding:"16px 12px",borderBottom:`1px solid ${C.border}`,
          display:"flex",alignItems:"center",gap:10,minHeight:56}}>
          <div style={{width:32,height:32,borderRadius:8,background:C.neon,flexShrink:0,
            display:"flex",alignItems:"center",justifyContent:"center",
            boxShadow:`0 0 14px ${C.neonMd}`}}>
            <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,
              fontSize:15,color:C.bg,letterSpacing:-1}}>OL</span>
          </div>
          {!collapsed && (
            <div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,
                fontSize:14,color:C.text,letterSpacing:2,whiteSpace:"nowrap"}}>OLA ANALYTICS</div>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,
                color:C.dim,letterSpacing:2}}>POWER BI v2.0</div>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav style={{flex:1,padding:"12px 8px",display:"flex",flexDirection:"column",gap:4}}>
          {NAV_ITEMS.map(n=>{
            const active = page===n.id;
            return (
              <div key={n.id} className="nav-item" onClick={()=>setPage(n.id)}
                style={{display:"flex",alignItems:"center",gap:10,padding:"10px 10px",
                  borderRadius:8,cursor:"pointer",transition:"all 0.15s",
                  background:active?C.neonLo:"transparent",
                  border:`1px solid ${active?C.neonMd:"transparent"}`}}>
                <span style={{fontSize:14,flexShrink:0,width:20,textAlign:"center",
                  fontFamily:"'JetBrains Mono',monospace",color:active?C.neon:C.dim}}>{n.icon}</span>
                {!collapsed && (
                  <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,
                    fontWeight:700,letterSpacing:1.5,color:active?C.neon:C.sub,
                    textTransform:"uppercase",whiteSpace:"nowrap"}}>{n.label}</span>
                )}
              </div>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div onClick={()=>setCollapsed(c=>!c)}
          style={{padding:"12px",borderTop:`1px solid ${C.border}`,cursor:"pointer",
            display:"flex",alignItems:"center",justifyContent:collapsed?"center":"flex-end",
            color:C.dim,fontSize:16,transition:"color 0.15s"}}
          onMouseEnter={e=>e.currentTarget.style.color=C.neon}
          onMouseLeave={e=>e.currentTarget.style.color=C.dim}>
          {collapsed ? "›" : "‹"}
        </div>
      </div>

      {/* ── MAIN ── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {/* Top bar */}
        <div style={{background:C.surf,borderBottom:`1px solid ${C.border}`,
          padding:"0 20px",display:"flex",alignItems:"center",justifyContent:"space-between",
          height:52,flexShrink:0}}>
          <div>
            <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,
              fontSize:18,letterSpacing:2,color:C.text}}>
              {NAV_ITEMS.find(n=>n.id===page)?.label?.toUpperCase()}
            </span>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,
              color:C.dim,marginLeft:12,letterSpacing:1}}>
              {USE_MOCK ? "● MOCK DATA" : "● LIVE · localhost:8000"}
            </span>
          </div>

          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            {/* Status pills */}
            {[
              {v:"10,500 RIDES",c:C.neon},{v:"50 DRIVERS",c:C.teal},{v:"$276.8K REV",c:C.orange}
            ].map(p=>(
              <span key={p.v} style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,
                color:p.c,background:`${p.c}15`,border:`1px solid ${p.c}30`,
                padding:"3px 10px",borderRadius:20}}>{p.v}</span>
            ))}
            {/* Year slicer */}
            <select value={yearFilter||""} onChange={e=>setYearFilter(e.target.value?+e.target.value:null)}
              style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6,
                color:C.text,padding:"5px 10px",fontFamily:"'JetBrains Mono',monospace",
                fontSize:11,cursor:"pointer"}}>
              <option value="">ALL YEARS</option>
              {[2009,2010,2011,2012,2013,2014,2015].map(y=>(
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Page content */}
        <div style={{flex:1,overflowY:"auto",padding:"18px 20px"}} key={page} className="page-enter">
          {page==="overview"  && <PageOverview  yearFilter={yearFilter}/>}
          {page==="revenue"   && <PageRevenue   yearFilter={yearFilter}/>}
          {page==="bookings"  && <PageBookings/>}
          {page==="drivers"   && <PageDrivers/>}
          {page==="raw"       && <PageRawData/>}
        </div>

        {/* Footer */}
        <div style={{borderTop:`1px solid ${C.border}`,padding:"8px 20px",flexShrink:0,
          display:"flex",justifyContent:"space-between",background:C.surf}}>
          <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.dim}}>
            OLA ANALYTICS DASHBOARD · FastAPI + SQLite + React · 10,500 SEEDED RECORDS
          </span>
          <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.dim}}>
            API: {API_BASE}/docs · {USE_MOCK?"MOCK MODE":"LIVE MODE"}
          </span>
        </div>
      </div>
    </div>
  );
}
