import { renderScaffoldPage } from './pages/scaffold-page.js';

const root = document.getElementById('app');
if (!root) throw new Error('The scaffold requires an #app root element.');
root.innerHTML = renderScaffoldPage('Deski');
