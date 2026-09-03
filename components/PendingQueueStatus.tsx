"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

type QueueState={pending:number;failed?:number;worker_online?:boolean;seconds_per_cv?:number;estimated_seconds?:number};
function duration(value:number){const minutes=Math.ceil(Math.max(0,value)/60);if(minutes<60)return `${minutes} min`;const hours=Math.floor(minutes/60),rest=minutes%60;return rest?`${hours} h ${rest} min`:`${hours} h`}
export function PendingQueueStatus({initialCount}:{initialCount:number}){
  const router=useRouter();
  const [state,setState]=useState<QueueState>({pending:initialCount});const [loading,setLoading]=useState(true);
  const refresh=useCallback(async()=>{try{const response=await fetch("/api/imports/background",{cache:"no-store"});if(response.ok)setState(await response.json())}finally{setLoading(false)}},[]);
  useEffect(()=>{refresh();const timer=window.setInterval(refresh,3000);return()=>window.clearInterval(timer)},[refresh]);
  useEffect(()=>{if(!loading&&state.pending!==initialCount)router.refresh()},[initialCount,loading,router,state.pending]);
  return <div className="queue-live-status"><span className={`worker-indicator ${state.worker_online?"online":"offline"}`}>{loading?<LoaderCircle className="spin" size={13}/>:null}{state.worker_online?"Qwen attivo":"Worker non collegato"}</span><span><b>{state.pending}</b> in attesa</span><span><b>{state.failed??0}</b> da rivedere</span><span><b>{state.estimated_seconds?duration(state.estimated_seconds):"—"}</b> rimanenti</span><span><b>{state.seconds_per_cv?duration(state.seconds_per_cv):"—"}</b> per CV</span></div>
}
