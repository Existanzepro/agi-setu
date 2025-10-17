import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Users, Layers, Rocket, Clock, FileText, Plus, Send, MessageSquare } from "lucide-react";

// =============================================================
// ✅ SAFE, MINIMAL, FUNCTIONAL DEMO — CLEAN & DEBUGGED
// - Fixes previous JSX closing errors and invalid React children (#130)
// - No object is rendered directly; text and elements only
// - Assistant router is transversal (CRM/ERP/Airtable/Webhook)
// - CRM table with inline-edit, sorting (€/SLA), filter by estado, bulk owner
// - Vertical/ROI with modular pricing by 2–5 seat blocks + payback
// - Doc Gen preview fully closed (no dangling tags)
// =============================================================

// ---------- Brand / i18n
const BRAND = { primary: "#0f172a", secondary: "#10b981", accent: "#38bdf8", fontFamily: "Arimo, system-ui, sans-serif" };
const t = (pt: string, en: string) => pt; // PT-first demo

// ---------- Verticals (brief)
const GENERIC_PAINS = ["Integrações desconexas", "Dados duplicados", "Baixa visibilidade de KPI"];
const VERTICALS: Record<string, any> = {
  "Advogados": { color: "#1d4ed8", pains: ["Prazos", "Docs repetidos", "Follow-ups"],
    flows: [{title:"Alertas",tip:"Prazos → Calendar"},{title:"Peças",tip:"Modelos dinâmicos"},{title:"Follow-ups",tip:"WhatsApp/e-mail"}],
    forms:["Nome","Email","Assunto","Área"],
    comms:{ whatsapp:"Olá {nome}, atualização do processo.", email:"Assunto: Processo — {assunto}" },
    docs:{ templates:["Proposta","NDA","Contrato","Mandato"], default:"Proposta", clauses:"Êxito 10%; confidencialidade." },
  },
  "Imobiliárias": { color: "#059669", pains:["Leads perdidas","Visitas","Contratos"],
    flows:[{title:"Qualificação",tip:"Scoring + atribuição"},{title:"Visitas",tip:"Confirmação + reagendar"},{title:"Contratos",tip:"CPCV/arrendamento"}],
    forms:["Nome","Email","Telefone","Tipo de imóvel","Budget"],
    comms:{ whatsapp:"Olá {nome}, visita confirmada.", email:"Assunto: Visita — {referencia}" },
    docs:{ templates:["Proposta Mediação","CPCV","Arrendamento","NDA"], default:"Proposta Mediação", clauses:"Sinal 10%; inspeção." },
  },
};

// ---------- KPI demo series
const KPI_SERIES = [
  { month: "Apr", leads: 20, ops: 10, efficiency: 70 },
  { month: "May", leads: 24, ops: 12, efficiency: 74 },
  { month: "Jun", leads: 28, ops: 15, efficiency: 78 },
  { month: "Jul", leads: 30, ops: 17, efficiency: 82 },
  { month: "Aug", leads: 33, ops: 19, efficiency: 85 },
  { month: "Sep", leads: 36, ops: 22, efficiency: 88 },
];

// ---------- Pricing by module
const MODULES = { CRM:'ClientTrack', Agenda:'AutoAgenda', 'Doc Gen':'DocGenAI', Forms:'SmartForms', Dashboard:'DashOps', Marketing:'PromoFlow' } as const;
const PRICE: Record<string,{setup:number; monthly:number}> = {
  ClientTrack:{ setup:250, monthly:120 },
  AutoAgenda:{ setup:180, monthly:90 },
  DocGenAI:{  setup:220, monthly:110 },
  SmartForms:{setup:120, monthly:60 },
  DashOps:{   setup:150, monthly:80 },
  PromoFlow:{ setup:130, monthly:75 },
};

// ---------- Helpers
const formatEUR = (n:number)=>`€${Number(n||0).toLocaleString(undefined,{maximumFractionDigits:0})}`;
function unitsForUsers(users:number){ const minBlock=2, blockSize=5; const u=Math.max(0, users|0); if(u===0) return 0; const eff=Math.max(u,minBlock); return Math.ceil(eff/blockSize); }
function usersCovered(units:number){ return units*5; }
function useInsights(series: typeof KPI_SERIES){ const g=series[series.length-1].efficiency-series[0].efficiency; return {gain:g,summary:`Eficiência +${g}% nos últimos 6m.`}; }
function paybackMonths(costs:{setup:number; monthly:number}, monthlySavings:number){ if(monthlySavings<=0) return Infinity; return Math.max(1, Math.ceil(costs.setup/Math.max(1,(monthlySavings-costs.monthly)))); }

// ---------- Parsing Assistant Commands
function parseCrmOwnerCmd(text:string){
  const m=/^\/crm\s+owner\s+(\S+)\s+(.+)$/i.exec(String(text||'').trim());
  return m? { id:m[1], owner:m[2] } : null;
}

// ---------- Minimal adapters (fake)
const adapters = {
  calendar:{ create:(d:Date)=>Promise.resolve({ok:true,date:d}) },
  comms:{ whatsapp:(m:string)=>Promise.resolve({ok:true,msg:m}), email:(m:string)=>Promise.resolve({ok:true,msg:m}) },
  docs:{ generate:(e:string,tpl:string,clauses:string)=>Promise.resolve({ok:true,entity:e,template:tpl,clauses}) },
};

// ---------- Small building blocks
function KPI({label,value,icon:Icon,hint}:{label:string;value:React.ReactNode;icon:any;hint?:string}){
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="rounded-xl p-2 bg-muted"><Icon className="w-5 h-5"/></div>
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold leading-tight">{value}</div>
          {hint? <div className="text-xs text-muted-foreground mt-1">{hint}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}

const STAGES_PT = ["Proposta Enviada","Reunião Agendada","Em Progresso","Fechado"] as const;

function EnhancedTable({items,selected,onToggle,onToggleAll,onChange,sortField,sortDir,onSort,stages=STAGES_PT}:{
  items:any[]; selected:Record<string,boolean>; onToggle:(id:string)=>void; onToggleAll:(v:boolean)=>void;
  onChange:(id:string,patch:any)=>void; sortField:string; sortDir:'asc'|'desc'; onSort:(key:string)=>void; stages?:readonly string[];
}){
  const headers=["","ID","Cliente","Categoria","Estado","Owner","Aberto","SLA (d)","Dias","€"];
  const allChecked = items.length>0 && items.every(r=>selected[r.id]);
  return (
    <div className="overflow-auto border rounded-xl" role="table">
      <table className="min-w-full text-sm">
        <thead className="bg-muted">
          <tr className="text-left">
            <th className="px-2 py-2"><input aria-label="Selecionar todos" type="checkbox" checked={allChecked} onChange={e=>onToggleAll(e.currentTarget.checked)} /></th>
            {headers.slice(1).map((h)=>{
              const sortable = h==="€" || h==="SLA (d)";
              const key = h==="€"?"value":(h==="SLA (d)"?"slaDays":"");
              const isActive = !!key && sortField===key;
              const dirIcon = isActive ? (sortDir==='asc'? '▲':'▼') : '';
              return (
                <th key={h} className="px-3 py-2 font-medium select-none" scope="col">
                  {sortable? (<button className="underline decoration-dotted" onClick={()=>onSort(key)}>{h} {dirIcon}</button>) : h}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {items.map((row)=> (
            <tr key={row.id} className="border-t align-middle">
              <td className="px-2 py-2"><input aria-label={`Selecionar ${row.id}`} type="checkbox" checked={!!selected[row.id]} onChange={()=>onToggle(row.id)} /></td>
              <td className="px-3 py-2 font-mono">{row.id}</td>
              <td className="px-3 py-2">{row.client}</td>
              <td className="px-3 py-2">{row.category}</td>
              <td className="px-3 py-2 min-w-[180px]">
                <select className="border rounded-md px-2 py-1 text-sm" value={row.stage} onChange={(e)=>onChange(row.id,{stage:e.currentTarget.value})}>
                  {stages.map(s=> <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
              <td className="px-3 py-2 min-w-[160px]">
                <input className="border rounded-md px-2 py-1 text-sm w-full" value={row.owner} onChange={(e)=>onChange(row.id,{owner:e.currentTarget.value})} />
              </td>
              <td className="px-3 py-2 whitespace-nowrap">{row.opened}</td>
              <td className="px-3 py-2">{row.slaDays}</td>
              <td className={`px-3 py-2 ${row.daysOpen>row.slaDays*0.8?"text-red-600 font-medium":""}`}>{row.daysOpen}</td>
              <td className="px-3 py-2 min-w-[120px]">
                <div className="flex items-center gap-2">
                  <span>€</span>
                  <input type="number" className="border rounded-md px-2 py-1 text-sm w-full" value={row.value} onChange={(e)=>onChange(row.id,{value:Number(e.currentTarget.value)})} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocPreview({entity,template,clauses,onDownload}:{entity:string;template:string;clauses:string;onDownload:(t:string)=>void}){
  const body = `${template.toUpperCase()}\n\nEntre a organização ("Prestador") e ${entity}.\n1. Objeto.\n2. Prazos e SLA.\n3. Confidencialidade e RGPD.\n4. Valores.\n5. Cláusulas: ${clauses||"—"}.\nLisboa, ${new Date().toLocaleDateString()}\n`;
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Pré‑visualização</div>
          <Button variant="secondary" size="sm" onClick={()=>onDownload(body)}><FileText className="w-4 h-4 mr-1"/>Download .txt</Button>
        </div>
        <pre className="text-xs whitespace-pre-wrap bg-muted/40 p-3 rounded-xl h-56 overflow-auto">{body}</pre>
      </CardContent>
    </Card>
  );
}

function downloadText(filename:string,text:string){
  try{ const b=new Blob([text],{type:"text/plain;charset=utf-8"}); const u=URL.createObjectURL(b); const a=document.createElement("a"); a.href=u; a.download=filename; a.click(); URL.revokeObjectURL(u);}catch{ /* noop */ }
}

function genPipeline(vertical:string){
  const base=[
    {id:"OP-2509-001",client:"Acme, SA",category:"Novo",stage:"Proposta Enviada",owner:"Owner A",opened:"2025-09-12",slaDays:20,daysOpen:8,value:4000},
    {id:"OP-2509-002",client:"Beta Lda.",category:"Ativo",stage:"Em Progresso",owner:"Owner B",opened:"2025-09-18",slaDays:15,daysOpen:6,value:6500},
    {id:"OP-2510-003",client:"Gamma Group",category:"Follow‑up",stage:"Reunião Agendada",owner:"Owner C",opened:"2025-10-02",slaDays:10,daysOpen:5,value:9800},
  ];
  return base.map(r=>({...r, category:vertical.slice(0,10)}));
}

// =============================================================
export default function MultiVerticalEnhanced(){
  // UI state — top bar
  const [vertical,setVertical]=useState<keyof typeof VERTICALS>("Advogados");
  const V = VERTICALS[vertical];
  const [lang,setLang]=useState<'pt'|'en'>('pt');
  const tr = (pt:string,en:string)=> lang==='pt'?pt:en;

  // Assistant chat
  const [chat,setChat]=useState<{role:'user'|'assistant';content:string;imageUrl?:string;alt?:string}[]>([]);

  // CRM state
  const [pipeline,setPipeline]=useState(()=>genPipeline(String(vertical)));
  const [crmStage,setCrmStage]=useState<string>('Todos');
  const [crmSort,setCrmSort]=useState<{field:string;dir:'asc'|'desc'}>({field:'',dir:'asc'});
  const [crmSel,setCrmSel]=useState<Record<string,boolean>>({});
  const [bulkOwner,setBulkOwner]=useState('Owner A');

  // Integrations (UX showing value, not tech)
  const [dataSource,setDataSource]=useState<'Demo'|'Airtable'|'API/Webhook'>('Demo');
  const [airtableBase,setAirtableBase]=useState('app_demo');
  const [airtableTable,setAirtableTable]=useState('Pipeline');
  const [apiEndpoint,setApiEndpoint]=useState('/api/crm');
  const [webhookUrl,setWebhookUrl]=useState('/api/webhook');

  // Vertical/ROI state
  const [teamSize,setTeamSize]=useState(5);
  const [costPerHour,setCostPerHour]=useState(20);
  const [mods,setMods]=useState<string[]>(['CRM']);
  // Social/Dashboard state
  const [socialTopic,setSocialTopic]=useState('Lançamento de campanha');
  const [socialImageUrl,setSocialImageUrl]=useState<string>('');
  const [socialCaption,setSocialCaption]=useState<string>('');

  // Doc Gen state
  const [entity,setEntity]=useState('Cliente Exemplo, Lda.');
  const [template,setTemplate]=useState<string>(V.docs.default);
  const [clauses,setClauses]=useState<string>(V.docs.clauses);

  // Agenda state
  const [date,setDate]=useState<Date>(new Date());
  const [msg,setMsg]=useState<string>(V.comms.whatsapp);
  const [emailMsg,setEmailMsg]=useState<string>(V.comms.email);

  // Insights
  const insights = useInsights(KPI_SERIES);

  // ===== CRM helpers
  const visiblePipeline = useMemo(()=>{
    let arr=[...pipeline];
    if (crmStage!=='Todos') arr=arr.filter(r=>r.stage===crmStage);
    if (crmSort.field){ const dir = crmSort.dir==='asc'?1:-1; arr.sort((a,b)=> (a[crmSort.field]-b[crmSort.field])*dir); }
    return arr;
  },[pipeline,crmStage,crmSort]);
  const onCrmSort=(field:string)=> setCrmSort(s=> s.field===field? {...s, dir:s.dir==='asc'?'desc':'asc'} : {field,dir:'asc'});
  const toggleRow=(id:string)=> setCrmSel(s=> ({...s,[id]:!s[id]}));
  const toggleAllRows=(checked:boolean)=>{ if(!checked){ setCrmSel({}); return; } const next:Record<string,boolean>={}; visiblePipeline.forEach(r=>next[r.id]=true); setCrmSel(next); };
  const onRowChange=(id:string,patch:any)=> setPipeline(p=> p.map(r=> r.id===id? {...r, ...patch}: r));
  const applyBulkOwner=()=> setPipeline(p=> p.map(r=> crmSel[r.id]? {...r, owner: bulkOwner}: r));

  // ===== Assistant router (transversal)
  const ask = useCallback(async (cmd:string)=>{
    const text=String(cmd||''); const low=text.toLowerCase(); const say=(s:string)=>({ok:true,text:s});
    if(low.startsWith('/crm')){
      const body=text.slice(4).trim();
      if(body.startsWith('listar')) return say(`${visiblePipeline.length} ${tr('registos no CRM visível','records in visible CRM')}.`);
      const parsed=parseCrmOwnerCmd(text); if(parsed){ onRowChange(parsed.id,{owner:parsed.owner}); return say(`${tr('Owner alterado em','Owner changed on')} ${parsed.id} → ${parsed.owner}`);} 
      return say(tr('Comandos CRM','CRM commands')+': listar | owner [ID] [Owner]');
    }
    if(low.startsWith('/erp')){ if(/ping/i.test(text)) return say(tr('ERP respondido com sucesso.','ERP replied successfully.')); return say(tr('Comandos ERP','ERP commands')+': ping'); }
    if(low.startsWith('/airtable')){ console.log('airtable:connect', {base:airtableBase,table:airtableTable}); return say(tr('Airtable ligado (demo).','Airtable connected (demo).')); }
    if(low.startsWith('/webhook')){ console.log('webhook:send', {url:webhookUrl, event:'Demo'}); return say(tr('Webhook enviado (demo).','Webhook sent (demo).')); }
    // fallback simples
    return {ok:true,text:tr('Posso ajudar com','I can help with')+` ${vertical}. `+tr('Sugestões','Suggestions')+`: `+V.flows.slice(0,2).map((f:any)=>f.title).join(' & ')};
  },[visiblePipeline,onRowChange,airtableBase,airtableTable,webhookUrl,tr,vertical,V]);

  const sendCmd = useCallback(async (cmd:string)=>{
    const u={role:'user' as const, content:cmd}; const next=[...chat,u]; setChat(next);
    const r=await ask(cmd); const a={role:'assistant' as const, content:String(r.text||'')}; setChat([...next,a]);
  },[chat,ask]);

  // ===== ROI calculations
  const monthlyHours = useMemo(()=>Math.round(KPI_SERIES[KPI_SERIES.length-1].ops*6),[]);
  const monthlySavings = useMemo(()=> Math.max(0, monthlyHours * costPerHour), [monthlyHours,costPerHour]);
  const selectedPkgs = useMemo(()=> mods.map(m=> PRICE[MODULES[m as keyof typeof MODULES]]).filter(Boolean), [mods]);
  const totals = useMemo(()=>{
    const u = unitsForUsers(teamSize);
    const baseSetup = selectedPkgs.reduce((a,b)=>a+(b?.setup||0),0);
    const baseMonthly = selectedPkgs.reduce((a,b)=>a+(b?.monthly||0),0);
    return { setup: baseSetup*u, monthly: baseMonthly*u, units:u, covered: usersCovered(u) };
  },[selectedPkgs,teamSize]);
  const pb = useMemo(()=> paybackMonths({setup:totals.setup,monthly:totals.monthly}, monthlySavings), [totals,monthlySavings]);

  // Social generator
  const genSocial = useCallback(()=>{
    const topic = (socialTopic||'Demo').trim();
    const url = `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(`${vertical}-${topic}`)}&backgroundType=gradientLinear`;
    setSocialImageUrl(url);
    setSocialCaption(tr(`Post: ${topic} — automações ativas e resultados em foco.`,`Post: ${topic} — automations active and results-focused.`));
  },[socialTopic,vertical,tr]);

  // ===== Tests (no UI)
  (function(){
    console.assert(unitsForUsers(1)===1 && unitsForUsers(2)===1 && unitsForUsers(5)===1, 'seats: 1–5 => 1 block');
    console.assert(unitsForUsers(6)===2 && unitsForUsers(10)===2, 'seats: 6–10 => 2 blocks');
    const p = parseCrmOwnerCmd('/crm owner OP-2510-003 Maria'); console.assert(p && p.id==='OP-2510-003', 'parse owner');
  })();

  // ===== UI
  return (
    <TooltipProvider>
      <div className="min-h-screen text-foreground" style={{fontFamily:BRAND.fontFamily,background:"linear-gradient(180deg,#fff,#f7fafc)"}}>
        <header className="sticky top-0 z-10 border-b backdrop-blur" style={{background:"#ffffffcc"}}>
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="font-bold text-xl tracking-tight" style={{color:BRAND.primary}}>ΞΦΛE<span style={{color:BRAND.accent}}>.pro</span></div>
              <Select value={vertical} onValueChange={(v:any)=>{setVertical(v); setPipeline(genPipeline(v)); setTemplate(VERTICALS[v].docs.default); setClauses(VERTICALS[v].docs.clauses); setMsg(VERTICALS[v].comms.whatsapp); setEmailMsg(VERTICALS[v].comms.email);}}>
                <SelectTrigger className="w-[220px]"><SelectValue placeholder={tr('Escolha um setor','Choose a vertical')} /></SelectTrigger>
                <SelectContent>{Object.keys(VERTICALS).map(v=>(<SelectItem key={v} value={v}>{v}</SelectItem>))}</SelectContent>
              </Select>
              <Badge style={{background:V.color,color:'#fff'}} className="rounded-full">{vertical}</Badge>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Select value={lang} onValueChange={(v:any)=>setLang(v)}>
                <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt">PT</SelectItem>
                  <SelectItem value="en">EN</SelectItem>
                </SelectContent>
              </Select>
              <div>Lisboa • {new Date().toLocaleDateString()}</div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
          {/* Assistant (transversal) */}
          <section className="grid grid-cols-1 gap-4">
            <Card className="rounded-2xl"><CardContent className="p-4 space-y-3">
              <div className="font-semibold">{tr('Assistente','Assistant')}</div>
              <div className="border rounded-xl p-3 h-44 overflow-auto bg-muted/30">
                {chat.length===0 ? (
                  <div className="text-sm text-muted-foreground">{tr('Dica: comandos','Tip: commands')}: <span className="font-mono">/crm listar</span>, <span className="font-mono">/crm owner OP-2510-003 Maria Silva</span>, <span className="font-mono">/erp ping</span></div>
                ) : (
                  chat.map((m,i)=> (
                    <div key={i} className={`text-sm mb-2 ${m.role==='assistant'?'text-foreground':'text-foreground/80'}`}>
                      <span className="font-medium">{m.role==='assistant'? tr('Assistente','Assistant'):tr('Você','You')}:</span> {String(m.content)}
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <Textarea className="min-h-[48px]" placeholder={tr('Escreva aqui...','Type here...')} onKeyDown={(e:any)=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault(); const v=(e.currentTarget as HTMLTextAreaElement).value.trim(); if(!v) return; (e.currentTarget as HTMLTextAreaElement).value=''; sendCmd(v);}}} />
                <Button onClick={()=>sendCmd('/crm listar')}>{tr('Enviar','Send')}</Button>
              </div>
            </CardContent></Card>
          </section>

          {/* KPIs */}
          <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KPI label="Leads (Mês)" value={KPI_SERIES[KPI_SERIES.length-1].leads} icon={Users} hint="Média" />
            <KPI label="Operações Ativas" value={KPI_SERIES[KPI_SERIES.length-1].ops} icon={Layers} hint="30 dias" />
            <KPI label="Eficiência" value={`${KPI_SERIES[KPI_SERIES.length-1].efficiency}%`} icon={Rocket} hint="Tendência" />
            <KPI label="Tempo Poupado/mês" value={`~${Math.round(KPI_SERIES[KPI_SERIES.length-1].ops*6)}h`} icon={Clock} hint="estimado" />
          </section>

          <Tabs defaultValue="sector" className="w-full">
            <TabsList className="grid grid-cols-7 rounded-2xl bg-muted/40">
              <TabsTrigger value="sector">Vertical / ROI</TabsTrigger>
              <TabsTrigger value="crm">CRM</TabsTrigger>
              <TabsTrigger value="doc">Doc Gen</TabsTrigger>
              <TabsTrigger value="agenda">Agenda</TabsTrigger>
              <TabsTrigger value="forms">Forms</TabsTrigger>
              <TabsTrigger value="social">Social</TabsTrigger>
              <TabsTrigger value="dash">Dashboard</TabsTrigger>
            </TabsList>

            {/* Vertical / ROI */}
            <TabsContent value="sector" className="grid gap-4">
              <Card className="rounded-2xl"><CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg" style={{color:BRAND.primary}}>Vertical & Dores</h3>
                  <Badge className="rounded-full" style={{background:V.color,color:'#fff'}}>{vertical}</Badge>
                </div>
                <div className="text-sm text-muted-foreground"><strong>Dores:</strong> {[...V.pains, ...GENERIC_PAINS].join(' • ')}</div>
                <div className="flex flex-wrap gap-2">
                  {V.flows.map((f:any)=> (
                    <Tooltip key={f.title}>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="px-3 py-1 rounded-full cursor-help">{f.title}</Badge>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">{f.tip}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>

                {/* Funcionalidades (módulos) */}
                <div className="pt-2 border-t">
                  <div className="font-semibold mb-2">Funcionalidades</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.keys(MODULES).map((m)=> (
                      <Button key={m} size="sm" variant={mods.includes(m)?'default':'outline'} onClick={()=>setMods(s=> s.includes(m)? s.filter(x=>x!==m) : [...s,m])}>{m}</Button>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Selecionadas: {mods.join(' • ')} — utilizadores: {teamSize}</div>
                </div>

                {/* Controlo ROI */}
                <div className="grid gap-3">
                  <div>
                    <div className="font-semibold mb-1">Tamanho da equipa</div>
                    <div className="flex items-center gap-3">
                      <input aria-label="Tamanho da equipa" type="range" min={1} max={100} step={1} value={teamSize} onChange={(e)=>setTeamSize(Number((e.currentTarget as HTMLInputElement).value))} className="w-56" />
                      <div className="text-sm">{teamSize}</div>
                      <div className="flex gap-1 text-xs text-muted-foreground">
                        <Button size="sm" variant="outline" onClick={()=>setTeamSize(2)}>2</Button>
                        <Button size="sm" variant="outline" onClick={()=>setTeamSize(5)}>5</Button>
                        <Button size="sm" variant="outline" onClick={()=>setTeamSize(10)}>10</Button>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Faturação por blocos de 2–5 utilizadores • Blocos: {totals.units} (cobre até {totals.covered})</div>
                  </div>
                  <div>
                    <div className="font-semibold mb-1">Custo/hora</div>
                    <div className="flex items-center gap-3">
                      <input aria-label="Custo por hora" type="range" min={10} max={40} step={5} value={costPerHour} onChange={(e)=>setCostPerHour(Number((e.currentTarget as HTMLInputElement).value))} className="w-56" />
                      <div className="text-sm">{formatEUR(costPerHour)}/h</div>
                    </div>
                  </div>
                </div>

                {/* Benchmark & ROI */}
                <div className="overflow-hidden rounded-2xl border">
                  <div className="px-3 py-2 bg-muted font-semibold text-sm">Benchmark & ROI</div>
                  <table className="min-w-full text-sm"><thead className="bg-muted/50"><tr>
                    <th className="px-3 py-2 text-left">Métrica</th>
                    <th className="px-3 py-2 text-left">Antes</th>
                    <th className="px-3 py-2 text-left">Depois</th>
                    <th className="px-3 py-2 text-left">Ganho</th>
                  </tr></thead><tbody>
                    {[{metric:'Tempo médio por tarefa',before:'40 min',after:'10 min',gain:'-75%'},{metric:'Custos administrativos',before:formatEUR(2000),after:formatEUR(800),gain:'-60%'},{metric:'Satisfação do cliente',before:'6.5/10',after:'9.0/10',gain:'+38%'}].map((r)=> (
                      <tr key={r.metric} className="border-t"><td className="px-3 py-2">{r.metric}</td><td className="px-3 py-2">{r.before}</td><td className="px-3 py-2">{r.after}</td><td className="px-3 py-2 font-medium">{r.gain}</td></tr>
                    ))}
                  </tbody></table>
                </div>

                {/* KPIs financeiros */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <KPI label={'Mensalidade'} value={formatEUR(totals.monthly)} icon={Rocket}/>
                  <KPI label={'Setup'} value={formatEUR(totals.setup)} icon={Layers}/>
                  <KPI label={'Payback'} value={`${isFinite(pb)?pb:'∞'} meses`} icon={Clock}/>
                </div>
                <div className="text-xs text-muted-foreground">Poupança estimada/mês: {formatEUR(monthlySavings)} • Módulos: {mods.join(', ')} • Blocos: {totals.units}</div>
              </CardContent></Card>
            </TabsContent>

            {/* CRM */}
            <TabsContent value="crm" className="space-y-4">
              <div className="text-sm text-muted-foreground italic -mt-2">
                {tr('Automatize pipeline, propostas e follow-ups sem perder controlo.','Automate pipeline, proposals and follow-ups without losing control.')}
                <div className="mt-2 text-xs">{tr('Use o template demo OU ligue ao seu CRM/ERP via API/Webhook/Airtable.','Use demo template OR connect to your CRM/ERP via API/Webhook/Airtable.')}</div>
              </div>

              {/* Integração (realista e simples) */}
              <div className="rounded-xl border p-3 bg-muted/30">
                <div className="flex flex-wrap gap-3 items-center">
                  <div className="font-semibold">Fonte de Dados</div>
                  <select className="border rounded-md px-2 py-1 text-sm" value={dataSource} onChange={(e)=>setDataSource(e.currentTarget.value as any)}>
                    <option>Demo</option>
                    <option>Airtable</option>
                    <option>API/Webhook</option>
                  </select>
                  {dataSource==='Airtable' && (
                    <>
                      <Input className="w-40" placeholder="Base" value={airtableBase} onChange={e=>setAirtableBase(e.currentTarget.value)} />
                      <Input className="w-40" placeholder="Tabela" value={airtableTable} onChange={e=>setAirtableTable(e.currentTarget.value)} />
                      <Button size="sm" onClick={()=>sendCmd('/airtable')}>Conectar</Button>
                    </>
                  )}
                  {dataSource==='API/Webhook' && (
                    <>
                      <Input className="w-56" placeholder="API /crm" value={apiEndpoint} onChange={e=>setApiEndpoint(e.currentTarget.value)} />
                      <Input className="w-56" placeholder="Webhook URL" value={webhookUrl} onChange={e=>setWebhookUrl(e.currentTarget.value)} />
                      <Button size="sm" variant="outline" onClick={()=>console.log('api:connect',apiEndpoint)}>Test API</Button>
                      <Button size="sm" onClick={()=>sendCmd('/webhook')}>Ping Webhook</Button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Pipeline & Operações</h2>
                <div className="flex items-center gap-2">
                  <Dialog>
                    <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1"/>Novo</Button></DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader><DialogTitle>Novo ({vertical})</DialogTitle></DialogHeader>
                      <NewRecordForm onCreate={(d)=>{ setPipeline(p=>[{id:`OP-${String(new Date().getFullYear()).slice(2)}${String(new Date().getMonth()+1).padStart(2,"0")}-${String(p.length+1).padStart(3,"0")}`,client:d.client,category:d.category,stage:"Proposta Enviada",owner:d.owner,opened:new Date().toISOString().slice(0,10),slaDays:d.slaDays,daysOpen:0,value:d.value},...p]) }} />
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {/* Filtros / Sort / Bulk */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">Filtro:</span>
                  <select className="border rounded-md px-2 py-1 text-sm" value={crmStage} onChange={e=>setCrmStage(e.currentTarget.value)}>
                    {['Todos',...STAGES_PT].map(s=> <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">Sort:</span>
                  <Button size="sm" variant="outline" onClick={()=>onCrmSort('value')}>€</Button>
                  <Button size="sm" variant="outline" onClick={()=>onCrmSort('slaDays')}>SLA</Button>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-sm">Bulk owner:</span>
                  <Input className="max-w-[180px]" value={bulkOwner} onChange={e=>setBulkOwner(e.currentTarget.value)} />
                  <Button size="sm" onClick={applyBulkOwner}>Aplicar</Button>
                </div>
              </div>

              <EnhancedTable
                items={visiblePipeline}
                selected={crmSel}
                onToggle={toggleRow}
                onToggleAll={toggleAllRows}
                onChange={onRowChange}
                sortField={crmSort.field}
                sortDir={crmSort.dir}
                onSort={onCrmSort}
              />

              <div className="text-xs text-muted-foreground">{insights.summary}</div>
            </TabsContent>

            {/* Doc Gen */}
            <TabsContent value="doc" className="grid md:grid-cols-2 gap-4">
              <Card className="rounded-2xl"><CardContent className="p-4 space-y-3">
                <div className="font-semibold">Gerar documento</div>
                <div className="grid grid-cols-2 gap-2">
                  <div><div className="text-xs mb-1">Entidade</div><Input value={entity} onChange={e=>setEntity(e.currentTarget.value)} /></div>
                  <div><div className="text-xs mb-1">Template</div>
                    <Select value={template} onValueChange={(v:any)=>setTemplate(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{(V.docs.templates as string[]).map(tpl=>(<SelectItem key={tpl} value={tpl}>{tpl}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div><div className="text-xs mb-1">Cláusulas específicas</div><Textarea rows={4} value={clauses} onChange={e=>setClauses(e.currentTarget.value)} /></div>
                <div className="flex gap-2"><Button onClick={async()=>{await adapters.docs.generate(entity,template,clauses);}}><FileText className="w-4 h-4 mr-1"/>Gerar</Button></div>
              </CardContent></Card>
              <DocPreview entity={entity} template={template} clauses={clauses} onDownload={(t)=>downloadText('Doc_'+template.split(' ').join('_')+'.txt',t)} />
            </TabsContent>

            {/* Agenda */}
            <TabsContent value="agenda" className="grid md:grid-cols-2 gap-4">
              <Card className="rounded-2xl"><CardContent className="p-4 space-y-4">
                <div><div className="font-semibold">WhatsApp</div><Textarea rows={5} value={msg} onChange={e=>setMsg(e.currentTarget.value)} /><div className="flex gap-2 mt-2"><Button onClick={async()=>{await adapters.comms.whatsapp(msg);}}><MessageSquare className="w-4 h-4 mr-1"/>Enviar</Button></div></div>
                <div><div className="font-semibold">Email</div><Textarea rows={5} value={emailMsg} onChange={e=>setEmailMsg(e.currentTarget.value)} /><div className="flex gap-2 mt-2"><Button variant="outline" onClick={async()=>{await adapters.comms.email(emailMsg);}}><Send className="w-4 h-4 mr-1"/>Enviar Email</Button></div></div>
              </CardContent></Card>
              <Card className="rounded-2xl"><CardContent className="p-4 space-y-3"><div className="font-semibold">Calendário</div><Calendar mode="single" selected={date} onSelect={(d:any)=>setDate(d||new Date())} className="rounded-xl border" /><div className="text-xs text-muted-foreground">Slots: 10:00 • 11:00 • 15:30 (simulado)</div></CardContent></Card>
            </TabsContent>

            {/* Forms (preview simples) */}
            <TabsContent value="forms" className="grid md:grid-cols-2 gap-4">
              <Card className="rounded-2xl"><CardContent className="p-4 space-y-3">
                <div className="font-semibold">Intake (Builder)</div>
                <div className="space-y-2">
                  {(V.forms as string[]).map((f:string)=> (
                    <div key={f} className="grid grid-cols-3 gap-2 items-center">
                      <Input value={f} readOnly />
                      <Select value={'text'} onValueChange={()=>{}}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{['text','email','tel','textarea','file','number','date'].map(t=> (<SelectItem key={t} value={t}>{t}</SelectItem>))}</SelectContent>
                      </Select>
                      <Button variant="ghost" disabled>Remover</Button>
                    </div>
                  ))}
                </div>
              </CardContent></Card>
              <Card className="rounded-2xl"><CardContent className="p-4 space-y-3">
                <div className="font-semibold">Pré‑visualização</div>
                <div className="space-y-2">
                  {(V.forms as string[]).map((f:string)=> (
                    <div key={f} className="grid gap-1"><div className="text-xs text-muted-foreground">{f}</div><Input placeholder={`Introduza ${f.toLowerCase()}...`} /></div>
                  ))}
                  <Button className="mt-2"><Send className="w-4 h-4 mr-1"/>Submeter</Button>
                </div>
              </CardContent></Card>
            </TabsContent>
            {/* Social */}
            <TabsContent value="social" className="grid md:grid-cols-2 gap-4">
              <Card className="rounded-2xl"><CardContent className="p-4 space-y-3">
                <div className="font-semibold">Gerar Conteúdo</div>
                <div className="grid grid-cols-3 gap-2 items-end">
                  <div className="col-span-2">
                    <div className="text-xs mb-1">Tópico</div>
                    <Input value={socialTopic} onChange={e=>setSocialTopic(e.currentTarget.value)} placeholder="Ex.: Lançamento de campanha"/>
                  </div>
                  <Button onClick={genSocial}><Send className="w-4 h-4 mr-1"/>Gerar Post</Button>
                </div>
                <div className="text-xs text-muted-foreground">Dica: usa {"{nome}"}, {"{data}"}, {"{hora}"} no texto do post.</div>
              </CardContent></Card>
              <Card className="rounded-2xl"><CardContent className="p-4 space-y-3">
                <div className="font-semibold">Pré‑visualização</div>
                {socialImageUrl? (<img src={socialImageUrl} alt={socialTopic} className="max-h-64 rounded-lg border"/>): (<div className="text-sm text-muted-foreground">Sem imagem — gera um post.</div>)}
                <Textarea rows={5} value={socialCaption} onChange={e=>setSocialCaption(e.currentTarget.value)} placeholder="Legenda gerada aqui..."/>
              </CardContent></Card>
            </TabsContent>

            {/* Dashboard */}
            <TabsContent value="dash" className="grid gap-4">
              <Card className="rounded-2xl"><CardContent className="p-4 space-y-3">
                <div className="font-semibold">Resumo</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <KPI label={'Leads (último)'} value={KPI_SERIES[KPI_SERIES.length-1].leads} icon={Users}/>
                  <KPI label={'Ops (último)'} value={KPI_SERIES[KPI_SERIES.length-1].ops} icon={Layers}/>
                  <KPI label={'Eficiência'} value={`${KPI_SERIES[KPI_SERIES.length-1].efficiency}%`} icon={Rocket}/>
                </div>
              </CardContent></Card>
              <Card className="rounded-2xl"><CardContent className="p-4">
                <div className="px-1 py-2 font-semibold text-sm">Série mensal</div>
                <div className="overflow-auto border rounded-xl">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted"><tr>
                      <th className="px-3 py-2 text-left">Mês</th>
                      <th className="px-3 py-2 text-left">Leads</th>
                      <th className="px-3 py-2 text-left">Ops</th>
                      <th className="px-3 py-2 text-left">Eficiência</th>
                    </tr></thead>
                    <tbody>
                      {KPI_SERIES.map(row=> (
                        <tr key={row.month} className="border-t">
                          <td className="px-3 py-2">{row.month}</td>
                          <td className="px-3 py-2">{row.leads}</td>
                          <td className="px-3 py-2">{row.ops}</td>
                          <td className="px-3 py-2">{row.efficiency}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent></Card>
            </TabsContent>

          </Tabs>
        </main>
      </div>
    </TooltipProvider>
  );
}

// ---------- Small new-record form (kept last so JSX stays valid above)
function NewRecordForm({onCreate}:{onCreate:(d:any)=>void}){
  const [client,setClient]=useState('Cliente');
  const [category,setCategory]=useState('Novo');
  const [owner,setOwner]=useState('Owner A');
  const [slaDays,setSlaDays]=useState(15);
  const [value,setValue]=useState(3000);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div><div className="text-xs mb-1">Cliente</div><Input value={client} onChange={e=>setClient(e.currentTarget.value)} /></div>
        <div><div className="text-xs mb-1">Categoria</div><Input value={category} onChange={e=>setCategory(e.currentTarget.value)} /></div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div><div className="text-xs mb-1">Owner</div><Input value={owner} onChange={e=>setOwner(e.currentTarget.value)} /></div>
        <div><div className="text-xs mb-1">SLA (d)</div><Input type="number" value={slaDays} onChange={e=>setSlaDays(Number(e.currentTarget.value))} /></div>
        <div><div className="text-xs mb-1">€ Valor</div><Input type="number" value={value} onChange={e=>setValue(Number(e.currentTarget.value))} /></div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={()=>onCreate({client,category,owner,slaDays,value})}><Plus className="w-4 h-4 mr-1"/>Criar</Button>
      </div>
    </div>
  );
}
