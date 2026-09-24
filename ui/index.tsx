import type { PluginUi } from '../../pluginHost/types';
import { EntityPage } from './EntityPage';
import { StrategicEntitiesPage } from './StrategicEntitiesPage';
import './strategic-entities.css';

const ui: PluginUi = {
  routes: [
    { path: '/strategic-entities', component: StrategicEntitiesPage },
    { path: '/strategic-entities/:stem', component: EntityPage },
  ],
  nav: [{ to: '/strategic-entities', label: 'Strategic Entities', icon: '★' }],
};

export default ui;
