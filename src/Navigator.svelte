<script>


import { currentSlide, getNumberOfTopics, getNumberOfSlides } from './pagemap'

import { navigateTo } from './navigate'

let leftdisabled = false
let rightdisabled = false
let updisabled = false
let downdisabled = false

let currentTopicIndex = 0
let currentSlideIndex = 0

currentSlide.subscribe(slide => {
  currentTopicIndex = slide.topicIndex
  currentSlideIndex = slide.slideIndex
})

$: {
  leftdisabled = (currentSlideIndex < 1)
  rightdisabled = (currentSlideIndex >= getNumberOfSlides(currentTopicIndex) - 1)
  updisabled = (currentTopicIndex < 1)
  downdisabled = (currentTopicIndex >= getNumberOfTopics() - 1)
}

function handleKeyDown (e) {
}

function handleKeyUp (e) {
  const key = e.key.toLowerCase()
  switch (key) {
    case 'arrowleft':
    case 'h':
      left()
      break
    case 'arrowdown':
    case 'j':
      down()
      break
    case 'arrowup':
    case 'k':
      up()
      break
    case 'arrowright':
    case 'l':
      right()
      break
  }
}

function left () {
  if (currentSlideIndex > 0) {
    currentSlideIndex--
    updateView('left')
  }
}

function right () {
  if (currentSlideIndex < getNumberOfSlides(currentTopicIndex) - 1) {
    currentSlideIndex++
    updateView('right')
  }
}

function up () {
  if (currentTopicIndex > 0) {
    currentTopicIndex--
    currentSlideIndex = 0
    updateView('up')
  }
}

function down () {
  if (currentTopicIndex < getNumberOfTopics() - 1) {
    currentTopicIndex++
    currentSlideIndex = 0
    updateView('down')
  }
}

function updateView (transition) {
  navigateTo(currentTopicIndex, currentSlideIndex, transition)
}
</script>
<div>
<button disabled={leftdisabled} id='left' on:click={left}>&lt;</button>
<button disabled={updisabled} id='up' on:click={up}>&and;</button>
<button disabled={rightdisabled} id='right' on:click={right}>&gt;</button>
<button disabled={downdisabled} id='down' on:click={down}>&or;</button>
</div>

<svelte:window on:keydown={handleKeyDown} on:keyup={handleKeyUp} />

<style>
  div {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 5;
  }
</style>
