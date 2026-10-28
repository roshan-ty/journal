import React, {useState} from 'react';
import {Link2, Plus, ArrowRight} from 'lucide-react';
import {Modal} from './ui.jsx';
import {uid} from '../../shared/model.mjs';
import {product,logo} from '../product.js';

export function ProfileForm({state, commit, onClose}) {
  const [name,setName]=useState(state.profile?.name || '');
  return <Modal title={state.profile ? 'Edit profile' : 'Create Profile'} onClose={onClose}>
    <form onSubmit={async event=>{event.preventDefault();if(!name.trim())return;
      if(await commit({...state,profile:{id:state.profile?.id || uid(),createdAt:state.profile?.createdAt || new Date().toISOString(),name:name.trim()}}))onClose();}}>
      <label className="field">Your name<input required maxLength={80} autoComplete="name" value={name} onChange={e=>setName(e.target.value)}/></label>
      <div className="modal-actions"><button className="button primary">{state.profile ? 'Save profile' : 'Create Profile'}<ArrowRight size={16}/></button></div>
    </form>
  </Modal>;
}

export function Welcome({connect,createProfile,busy,message}) {
  return <section className="welcome-screen">
    <div className="welcome-brand"><span className="welcome-logo"><img src={logo} alt={product.shortName}/></span><span>{product.shortName} <b>Journal</b></span></div>
    <h1>Welcome to your journal</h1>
    <div className="welcome-options">
      <button className="welcome-option" onClick={connect} disabled={busy}><Link2 size={24}/><h2>Connect Account</h2><p>Sign in to TradersYard to sync your accounts and trades.</p><span className="button primary">Connect TradersYard <ArrowRight size={16}/></span></button>
      <button className="welcome-option" onClick={createProfile}><Plus size={24}/><h2>Create Profile</h2><p>Add your accounts and trades manually. Connect TradersYard at any time.</p><span className="button">Create Profile <ArrowRight size={16}/></span></button>
    </div>
    {message && <p role="status" className="notice">{message}</p>}
  </section>;
}
