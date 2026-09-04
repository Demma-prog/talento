import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function duplicateGroupCount(rows:any[]){
  const phones=new Map<string,number>();
  const identities=new Map<string,number>();
  for(const row of rows){
    if(row.normalized_phone)phones.set(row.normalized_phone,(phones.get(row.normalized_phone)??0)+1);
    if(row.birth_year&&row.city){
      const key=`${row.first_name?.trim().toLowerCase()}:${row.last_name?.trim().toLowerCase()}:${row.birth_year}:${row.city.trim().toLowerCase()}`;
      identities.set(key,(identities.get(key)??0)+1);
    }
  }
  return [...phones.values()].filter(count=>count>1).length+[...identities.values()].filter(count=>count>1).length;
}

export async function GET(){
  const supabase=await createClient();
  const {data:rows,error}=await supabase.from("candidates").select("first_name,last_name,birth_year,city,normalized_phone,birth_place,declared_gender,email,phone,bio,needs_review,missing_data_confirmed").limit(1000);
  if(error)return NextResponse.json({duplicates:0,incomplete:0,pending:0});
  const incomplete=(rows??[]).filter(row=>!row.missing_data_confirmed&&(!row.birth_year||!row.birth_place||!row.declared_gender||!row.email||!row.phone||!row.city||!row.bio||row.needs_review)).length;
  const {count:pending}=await supabase.from("pending_cv_imports").select("id",{count:"exact",head:true});
  return NextResponse.json({duplicates:duplicateGroupCount(rows??[]),incomplete,pending:pending??0},{headers:{"Cache-Control":"private, no-store"}});
}
