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
<div class='black' />
<div>
<a class='{ leftdisabled ? "disabled" : "" } left' id='left' on:click={left}>&lt;</a>
<a class='{ updisabled ? "disabled" : "" } up' id='up' on:click={up}>&and;</a>
<a class='{ rightdisabled ? "disabled" : "" } right' id='right' on:click={right}>&gt;</a>
<a class='{ downdisabled ? "disabled" : "" } down' id='down' on:click={down}>&or;</a>
</div>

<svelte:window on:keydown={handleKeyDown} on:keyup={handleKeyUp} />

<style>
  div {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 5;
    width: 80px;
    height: 80px;
  }
  a {
    color: white;
    font-size: 18px;
    font-weight: bold;
    border-radius: 30%;
    cursor: pointer;
    position: absolute;
    padding: 8px;
    }
  a:hover {
    background-color: black;
  }
  a.disabled {
    cursor: default;
    color: gray;
  }
  .disabled:hover {
    background-color: inherit;
  }
  .up {
    top: 0;
    left: 32%;
  }
  .left {
    left: 0;
    top: 25%;
    font-size:20px;
  }
  .right {
    right: 0;
    top: 25%;
    font-size:20px;
  }
  .down {
    bottom :0;
    left: 32%;
  }
  .black {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 5;
    background-color: black;
    opacity: 0.3;
    width: 80px;
    height: 80px;
    border-radius: 50%;
 }

</style>
