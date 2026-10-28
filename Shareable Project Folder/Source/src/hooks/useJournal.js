import {useCallback, useEffect, useRef, useState} from 'react';
import {emptyState, validateState} from '../../shared/model.mjs';
import {newerRecord,reuseJournalData} from '../../shared/records.mjs';

export function useJournal(adapter) {
  const [record, setRecord] = useState({state: emptyState(), revision: 0});
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState('');
  const active = useRef(true);
  const generation = useRef(0);
  const serial = useRef(0);
  const reload = useCallback(async () => {
    const request = ++serial.current;
    try {
      const result = await adapter.load();
      if (active.current && request === serial.current) {
        const validated = {...result, state: validateState(result.state)};
        newerRecord({revision:0}, validated);
        setRecord(current => reuseJournalData(current, validated));
        setLoaded(true); setSaveError('');
      }
    } catch(error) { if(active.current && request === serial.current) setSaveError(error.message); }
  }, [adapter]);
  useEffect(() => {
    generation.current++; active.current = true;
    setRecord({state: emptyState(), revision: 0}); setLoaded(false); reload();
    const unsubscribe = adapter.subscribe?.(reload);
    return () => {active.current=false; generation.current++; serial.current++; unsubscribe?.();};
  }, [adapter,reload]);
  const commit = async state => {
    const started = generation.current;
    try {
      const result = await adapter.save(validateState(state), record.revision);
      const validated = {...result, state: validateState(result.state)};
      newerRecord({revision:0}, validated);
      if (!active.current || started !== generation.current) return false;
      setRecord(current => reuseJournalData(current, validated));setSaveError('');
      return true;
    } catch(error) {
      if (!active.current || started !== generation.current) return false;
      await reload(); if(active.current && started === generation.current) setSaveError(error.message); return false;
    }
  };
  return {state: record.state, commit, loaded, saveError, reload};
}
