import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(){
  const supabase=await createClient();const {data}=await supabase.auth.getSession();
  if(!data.session)return NextResponse.json({detail:"Sessione scaduta"},{status:401});
  const api=process.env.NEXT_PUBLIC_BACKEND_URL||process.env.NEXT_PUBLIC_API_URL;
  if(!api)return NextResponse.json({detail:"Backend non configurato"},{status:503});
  try{
    const response=await fetch(`${api}/imports/pending/process`,{method:"POST",headers:{Authorization:`Bearer ${data.session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({limit:3}),cache:"no-store",signal:AbortSignal.timeout(120000)});
    const body=await response.text();return new NextResponse(body,{status:response.status,headers:{"Content-Type":"application/json"}});
  }catch{return NextResponse.json({detail:"Il server non risponde. Riprova tra qualche secondo."},{status:504})}
}
