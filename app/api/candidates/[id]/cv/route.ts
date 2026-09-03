import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const supabase=await createClient();
  const {data}=await supabase.auth.getSession();
  if(!data.session)return NextResponse.json({detail:"Sessione scaduta"},{status:401});
  const api=process.env.NEXT_PUBLIC_BACKEND_URL||process.env.NEXT_PUBLIC_API_URL;
  const response=await fetch(`${api}/candidates/${id}/cv`,{headers:{Authorization:`Bearer ${data.session.access_token}`},cache:"no-store"});
  if(!response.ok){const body=await response.text();return new NextResponse(body||"CV non disponibile",{status:response.status,headers:{"Content-Type":response.headers.get("content-type")??"text/plain"}})}
  const bytes=await response.arrayBuffer();
  if(!bytes.byteLength)return NextResponse.json({detail:"Il curriculum ricevuto è vuoto"},{status:502});
  return new NextResponse(bytes,{status:200,headers:{"Content-Type":response.headers.get("content-type")??"application/octet-stream","Content-Disposition":response.headers.get("content-disposition")??"inline","Content-Length":String(bytes.byteLength),"Cache-Control":"private, no-store"}});
}
