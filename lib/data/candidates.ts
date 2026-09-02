import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type CandidateFilters={q?:string;age_min?:string;age_max?:string;gender?:string;city?:string;profile?:string;sector?:string;status?:string;experience_min?:string;review?:string};
export type CandidateListItem={id:string;initials:string;name:string;role:string;city:string;status:string;receivedAt:string;birthYear:number|null;gender:string|null;experienceYears:number;profile:string;sector:string;needsReview:boolean};
export const statusLabels:Record<string,string>={never_contacted:"Mai contattato",to_contact:"Da contattare",contacted:"Contattato",interview_scheduled:"Colloquio programmato",accepted:"Accettato",rejected_after_contact:"Rifiutato dopo il contatto",rejected_directly:"Rifiutato direttamente",unavailable:"Non disponibile",reconsider:"Da rivalutare"};

const demoCandidates:CandidateListItem[]=[];
const normalize=(value:string)=>value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
function classifyProfile(text:string){const value=normalize(text);if(/commess|addett.{0,8}vendit|sales assistant|shop assistant/.test(value))return"sales";if(/magazzin|warehouse|logistic|scaffal/.test(value))return"warehouse";if(/cassier|gestione cassa|banconist/.test(value))return"cashier";if(/impiegat|segreter|amministr|ufficio|office|back.?office|contabil/.test(value))return"office";return"other"}
function classifySector(text:string){const value=normalize(text);if(/vendit|retail|negozio|moda|abbigli|supermerc|gdo/.test(value))return"retail";if(/magazzin|logistic|trasport|warehouse|spedizion/.test(value))return"logistics";if(/amministr|ufficio|office|contabil|segreter/.test(value))return"administration";if(/ristor|bar|cucin|camerier|food/.test(value))return"hospitality";return"other"}
function experienceYears(rows:any[]){const months=rows.reduce((total,row)=>{if(!row.start_date)return total;const start=new Date(row.start_date);const end=row.is_current||!row.end_date?new Date():new Date(row.end_date);return total+Math.max(0,(end.getFullYear()-start.getFullYear())*12+end.getMonth()-start.getMonth())},0);return Math.round(months/12*10)/10}

export async function getCandidates(filters:CandidateFilters={}):Promise<{data:CandidateListItem[];demo:boolean;cities:string[];total:number}>{
  if(!supabaseConfigured)return{data:demoCandidates,demo:true,cities:[],total:0};
  const supabase=await createClient();
  const {data,error}=await supabase.from("candidates").select("id,first_name,last_name,birth_year,declared_gender,email,city,status,needs_review,latest_cv_received_at,experiences(role,company,description,start_date,end_date,is_current,sort_order),skills(name)").order("latest_cv_received_at",{ascending:false}).limit(1000);
  if(error)throw new Error(`Impossibile caricare i candidati: ${error.message}`);
  const cities=[...new Set((data??[]).map(row=>row.city).filter((city):city is string=>Boolean(city)))].sort((a,b)=>a.localeCompare(b,"it"));
  const currentYear=new Date().getFullYear();
  let people=(data??[]).map(row=>{const experiences=Array.isArray(row.experiences)?[...row.experiences].sort((a,b)=>a.sort_order-b.sort_order):[];const combined=experiences.map(item=>`${item.role??""} ${item.company??""} ${item.description??""}`).join(" ");const profile=classifyProfile(combined);const sector=classifySector(combined);return{id:row.id,initials:`${row.first_name?.[0]??""}${row.last_name?.[0]??""}`.toUpperCase(),name:`${row.first_name} ${row.last_name}`,role:experiences[0]?.role??"Profilo da definire",city:row.city??"—",status:statusLabels[row.status]??row.status,receivedAt:row.latest_cv_received_at?new Intl.DateTimeFormat("it-IT",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(row.latest_cv_received_at)):"—",birthYear:row.birth_year,gender:row.declared_gender,experienceYears:experienceYears(experiences),profile,sector,needsReview:row.needs_review,search:normalize(`${row.first_name} ${row.last_name} ${row.email??""} ${row.city??""} ${combined} ${(row.skills??[]).map(skill=>skill.name).join(" ")}`)}});
  if(filters.q)people=people.filter(item=>item.search.includes(normalize(filters.q!)));
  if(filters.age_min)people=people.filter(item=>item.birthYear!==null&&currentYear-item.birthYear>=Number(filters.age_min));
  if(filters.age_max)people=people.filter(item=>item.birthYear!==null&&currentYear-item.birthYear<=Number(filters.age_max));
  if(filters.gender)people=people.filter(item=>item.gender===filters.gender);
  if(filters.city)people=people.filter(item=>item.city===filters.city);
  if(filters.profile)people=people.filter(item=>item.profile===filters.profile);
  if(filters.sector)people=people.filter(item=>item.sector===filters.sector);
  if(filters.status)people=people.filter(item=>item.status===statusLabels[filters.status!]);
  if(filters.experience_min)people=people.filter(item=>item.experienceYears>=Number(filters.experience_min));
  if(filters.review==="true")people=people.filter(item=>item.needsReview);
  return{demo:false,data:people.map(({search,...item})=>item),cities,total:people.length};
}
