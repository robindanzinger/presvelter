import Administration from './Administration.svelte'
import { navigateTo } from './navigate'

function render () {
  /*eslint-disable*/
  new Administration ( {
    target: document.body
  })
  /* eslint-enable */
  navigateTo(0, 0, 'fadein')
}
render()
