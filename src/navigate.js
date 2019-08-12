import Error from './Error.svelte'
import { getPage, setCurrentSlide } from './pagemap'
import { writable } from 'svelte/store'
export { getPageMap, getNumberOfTopics, getNumberOfSlides } from './pagemap'

const socket = new WebSocket('ws://localhost:3003/', 'presentation')

export const syncMode = writable(true)

let sync

const unsubscribe = syncMode.subscribe(value => {
  sync = value
})

socket.onmessage = msg => {
  const data = JSON.parse(msg.data)
  if (data.type === 'update') {
    navigateTo(data.topic, data.slide, data.transition, true)
  }
}

let connectionEstablished = false
socket.onopen = () => {
  connectionEstablished = true
}

function informWebSocketAboutChangedSlide (topic, slide, transition) {
  if (connectionEstablished && sync) { socket.send(JSON.stringify({ type: 'update', topic, slide, transition })) }
}

let render

export function onRender (func) {
  if (render != null) {
    throw new Error('Renderer already set. Should not be set twice')
  }
  render = func
}

export function navigateTo (topicIndex, slideIndex, transition, notInform) {
  render(getPage(topicIndex, slideIndex), transition)
  setCurrentSlide(topicIndex, slideIndex)
  window.history.pushState({ topicIndex, slideIndex, transition }, '', `../../${topicIndex}/${slideIndex}/`)
  if (!notInform) {
    informWebSocketAboutChangedSlide(topicIndex, slideIndex, transition)
  }
}

window.onpopstate = (s) => {
  const topicIndex = s.state.topicIndex
  const slideIndex = s.state.slideIndex
  render(getPage(topicIndex, slideIndex), 'fadein')
  setCurrentSlide(topicIndex, slideIndex)
}
