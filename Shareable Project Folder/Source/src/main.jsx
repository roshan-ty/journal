import React from 'react';
import {createRoot} from 'react-dom/client';
import {JournalApp} from './JournalApp.jsx';
import {ErrorBoundary} from './components/ui.jsx';
import {createStandaloneAdapter} from './adapters/standalone.mjs';
import './standalone.css';
import './style.css';
const adapter=createStandaloneAdapter();
createRoot(document.getElementById('root')).render(<ErrorBoundary><JournalApp adapter={adapter}/></ErrorBoundary>);
