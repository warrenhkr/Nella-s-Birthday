import {
	defineCustomElement,
	MediaGoogleCastButtonElement,
	MediaPlayerElement,
	MediaPosterElement,
	MediaProviderElement,
	MediaVideoLayoutElement
} from 'vidstack/elements'
import 'vidstack/player/ui'
import 'vidstack/player/layouts/default'

if (import.meta.client) {
	defineCustomElement(MediaPlayerElement)
	defineCustomElement(MediaProviderElement)
	defineCustomElement(MediaPosterElement)
	defineCustomElement(MediaGoogleCastButtonElement)
	defineCustomElement(MediaVideoLayoutElement)
}

export default defineNuxtPlugin(() => {})
