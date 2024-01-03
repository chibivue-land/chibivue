// @ts-nocheck
import { createRouter, createWebHistory } from 'chibivue-router'
import PagesTop from './views/index.vue'
import PagesState from './views/state.vue'
import PagesDirective from './views/directive.vue'
import PagesPropsEmits from './views/props-emits.vue'
import PagesCompilerMacro from './views/compiler-macro.vue'
import PagesOptionsApi from './views/options-api.vue'
import PagesInline from './views/inline'

import PagesStoreCounter from './views/store-counter.vue'
import PagesTodoApp from './views/todo-list.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: PagesTop },
    { path: '/state', component: PagesState },
    { path: '/directive', component: PagesDirective },
    { path: '/props-emits', component: PagesPropsEmits },
    { path: '/compiler-macro', component: PagesCompilerMacro },
    { path: '/options-api', component: PagesOptionsApi },
    { path: '/inline', component: PagesInline },

    { path: '/store-counter', component: PagesStoreCounter },
    { path: '/todo-app', component: PagesTodoApp },
  ],
})
