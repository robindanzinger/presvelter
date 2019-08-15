<script>
  import Navigator from './Navigator.svelte'
  import { fade } from 'svelte/transition'
  import Switch from './components/Switch.svelte'
  import { onRender, getPageMap, syncMode } from './navigate'

  let slide

  let showTimer = false
  let startDate = new Date()
  let actualDate = new Date()

  $: elapsedTime = Math.round((actualDate - startDate) / 1000)

  let interval
  let timerRunning

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

  const topics = getPageMap()
</script>
<h1>Cockpit</h1>
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

<div class="options">
  <Switch label="Sync" bind:checked={$syncMode}/>
  <div class="space" />
  <Switch label="Timer" bind:checked={showTimer}/>
</div>

{#if showTimer}
  <div class="timerpanel" transition:fade>
    <div class="buttonpanel">
      <button class="btn" on:click={handleStart}><i class="fa fa-play-circle fa-lg" /></button>
      <button class="btn" on:click={handleStop}><i class="fa fa-stop-circle fa-lg"></i></button>
      <button class="btn" on:click={resetTimer}><i class="fa fa-undo fa-lg"></i></button>
    </div>

    <div id='elapsed'>
      <h2>{elapsedTime} Sekunden </h2>
      <div class="space" />
    </div>
  </div>
{/if}

<Navigator/>

<div class="preview">
<svelte:component this={slide} />
</div>

<style>
  .btn {
    background-color: DodgerBlue;
    border: none;
    color: white;
    padding: 12px 16px;
             font-size: 16px;
    cursor: pointer;
  }
  .preview {
    margin-top: 80px;
    height: 100%;
    width: 100%;
    border-style: solid;
    border-width: medium;
    transform: scale(0.4);
    position: fixed;
    transform-origin: top;
  }
  #elapsed {
   width: 100%;
   display: flex;
   justify-content: flex-end;
  }
  input {
    margin-left: 40px;
  }
  .options {
    margin-left: 80px;
    display: flex;
   }
  .space {
    width: 20px;
   }
  .timerpanel {
    margin-left: 80px;
    margin-top: 20px;
    width: 300px;
    border: solid 1px;
  }
  .timerpanel .buttonpanel {
    display: flex;
    justify-content: center;
  }
  .buttonpanel button {
    margin: 4px;
  }
</style>
