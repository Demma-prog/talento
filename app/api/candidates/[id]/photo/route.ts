import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const supabase=await createClient();
  const {data}=await supabase.auth.getSession();
  if(!data.session)return NextResponse.json({detail:"Sessione scaduta"},{status:401});
  const api=process.env.NEXT_PUBLIC_BACKEND_URL||process.env.NEXT_PUBLIC_API_URL;
  const response=await fetch(`${api}/candidates/${id}/photo`,{headers:{Authorization:`Bearer ${data.session.access_token}`},cache:"no-store"});
  if(!response.ok)return NextResponse.json({detail:"Foto non disponibile"},{status:response.status});
  return new NextResponse(response.body,{status:200,headers:{"Content-Type":"image/webp","Cache-Control":"private, max-age=3600"}});
}
