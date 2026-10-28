import {stats, groupBy, net, ruleProgress} from './analytics.mjs';

// All accounts and all recorded dates are intentional. Never sum unlike currencies.
export function analyseJournal(state) {
  const timezone=state.settings.timezone;
  const currencies=[...new Set(state.accounts.map(a=>a.currency))];
  const summaries=currencies.map(currency=>{
    const accounts=state.accounts.filter(a=>a.currency===currency);
    const ids=new Set(accounts.map(a=>a.id));
    const trades=state.trades.filter(t=>ids.has(t.accountId));
    const closed=trades.filter(t=>t.status==='closed').sort((a,b)=>new Date(a.closedAt)-new Date(b.closedAt));
    const result=stats(trades,timezone);
    const dimensions=['symbol','strategy','side'].map(key=>({key,groups:groupBy(trades,key,timezone).sort((a,b)=>a.total-b.total)}));
    const strategies=groupBy(trades,'strategy',timezone).filter(g=>g.name!=='Unassigned').sort((a,b)=>b.expectancy-a.expectancy);
    const midpoint=Math.floor(closed.length/2);
    const before=stats(closed.slice(0,midpoint),timezone,false),recent=stats(closed.slice(midpoint),timezone,false);
    const accountStats=accounts.map(account=>({id:account.id,number:account.number,name:account.name,status:account.status,initialBalance:account.initialBalance,
      ...stats(trades.filter(t=>t.accountId===account.id),timezone,false),
      rules:account.rules||{},progress:ruleProgress(account,trades,timezone).rules,
      syncedAt:account.syncedAt,source:account.source})).sort((a,b)=>a.total-b.total);
    const afterLoss=closed.filter((t,i)=>i>0 && net(closed[i-1])<0);
    const breakEven=result.wins>0 && result.losses>0 ? 100*result.averageLoss/(result.averageWin+result.averageLoss):null;
    const lossTrade=closed.length?closed.reduce((a,b)=>net(a)<net(b)?a:b):null;
    const largestLoss=lossTrade?Object.fromEntries(['id','accountId','symbol','side','closedAt','grossPnl','fees','providerNetPnl'].map(k=>[k,lossTrade[k]])):null;
    return {currency,accountCount:accounts.length,...result,breakEven,dimensions,strategies,before,recent,accountStats,
      afterLoss:stats(afterLoss,timezone,false),missingRisk:closed.filter(t=>!t.initialRisk).length,
      missingStrategy:closed.filter(t=>!t.strategy).length,
      largestLoss};
  });
  return {accountCount:state.accounts.length,closedCount:state.trades.filter(t=>t.status==='closed').length,
    currencies:summaries,timezone,lastSync:state.sync.lastSync,statusCounts:state.accounts.reduce((v,a)=>(v[a.status]=(v[a.status]||0)+1,v),{}),
    incomplete:!!(state.sync.lastFullCoverage?.issues?.length||state.sync.coverage?.issues?.length)};
}
