// Shared by both desktop editions. Save complete endpoint results as they arrive.
function createSynchronizer({store,provider,model,collect,notify,getEpoch=()=>0}) {
  let running = null;
  return function synchronize(full=true,retry=false) {
    if (running) return running;
    const epoch = getEpoch();
    const currentEpoch = () => {
      if (getEpoch() !== epoch) throw Object.assign(Error('Disconnected; sync cancelled.'),{code:'TY_DISCONNECTED'});
    };
    running = Promise.resolve().then(async () => {
      const before = store.read();
      const previousIssues = before.state.sync.lastFullCoverage?.issues || [];
      const initialIds = new Set(before.state.trades.map(trade=>trade.id));
      store.save({...before.state,sync:{...before.state.sync,status:'syncing',message:'Finding your accounts…',progress:{phase:'accounts',completed:0,total:0}}},before.revision,{snapshot:true});
      notify();
      try {
        const snapshot = await collect(route=>{currentEpoch();return provider.getJson(route);},{
          refreshHistory:full,existing:before.state.accounts,retryIssues:retry?previousIssues:null,
          onSnapshot:async (partial,progress) => {
            currentEpoch();
            const current = store.read();
            const result = model.mergeSnapshot(current.state,partial);
            const message = progress.phase === 'accounts' ? `${progress.accounts} accounts found · Loading trades…` : progress.phase === 'trades' ? `Loading trade history · ${progress.completed} of ${progress.total}` : `Updating account rules · ${progress.completed} of ${progress.total}`;
            result.state.sync = {...current.state.sync,status:'syncing',progress,message};
            store.save(result.state,current.revision,{snapshot:false});
            notify();
          },
        });
        currentEpoch();
        const current = store.read(), result = model.mergeSnapshot(current.state,snapshot);
        const remaining = retry || full ? snapshot.issues : [...new Set([...previousIssues,...snapshot.issues])];
        const newTrades = result.state.trades.filter(trade=>!initialIds.has(trade.id)).length;
        result.state.sync = {...result.state.sync,progress:null,status:remaining.length?'partial':'connected',
          message:`${snapshot.accounts.length} accounts · ${newTrades} new trades${remaining.length?` · ${remaining.length} items need retry`:''}`,
          lastFullCoverage:{...(full && !retry ? snapshot.coverage : before.state.sync.lastFullCoverage || snapshot.coverage),issues:remaining,...(retry?{recoveredAt:new Date().toISOString()}:{}),tradeRows:result.state.trades.filter(t=>t.source==='tradersyard').length},
        };
        store.save(result.state,current.revision,{snapshot:false}); notify();
        return {message:result.state.sync.message,coverage:result.state.sync.lastFullCoverage};
      } catch (error) {
        if (getEpoch() !== epoch) return {message:'Disconnected; sync cancelled.'};
        const current = store.read();
        // Preserve every completed account/history batch when a later request fails.
        store.save({...current.state,sync:{...current.state.sync,status:'error',progress:null,message:error.message}},current.revision,{snapshot:false});
        notify(); throw error;
      }
    }).finally(()=>{running=null;});
    return running;
  };
}
module.exports={createSynchronizer};
