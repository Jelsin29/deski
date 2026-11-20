import { createApp } from './app.ts';

const root = document.getElementById('app');
if (!root) throw new Error('Deski requires an #app root element.');
createApp(root, window.deski, window.localStorage);
