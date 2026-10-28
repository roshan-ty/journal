import React, {useEffect, useId, useRef, useState} from 'react';
import {Check, ChevronDown, Wallet} from 'lucide-react';

export function AccountPicker({accounts, value, onChange}) {
  const options = [
    {id:'all', label:'All accounts', detail:`${accounts.length} accounts`},
    ...accounts.map(account => ({id:account.id, label:account.number, detail:account.name})),
  ];
  const selected = options.findIndex(option => option.id === value);
  const current = options[Math.max(0, selected)];
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [space, setSpace] = useState(320);
  const root = useRef(null), trigger = useRef(null), list = useRef(null);
  const search = useRef({text:'', time:0});
  const id = useId();
  const active = Math.min(highlight, options.length - 1);

  function show() {
    setHighlight(Math.max(0, selected));
    search.current = {text:'',time:0};
    const bounds = root.current.getBoundingClientRect();
    setSpace(Math.min(320, Math.max(100, window.innerHeight - bounds.bottom - 20)));
    setOpen(true);
  }
  function close(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  }
  function choose(index) {
    onChange(options[index].id);
    close(true);
  }
  useEffect(() => {
    if (!open) return;
    list.current?.focus();
    const outside = event => {if (!root.current?.contains(event.target)) setOpen(false);};
    const resize = () => setOpen(false);
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', resize);
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('resize', resize);
    };
  }, [open]);
  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({block:'nearest'});
  }, [open, active]);
  function keyDown(event) {
    const moves = {ArrowDown:1, ArrowUp:-1, PageDown:5, PageUp:-5};
    if (event.key in moves) {
      event.preventDefault();
      setHighlight(index => Math.max(0, Math.min(options.length - 1, index + moves[event.key])));
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault(); setHighlight(event.key === 'Home' ? 0 : options.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); choose(active);
    } else if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); close(true);
    } else if (event.key === 'Tab') {
      // Return focus to the trigger before the browser advances to the next control.
      close(true);
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      search.current = {text:(now - search.current.time < 700 ? search.current.text : '') + event.key.toLowerCase(), time:now};
      const match = options.findIndex(option => `${option.label} ${option.detail}`.toLowerCase().startsWith(search.current.text));
      if (match !== -1) setHighlight(match);
    }
  }
  return <div className="account-picker" ref={root} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={trigger} type="button" className="account-picker-trigger"
      aria-label="Trading account" aria-haspopup="listbox" aria-expanded={open}
      aria-controls={open ? id : undefined} title={`${current.label} · ${current.detail}`}
      onClick={() => open ? close() : show()}
      onKeyDown={event => {if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {event.preventDefault();show();}}}>
      <Wallet size={16}/><span>{current.label}<span className="account-picker-detail"> · {current.detail}</span></span><ChevronDown size={15}/>
    </button>
    {open && <div className="account-picker-menu" id={id} ref={list} role="listbox"
      aria-label="Trading accounts" aria-activedescendant={`${id}-${active}`} tabIndex={-1}
      style={{maxHeight:space}} onKeyDown={keyDown}>
      {options.map((option,index) => <div key={option.id} id={`${id}-${index}`} role="option"
        aria-selected={value === option.id} className={`account-picker-option ${active === index ? 'highlighted' : ''}`}
        onPointerMove={() => setHighlight(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}>
        <span><strong>{option.label}</strong><small title={option.detail}>{option.detail}</small></span>
        {value === option.id && <Check size={16}/>}
      </div>)}
    </div>}
  </div>;
}
