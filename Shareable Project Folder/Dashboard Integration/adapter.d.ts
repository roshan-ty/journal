export interface JournalRecord { state: JournalState; revision: number; }
export interface JournalState {
  schemaVersion: 1;
  profile?: {id: string; name: string; createdAt?: string} | null;
  accounts: Array<{id: string; number: string; name: string; currency: string; source: string; status: string; [key: string]: unknown}>;
  trades: Array<{id: string; accountId: string; status: 'open'|'closed'; [key:string]: unknown}>;
  settings: {brand:string;theme:'dark'|'light';timezone:string;currency:string;coachKnowledge:string};
  sync: {connection?:'connected'|'disconnected';status:'disconnected'|'connected'|'partial'|'syncing'|'error';lastSync?:string|null;message?:string;progress?:{phase:'accounts'|'trades'|'rules';completed:number;total:number}|null;[key:string]:unknown};
  [key:string]: unknown;
}
export interface JournalAdapter {
  load(): Promise<JournalRecord>;
  save(state:JournalState,expectedRevision:number): Promise<JournalRecord>;
  subscribe?(listener:()=>void): ()=>void;
  connect?(): Promise<{connected?:boolean;message?:string}|void>;
  sync?(): Promise<{message?:string}>;
  retry?(): Promise<unknown>;
  disconnect?(): Promise<unknown>;
  exportBackup?(): Promise<unknown>;
  /** Host-owned inference; no model service is contacted by the journal itself. */
  coach?(context:Record<string,unknown>): Promise<{text:string;facts?:string[];language?:string;sources?:Array<{title:string;url:string}>}>;
}
export interface JournalOptions {
  adapter:JournalAdapter;
  identity?:{id:string;name:string};
  embedded?:boolean;
  theme?:'dark'|'light';
}
export declare function mountJournal(element:HTMLElement,options:JournalOptions): {update(options:Partial<JournalOptions>):void;unmount():void};
