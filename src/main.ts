import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import { startApp } from './app.ts';

startApp({ root: document.querySelector<HTMLElement>('#app')!, browserWindow: window });
