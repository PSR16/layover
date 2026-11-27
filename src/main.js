import './styles/tokens.css';
import './styles/base.css';
import { startRouter } from './router.js';
import { createShell } from './views/app-shell.js';
import { renderOrgView } from './views/org-view.js';
import { renderVolunteerView } from './views/volunteer-view.js';

const VIEWS = { volunteer: renderVolunteerView, org: renderOrgView };

const shell = createShell(document.querySelector('#app'));

startRouter({
  browserWindow: window,
  onRoute(route) {
    shell.showRoute(route.name);
    VIEWS[route.name](shell.main);
  },
});
