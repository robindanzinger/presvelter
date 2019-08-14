import { writable } from 'svelte/store'
import PageA from './pages/PageA.svelte'
import PageB from './pages/PageB.svelte'
import PageC from './pages/PageC.svelte'
import Layout from './pages/Layout.svelte'
import Error from './Error.svelte'

const pagemap = [['layout'], ['page_a', 'page_b'], ['page_b', 'page_c', 'page_a'], ['page_c', 'page_a', 'page_c']]
const pages = {
  layout: Layout,
  page_a: PageA,
  page_b: PageB,
  page_c: PageC,
  error: Error
}

export const currentSlide = writable({
  topicIndex: 0, slideIndex: 0 })

export function setCurrentSlide (topicIndex, slideIndex) {
  currentSlide.set({ topicIndex, slideIndex })
}

export function getNumberOfTopics () {
  return pagemap.length
}

export function getNumberOfSlides (topicIndex) {
  return pagemap[topicIndex] !== undefined ? pagemap[topicIndex].length : -1
}

export function getPage (topicIndex, slideIndex) {
  return pages[getPageName(topicIndex, slideIndex)] || Error
}

export function getPageName (topicIndex, slideIndex) {
  return pagemap[topicIndex] && pagemap[topicIndex][slideIndex] ? pagemap[topicIndex][slideIndex] : 'error'
}

export function getPageMap () {
  return pagemap
}
