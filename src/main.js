import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import { startApp } from './app.js';

startApp({ root: document.querySelector('#app'), browserWindow: window });
