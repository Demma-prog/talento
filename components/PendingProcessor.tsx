"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Play } from "lucide-react";

export function PendingProcessor({count}:{count:number}){
  const router=useRouter();const [running,setRunning]=useState(false);const [message,setMessage]=useState("");
  async function process(){setRunning(true);setMessage("");let remaining=count,done=0;try{while(remaining>0){const response=await fetch("/api/imports/pending/process",{method:"POST"});const result=await response.json();if(!response.ok)throw new Error(result.detail??"Elaborazione non riuscita");const completed=(result.imported??0)+(result.updated??0)+(result.duplicate??0);done+=completed;remaining=Math.max(0,remaining-completed);if(!completed){setMessage(result.errors?.[0]??"Il motore AI non è disponibile: i CV restano al sicuro nella coda.");break}setMessage(`${done} CV elaborati, ${remaining} rimanenti…`)}}catch(cause){setMessage(cause instanceof Error?cause.message:"Elaborazione non riuscita")}finally{setRunning(false);router.refresh()}}
  return <div className="pending-action"><button className="primary-button purple-button" onClick={process} disabled={running||!count}>{running?<LoaderCircle className="spin" size={16}/>:<Play size={16}/>} Elabora la coda</button>{message&&<small>{message}</small>}</div>
}
