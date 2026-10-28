import React,{useState} from 'react';
import {Modal} from './ui.jsx';
import {uid} from '../../shared/model.mjs';

const ruleFields = [['profitTarget','Profit target (amount)'],['dailyDrawdown','Daily loss limit (amount)'],['maxDrawdown','Maximum loss limit (amount)'],['consistencyPercent','Best-day consistency limit (%)'],['profitableDays','Required profitable days'],['minimumDayProfit','Minimum daily profit (amount)']];
export function ManualAccountEditor({state,commit,onClose,setToast,existing}) {
  const [form,setForm]=useState(existing || {name:'',number:'',currency:state.settings.currency,initialBalance:'',status:'active',source:'manual',rules:{}});
  const [error,setError]=useState('');
  const set=(key,value)=>setForm(v=>({...v,[key]:value}));
  return <Modal title={existing?'Edit account':'Add manual account'} onClose={onClose}>
    <form onSubmit={async e=>{e.preventDefault();try {
      if(existing?.source==='tradersyard')throw Error('Connected accounts are updated by TradersYard.');
      if(state.accounts.some(a=>a.id!==existing?.id && a.number===form.number.trim()))throw Error('This account number already exists.');
      const rules=Object.fromEntries(ruleFields.filter(([k])=>form.rules?.[k]!=='' && form.rules?.[k]!=null).map(([k])=>[k,Number(form.rules[k])]));
      if(Object.values(rules).some(v=>!Number.isFinite(v)||v<0)||Number(rules.consistencyPercent)>100|| (rules.profitableDays!=null&&!Number.isInteger(rules.profitableDays)))throw Error('Enter valid nonnegative rule limits.');
      if(!form.name.trim() || !form.number.trim() || !Number.isFinite(Number(form.initialBalance))||Number(form.initialBalance)<0)throw Error('Enter the account name, number and starting balance.');
      const account={...form,id:existing?.id||uid(),source:'manual',name:form.name.trim(),number:form.number.trim(),initialBalance:Number(form.initialBalance),rules};
      const accounts=existing?state.accounts.map(a=>a.id===existing.id?account:a):[...state.accounts,account];
      if(await commit({...state,accounts})){setToast(existing?'Account updated':'Account created');onClose();}
    }catch(e){setError(e.message);}}}>
      <div className="form-grid">
        <label>Account name<input required maxLength={100} value={form.name} onChange={e=>set('name',e.target.value)}/></label>
        <label>Unique account number<input required maxLength={80} value={form.number} onChange={e=>set('number',e.target.value)}/></label>
        <label>Starting balance<input required type="number" min="0" step="0.01" value={form.initialBalance} onChange={e=>set('initialBalance',e.target.value)}/></label>
        <label>Currency<select value={form.currency} disabled={!!existing && state.trades.some(t=>t.accountId===existing.id)} onChange={e=>set('currency',e.target.value)}>{['USD','EUR','GBP','PKR','JPY','CAD','AUD'].map(c=><option key={c}>{c}</option>)}</select></label>
        <label>Status<select value={form.status} onChange={e=>set('status',e.target.value)}>{['active','failed','breached','blocked','in-risk-review','pending'].map(v=><option key={v}>{v}</option>)}</select></label>
      </div>
      <details className="field" open={!!existing}><summary>Account rules (optional)</summary><div className="form-grid">{ruleFields.map(([key,label])=><label key={key}>{label}<input type="number" min="0" max={key==='consistencyPercent'?100:undefined} step={key==='profitableDays'?1:0.01} value={form.rules?.[key]??''} placeholder="Not applicable" onChange={e=>setForm(v=>({...v,rules:{...v.rules,[key]:e.target.value}}))}/></label>)}</div></details>
      {error&&<p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions"><button className="button primary">{existing?'Save account':'Create account'}</button></div>
    </form>
  </Modal>;
}
