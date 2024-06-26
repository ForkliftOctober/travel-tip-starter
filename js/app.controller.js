import { utilService } from './services/util.service.js'
import { locService } from './services/loc.service.js'
import { mapService } from './services/map.service.js'

window.onload = onInit

// To make things easier in this project structure
// functions that are called from DOM are defined on a global app object
window.app = {
	onRemoveLoc,
	onUpdateLoc,
	onSelectLoc,
	onPanToUserPos,
	onSearchAddress,
	onCopyLoc,
	onShareLoc,
	onSetSortBy,
	onSetFilterBy,
	onOpenModal,
	onUpdateOrAdd,
}



// const gUserPos = { lat: 43.65437329, lng: 41.43218792 }
const gUserPos = mapService
	.getUserPosition()
	.then(loc => {
		console.log('gUserPos:', loc)
		return loc
	})
	.catch(err => {
		console.error('OOPs:', err)
		flashMsg('Cannot get your position')
	})

function onInit() {
	loadAndRenderLocs()
	console.log('gUserPos: ', gUserPos)

	mapService
		.initMap()
		.then(() => {
			// onPanToTokyo()
			mapService.addClickListener(onOpenModal)
		})
		.catch(err => {
			console.error('OOPs:', err)
			flashMsg('Cannot init map')
		})
}

function renderLocs(locs) {
	const selectedLocId = getLocIdFromQueryParams()

	// Wait for gUserPos to resolve
	gUserPos
		.then(userPos => {
			var strHTML = locs
				.map(loc => {
					let distance = userPos ? `<span class="distance">Distance: <span>${utilService.getDistance(userPos, { lat: loc.geo.lat, lng: loc.geo.lng }, 'K')}</span> km</span>` : ''
					const className = loc.id === selectedLocId ? 'active' : ''
					return `
                <li class="loc ${className}" data-id="${loc.id}">
                    <h4>  
                        <span>${loc.name}</span>
                        <span>${distance}</span>
                        <span title="${loc.rate} stars">${'★'.repeat(loc.rate)}</span>
                    </h4>
                    <p class="muted">
                        Created: ${utilService.elapsedTime(loc.createdAt)}
                        ${loc.createdAt !== loc.updatedAt ? ` | Updated: ${utilService.elapsedTime(loc.updatedAt)}` : ''}
                    </p>
                    <div class="loc-btns">     
                    <button title="Delete" onclick="app.onRemoveLoc('${loc.id}')">🗑️</button>
                    <button title="Edit" onclick="app.onOpenModal('${loc.id}', 'update' )">✏️</button>
                    <button title="Select" onclick="app.onSelectLoc('${loc.id}')">🗺️</button>
                    </div>     
                </li>`
				})
				.join('')

			const elLocList = document.querySelector('.loc-list')
			elLocList.innerHTML = strHTML || 'No locs to show'

			renderLocStats()

			if (selectedLocId) {
				const selectedLoc = locs.find(loc => loc.id === selectedLocId)

				displayLoc(selectedLoc)
			}
			document.querySelector('.debug').innerText = JSON.stringify(locs, null, 2)
		})
		.catch(err => {
			console.error('Oops:', err)
			// Handle error if necessary
		})
}

function onRemoveLoc(locId) {
	if (confirm('Are you sure you want to remove this location?')) {
		locService
			.remove(locId)
			.then(() => {
				flashMsg('Location removed')
				unDisplayLoc()
				loadAndRenderLocs()
			})
			.catch(err => {
				console.error('OOPs:', err)
				flashMsg('Cannot remove location')
			})
	}
}

function onSearchAddress(ev) {
	ev.preventDefault()
	const el = document.querySelector('[name=address]')
	mapService
		.lookupAddressGeo(el.value)
		.then(geo => {
			mapService.panTo(geo)
		})
		.catch(err => {
			console.error('OOPs:', err)
			flashMsg('Cannot lookup address')
		})
}

function onAddLoc(geo) {
	const elDialog = document.querySelector('dialog')
	const rate = elDialog.querySelector('.rate-input').value
	const name = elDialog.querySelector('.name-input').value
	const locName = name
	if (!locName) return

	const loc = {
		name: locName,
		rate: rate || 0,
		geo,
	}
	locService
		.save(loc)
		.then(savedLoc => {
			flashMsg(`Added Location (name: ${name})`)
			utilService.updateQueryParams({ locId: savedLoc.id })
			elDialog.close()
			loadAndRenderLocs()
		})
		.catch(err => {
			console.error('OOPs:', err)
			flashMsg('Cannot add location')
		})
}

function loadAndRenderLocs() {
	locService
		.query()
		.then(renderLocs)
		.catch(err => {
			console.error('OOPs:', err)
			flashMsg('Cannot load locations')
		})
}

function onPanToUserPos() {
	mapService
		.getUserPosition()
		.then(latLng => {
			mapService.panTo({ ...latLng, zoom: 15 })
			unDisplayLoc()
			loadAndRenderLocs()
			flashMsg(`You are at Latitude: ${latLng.lat} Longitude: ${latLng.lng}`)
		})
		.catch(err => {
			console.error('OOPs:', err)
			flashMsg('Cannot get your position')
		})
}

function onUpdateLoc(locId) {
	locService.getById(locId).then(loc => {
		const elDialog = document.querySelector('dialog')
		const rate = elDialog.querySelector('.rate-input').value
		const name = elDialog.querySelector('.name-input').value

		if (rate !== loc.rate || name !== loc.name) {
			loc.rate = rate
			loc.name = name
			locService
				.save(loc)
				.then(savedLoc => {
					// flashMsg(`Rate was set to: ${savedLoc.rate}`)
					flashMsg(`Location Updated Successfully!`)
					elDialog.close()
					loadAndRenderLocs()
				})
				.catch(err => {
					console.error('OOPs:', err)
					flashMsg('Cannot update location')
				})
		}
	})
}

function onUpdateOrAdd(ev) {
	ev.preventDefault()

	const elDialog = document.querySelector('dialog')

	if (elDialog.dataset.geodata) onAddLoc(JSON.parse(elDialog.dataset.geodata))
	else onUpdateLoc(elDialog.dataset.locid)
}

function onOpenModal(locId, str) {
	let elDialog = document.querySelector('dialog')
	let elNameInput = elDialog.querySelector('.name-input')
	let elRateInput = elDialog.querySelector('.rate-input')

	elNameInput.value = ''
	elRateInput.value = ''

	if (str) {
		locService.getById(locId).then(loc => {
			elNameInput.value = loc.name
			elRateInput.value = loc.rate
			elDialog.removeAttribute('data-geodata')
			elDialog.setAttribute('data-locid', loc.id)
		})
	} else {
		elNameInput.value = locId.address
		elDialog.removeAttribute('data-locid')
		elDialog.setAttribute('data-geodata', JSON.stringify(locId))
	}
	document.querySelector('dialog').showModal()
}

function onSelectLoc(locId) {
	return locService
		.getById(locId)
		.then(displayLoc)
		.catch(err => {
			console.error('OOPs:', err)
			flashMsg('Cannot display this location')
		})
}

function displayLoc(loc) {
	const el = document.querySelector('.selected-loc')
	el.querySelector('.loc-name').innerText = loc.name
	el.querySelector('.loc-address').innerText = loc.geo.address
	el.querySelector('.loc-rate').innerHTML = '★'.repeat(loc.rate)
	el.querySelector('[name=loc-copier]').value = window.location
	el.classList.add('show')

	// Calculate distance using the promise
	gUserPos
		.then(userPos => {
			let distance = `<span class="distance">Distance: <span>${utilService.getDistance(userPos, { lat: loc.geo.lat, lng: loc.geo.lng }, 'K')}</span> km</span>`
			el.querySelector('.loc-distance').innerHTML = distance // Set distance HTML
		})
		.catch(err => {
			console.error('Oops:', err)
		})

	document.querySelector('.loc.active')?.classList?.remove('active')
	document.querySelector(`.loc[data-id="${loc.id}"]`).classList.add('active')

	mapService.panTo(loc.geo)
	mapService.setMarker(loc)

	utilService.updateQueryParams({ locId: loc.id })
}

function unDisplayLoc() {
	utilService.updateQueryParams({ locId: '' })
	document.querySelector('.selected-loc').classList.remove('show')
	mapService.setMarker(null)
}

function onCopyLoc() {
	const elCopy = document.querySelector('[name=loc-copier]')
	elCopy.select()
	elCopy.setSelectionRange(0, 99999) // For mobile devices
	navigator.clipboard.writeText(elCopy.value)
	flashMsg('Link copied, ready to paste')
}

function onShareLoc() {
	const url = document.querySelector('[name=loc-copier]').value

	// title and text not respected by any app (e.g. whatsapp)
	const data = {
		title: 'Cool location',
		text: 'Check out this location',
		url,
	}
	navigator.share(data)
}

function flashMsg(msg) {
	const el = document.querySelector('.user-msg')
	el.innerText = msg
	el.classList.add('open')
	setTimeout(() => {
		el.classList.remove('open')
	}, 3000)
}

function getLocIdFromQueryParams() {
	const queryParams = new URLSearchParams(window.location.search)
	const locId = queryParams.get('locId')
	return locId
}

function onSetSortBy() {
	const prop = document.querySelector('.sort-by').value
	const isDesc = document.querySelector('.sort-desc').checked

	if (!prop) return

	const sortBy = {}
	sortBy[prop] = isDesc ? -1 : 1

	// Shorter Syntax:
	// const sortBy = {
	//     [prop] : (isDesc)? -1 : 1
	// }

	locService.setSortBy(sortBy)
	loadAndRenderLocs()
}

function onSetFilterBy({ txt, minRate }) {
	const filterBy = locService.setFilterBy({ txt, minRate: +minRate })
	utilService.updateQueryParams(filterBy)
	loadAndRenderLocs()
}

function renderLocStats() {
	locService.getLocCountByRateMap().then(stats => {
		handleStats(stats, 'loc-stats-rate')
	})

	locService.getLocCountByUpdatedMap().then(stats => {
		handleStats(stats, 'loc-stats-updatetime')
	})
}

function handleStats(stats, selector) {
	// stats = { low: 37, medium: 11, high: 100, total: 148 }
	// stats = { low: 5, medium: 5, high: 5, baba: 55, mama: 30, total: 100 }
	const labels = cleanStats(stats)
	const colors = utilService.getColors()

	var sumPercent = 0
	var colorsStr = `${colors[0]} ${0}%, `
	labels.forEach((label, idx) => {
		if (idx === labels.length - 1) return
		const count = stats[label]
		const percent = Math.round((count / stats.total) * 100, 2)
		sumPercent += percent
		colorsStr += `${colors[idx]} ${sumPercent}%, `
		if (idx < labels.length - 1) {
			colorsStr += `${colors[idx + 1]} ${sumPercent}%, `
		}
	})

	colorsStr += `${colors[labels.length - 1]} ${100}%`
	// Example:
	// colorsStr = `purple 0%, purple 33%, blue 33%, blue 67%, red 67%, red 100%`

	const elPie = document.querySelector(`.${selector} .pie`)
	const style = `background-image: conic-gradient(${colorsStr})`
	elPie.style = style

	const legendHTML = labels
		.map((label, idx) => {
			return `
                <li>
                    <span class="pie-label" style="background-color:${colors[idx]}"></span>
                    ${label} (${stats[label]})
                </li>
            `
		})
		.join('')

	const elLegend = document.querySelector(`.${selector} .legend`)
	elLegend.innerHTML = legendHTML
}

function cleanStats(stats) {
	const cleanedStats = Object.keys(stats).reduce((acc, label) => {
		if (label !== 'total' && stats[label]) {
			acc.push(label)
		}
		return acc
	}, [])
	return cleanedStats
}
