import PageTransition from './PageTransition.svelte'
import { navigateTo } from './navigate'

function render () {
  /*eslint-disable*/
  new PageTransition ( {
    target: document.body
  })
  /* eslint-enable */
  const reg = /^.*\/presentation\/(.*)\/(.*)\//
  const matches = document.URL.match(reg)

  navigateTo(matches[1], matches[2], 'fadein')
}
render()
