<script>
  import Navigator from './Navigator.svelte'
  import { onRender, getPageMap, syncMode } from './navigate'

  let slide

  let showTimer = false
  let startDate = new Date()
  let actualDate = new Date()

  $: elapsedTime = Math.round((actualDate - startDate) / 1000)

  let interval
  let timerRunning
  $: startstop = timerRunning ? 'stop' : 'start'

  onRender((page, transition) => {
   resetTimer()
   slide = page
  })

  function handleStop() {
    if (timerRunning) {
      clearInterval(interval)
      timerRunning = false
    }
  }

  function handleStart() {
    if (!timerRunning) {
      resetTimer()
      interval = setInterval(() => {
        actualDate = new Date()
        }, 1000)
      timerRunning = true
    }
  }

  function resetTimer() {
    actualDate = new Date()
    startDate = new Date()
  }

  function toggleSyncMode() {

  }

  const topics = getPageMap()
</script>
<ul>
  {#each topics as slides}
   <li>
  <ul>
   {#each slides as slide} 
   <li style="display:inline">{slide} </li>
   {/each}
  </ul>
   </li>
  {/each}
</ul>
<input type=checkbox bind:checked={$syncMode}>sync
<input type=checkbox bind:checked={showTimer}>Show Timer


<div class="preview">
<svelte:component this={slide} />
</div>

{#if showTimer}
<button on:click={handleStart}>start</button>
<button on:click={handleStop}>stop</button>
<button on:click={resetTimer}>reset</button>

<div id='elapsed'>
  <h2> {elapsedTime} Sekunden </h2>
</div>
{/if}

<Navigator/>


<style>
  .preview {
    height: 100%;
    width: 100%;
    border-style: solid;
    border-width: medium;
    transform: scale(0.4);
    position: fixed;
  }
  #elapsed {
   width: 100%; 
  }
  input {
    margin-left: 40px;
  }
  h2 {
    margin-left: 40px;
    width: calc(100% - 40px) ;
  }
</style>
