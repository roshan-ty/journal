import {product} from '../product.js';
import React,{useEffect,useRef,useState} from 'react';
import {ArrowRight,ArrowUpRight,Sparkles} from 'lucide-react';
import {answerCoach,buildCoachContext} from '../../shared/coach.mjs';
import {coachLanguages} from '../../shared/coach-languages.mjs';
import knowledge from '../../knowledge/tradersyard.json';

export function Coach({state,adapter}) {
  const [question,setQuestion]=useState(''),[messages,setMessages]=useState([]),[language,setLanguage]=useState('auto'),[busy,setBusy]=useState(false);
  const bottom=useRef(null),active=useRef(true);
  useEffect(()=>{active.current=true;return ()=>{active.current=false;};},[]);
  useEffect(()=>{const pane=bottom.current?.parentElement;if(pane)pane.scrollTop=pane.scrollHeight;},[messages,busy]);
  const ask=async q=>{
    if(!q.trim()||busy)return;
    setBusy(true);setQuestion('');
    const input={question:q.trim().slice(0,4000),state,language,history:messages,knowledge};
    try {
      const answer=adapter.coach?await adapter.coach(buildCoachContext(input)):answerCoach(input);
      if(!answer||typeof answer.text!=='string')throw Error('The coach returned an invalid response.');
      if(active.current)setMessages(m=>[...m,{question:q,answer}]);
    }catch(e){if(active.current)setMessages(m=>[...m,{question:q,answer:{title:product.coachName,text:e.message,facts:[],sources:[]}}]);}
    finally{if(active.current)setBusy(false);}
  };
  return <section className="panel coach-page">
    <div className="panel-head"><h2><Sparkles size={20}/>{product.coachName}</h2><select className="coach-language" aria-label="Coach language" value={language} onChange={e=>setLanguage(e.target.value)}>{coachLanguages.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></div>
    <p className="coach-scope">All {state.accounts.length} accounts · Full trade history</p>
    <div className="coach-conversation" role="log" aria-label="Coach conversation" aria-live="polite">
      {!messages.length&&<div className="coach-welcome"><Sparkles size={32}/><h2>What would you like to review?</h2><div className="prompt-grid">{['Why am I making losses?','Which strategy works best for me?','Explain the rules for my accounts','How should I manage my risk?','Tell me about the TradersYard team','Mera nuksan kyun ho raha hai?'].map(q=><button key={q} onClick={()=>ask(q)}>{q}<ArrowUpRight size={16}/></button>)}</div></div>}
      {messages.map((m,i)=><div className="conversation-pair" key={i}><div className="user-message" dir="auto">{m.question}</div><div className="coach-message" dir={['ur','ar'].includes(m.answer.language)?'rtl':'auto'}><div className="row"><Sparkles size={16}/><b>{product.coachName}</b></div>{m.answer.facts?.map((fact,j)=><div className="coach-fact" key={j}>{fact}</div>)}<p>{m.answer.text}</p>{m.answer.sources?.length>0&&<div className="source-links">{m.answer.sources.filter(s=>/^https:\/\/(help\.)?tradersyard\.com\//.test(s.url||'')).map(s=><a key={s.url+s.title} href={s.url} target="_blank" rel="noreferrer">{s.title}</a>)}</div>}</div></div>)}
      {busy&&<p className="subtle">Reviewing your journal…</p>}<div ref={bottom}/>
    </div>
    <form className="coach-composer" onSubmit={e=>{e.preventDefault();ask(question);}}><textarea rows={2} maxLength={4000} aria-label={`Ask ${product.coachName}`} placeholder="Ask about your results, account rules, strategies or TradersYard…" value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();ask(question);}}}/><button className="button primary" aria-label="Send question" disabled={!question.trim()||busy}><ArrowRight size={20}/></button></form>
  </section>;
}
