import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { Admin } from './Admin';
import './styles.css';

const path = window.location.pathname;
const RootComponent = path.startsWith('/admin') ? Admin : App;

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <RootComponent />
  </React.StrictMode>,
);
