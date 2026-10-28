import React from 'react';
import {createRoot} from 'react-dom/client';
import {JournalApp} from './JournalApp.jsx';
import {ErrorBoundary} from './components/ui.jsx';
import './style.css';

export {JournalApp};
/** Mount inside any host, including TradersYard's Vue dashboard. */
export function mountJournal(element,options) {
  if(!element || !options?.adapter?.load || !options?.adapter?.save) throw Error('A mount element and journal adapter are required.');
  const root=createRoot(element);
  let current={...options,embedded:options.embedded??true};
  const render=()=>root.render(<ErrorBoundary key={current.identity?.id||'standalone'}><JournalApp {...current}/></ErrorBoundary>);
  render();
  return {update(next){current={...current,...next};render();},unmount(){root.unmount();}};
}
