import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type CandidateFilters={q?:string;age_min?:string;age_max?:string;gender?:string;city?:string;profile?:string;status?:string;experience_min?:string;review?:string};
export type CandidateListItem={id:string;initials:string;name:string;role:string;city:string;status:string;receivedAt:string;birthYear:number|null;gender:string|null;experienceYears:number;profile:string;needsReview:boolean};
export const statusLabels:Record<string,string>={never_contacted:"Mai contattato",to_contact:"Da contattare",contacted:"Contattato",interview_scheduled:"Colloquio programmato",accepted:"Accettato",rejected_after_contact:"Rifiutato dopo il contatto",rejected_directly:"Rifiutato direttamente",unavailable:"Non disponibile",reconsider:"Da rivalutare"};

const demoCandidates:CandidateListItem[]=[];
const normalize=(value:string)=>value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
function classifyProfile(text:string){const value=normalize(text);if(/contabil|ragionier|fatturaz|prima nota|bilancio|amministrativ.{0,12}contab/.test(value))return"accounting";if(/marketing|social media|comunicaz|advertis|campagn.{0,12}pubblic|brand|copywrit/.test(value))return"marketing";if(/cassier|gestione cassa|operatore di cassa|banconist/.test(value))return"cashier";if(/commess|addett.{0,8}vendit|sales assistant|shop assistant|retail assistant/.test(value))return"sales";if(/magazzinier|warehouse worker|scaffalist|picking|inventario|carrellist/.test(value))return"warehouse";if(/logistic|spedizion|trasport|supply chain|distribuz|ricevimento merci/.test(value))return"logistics";return"other"}
function experienceYears(rows:any[]){const months=rows.reduce((total,row)=>{if(!row.start_date)return total;const start=new Date(row.start_date);const end=row.is_current||!row.end_date?new Date():new Date(row.end_date);return total+Math.max(0,(end.getFullYear()-start.getFullYear())*12+end.getMonth()-start.getMonth())},0);return Math.round(months/12*10)/10}

export async function getCandidates(filters:CandidateFilters={}):Promise<{data:CandidateListItem[];demo:boolean;cities:string[];total:number}>{
  if(!supabaseConfigured)return{data:demoCandidates,demo:true,cities:[],total:0};
  const supabase=await createClient();
  const {data,error}=await supabase.from("candidates").select("id,first_name,last_name,birth_year,declared_gender,email,city,status,needs_review,latest_cv_received_at,experiences(role,company,description,start_date,end_date,is_current,sort_order),skills(name)").order("latest_cv_received_at",{ascending:false}).limit(1000);
  if(error)throw new Error(`Impossibile caricare i candidati: ${error.message}`);
  const cities=[...new Set((data??[]).map(row=>row.city).filter((city):city is string=>Boolean(city)))].sort((a,b)=>a.localeCompare(b,"it"));
  const currentYear=new Date().getFullYear();
  let people=(data??[]).map(row=>{const experiences=Array.isArray(row.experiences)?[...row.experiences].sort((a,b)=>a.sort_order-b.sort_order):[];const skillText=(row.skills??[]).map(skill=>skill.name).join(" ");const combined=`${experiences.map(item=>`${item.role??""} ${item.company??""} ${item.description??""}`).join(" ")} ${skillText}`;const profile=classifyProfile(combined);return{id:row.id,initials:`${row.first_name?.[0]??""}${row.last_name?.[0]??""}`.toUpperCase(),name:`${row.first_name} ${row.last_name}`,role:experiences[0]?.role??"Ruolo non indicato",city:row.city??"—",status:statusLabels[row.status]??row.status,receivedAt:row.latest_cv_received_at?new Intl.DateTimeFormat("it-IT",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(row.latest_cv_received_at)):"—",birthYear:row.birth_year,gender:row.declared_gender,experienceYears:experienceYears(experiences),profile,needsReview:row.needs_review,search:normalize(`${row.first_name} ${row.last_name} ${row.email??""} ${row.city??""} ${combined}`)}});
  if(filters.q)people=people.filter(item=>item.search.includes(normalize(filters.q!)));
  if(filters.age_min)people=people.filter(item=>item.birthYear!==null&&currentYear-item.birthYear>=Number(filters.age_min));
  if(filters.age_max)people=people.filter(item=>item.birthYear!==null&&currentYear-item.birthYear<=Number(filters.age_max));
  if(filters.gender)people=people.filter(item=>item.gender===filters.gender);
  if(filters.city)people=people.filter(item=>item.city===filters.city);
  if(filters.profile)people=people.filter(item=>item.profile===filters.profile);
  if(filters.status)people=people.filter(item=>item.status===statusLabels[filters.status!]);
  if(filters.experience_min)people=people.filter(item=>item.experienceYears>=Number(filters.experience_min));
  if(filters.review==="true")people=people.filter(item=>item.needsReview);
  return{demo:false,data:people.map(({search,...item})=>item),cities,total:people.length};
}
