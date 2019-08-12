<script>
  import Navigator from './Navigator.svelte'
  import { fly } from 'svelte/transition'
  import { onRender } from './navigate'
  
  let visibleFirst = true
  let first
  let second
 
  let pagetransitions = [] 
  onRender(render)

  function render (page, transition = 'fadein') {
    console.log(page, transition)
    pagetransitions.push({page, transition})
  }

  function handleTransitions () {
    if ( pagetransitions.length > 0 && runningTransitions == 0) {
      const pagetransition = pagetransitions.shift() 
      runningTransitions = 0
      updateTransition(pagetransition.transition)
      if (visibleFirst) {
        second = pagetransition.page
      } else {
        first = pagetransition.page
      }
      visibleFirst = !visibleFirst
    }
  }

  setInterval(handleTransitions, 250)


  const duration = 1000

  function updateTransition (transition) {
    if (transition === 'fadein') {
      flyIn = { x: 0, duration }
      flyOut = { x: 0, duration }
    } else if (transition === 'left') {
      flyIn = { x: -1000, duration }
      flyOut = { x: 1000, duration }
    } else if (transition === 'right') {
      flyIn = { x: 1000, duration }
      flyOut = { x: -1000, duration }
    } else if (transition === 'up') {
      flyIn = { y: -1000, duration }
      flyOut = { y: 1000, duration }
    } else if (transition === 'down') {
      flyIn = { y: 1000, duration }
      flyOut = { y: -1000, duration }
    } else if (transition === 'none') {
      flyIn = { y: 0, duration: 0 }
      flyOut = { y: 0, duration: 0 }
    }
  }
  
  let runningTransitions = 0
  
  function startTransition () {
    runningTransitions += 1
  }
  
  function endTransition () {
    runningTransitions -= 1
  }
  
  $: {
    if (document.body) {
      document.body.style.overflow = runningTransitions > 0 ? 'hidden' : ''
    }
  }
  
  let flyIn = { x: 0, duration }
  let flyOut = { x: 1000, duration }
</script>

{#if visibleFirst}
<div id='first' in:fly="{flyIn}" out:fly="{flyOut}" 
    on:introstart="{startTransition}"
    on:outrostart="{startTransition}"
    on:introend="{endTransition}"
    on:outroend="{endTransition}">
  <svelte:component this={first} />
</div>
{/if}

{#if !visibleFirst}
<div id='second' in:fly="{flyIn}" out:fly="{flyOut}"
    on:introstart="{startTransition}"
    on:outrostart="{startTransition}"
    on:introend="{endTransition}"
    on:outroend="{endTransition}">
  <svelte:component this={second} />
</div>
{/if}

<Navigator/>

<style>
  div {
    position: absolute;
    top: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
  }
</style>
