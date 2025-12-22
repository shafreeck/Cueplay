import { ConfigStore } from './src/config/store'; async function run() { await ConfigStore.load(); console.log('Global Cookie:', ConfigStore.getGlobalCookie()); } run();
