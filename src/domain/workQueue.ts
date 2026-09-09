export function createWorkQueue(limit:number){
  let active=0;
  const waiting:{run:()=>void;signal?:AbortSignal;reject:(reason:unknown)=>void}[]=[];
  const drain=()=>{while(active<limit&&waiting.length){const task=waiting.shift()!;if(task.signal?.aborted){task.reject(new DOMException('Cancelled','AbortError'));continue;}active++;task.run();}};
  return function enqueue<T>(work:()=>Promise<T>,signal?:AbortSignal):Promise<T>{
    return new Promise((resolve,reject)=>{waiting.push({signal,reject,run:()=>{void Promise.resolve().then(work).then(resolve,reject).finally(()=>{active--;drain();});}});drain();});
  };
}
