import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function forward(method:"GET"|"POST",path:string){
  const supabase=await createClient();const {data}=await supabase.auth.getSession();
  if(!data.session)return NextResponse.json({detail:"Sessione scaduta"},{status:401});
  const api=process.env.NEXT_PUBLIC_BACKEND_URL||process.env.NEXT_PUBLIC_API_URL;
  if(!api)return NextResponse.json({detail:"Backend non configurato"},{status:503});
  try{
    const response=await fetch(`${api}${path}`,{method,headers:{Authorization:`Bearer ${data.session.access_token}`,"Content-Type":"application/json"},body:method==="POST"?"{}":undefined,cache:"no-store",signal:AbortSignal.timeout(30000)});
    return new NextResponse(await response.text(),{status:response.status,headers:{"Content-Type":"application/json","Cache-Control":"private, no-store"}});
  }catch{return NextResponse.json({detail:"Il server non risponde. Riprova tra qualche secondo."},{status:504})}
}
export async function GET(){return forward("GET","/imports/background/status")}
export async function POST(){return forward("POST","/imports/background/start")}
export async function DELETE(){return forward("POST","/imports/background/cancel")}
