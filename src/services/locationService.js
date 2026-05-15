const NEARBY_POI_RADIUS_METERS = 100

export const formatLocationName = (displayName) => (
  displayName.split(',').map(part => part.trim()).filter(Boolean).slice(0, 3).join(', ')
)

export const formatCoordinatesName = ({ lat, lng }) => `${lat.toFixed(5)}, ${lng.toFixed(5)}`

const getDistanceMeters = (from, to) => {
  const earthRadius = 6371000
  const toRad = value => value * Math.PI / 180
  const dLat = toRad(to.lat - from.lat)
  const dLng = toRad(to.lng - from.lng)
  const lat1 = toRad(from.lat)
  const lat2 = toRad(to.lat)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const getElementCoords = (element) => {
  if (typeof element.lat === 'number' && typeof element.lon === 'number') {
    return { lat: element.lat, lng: element.lon }
  }
  if (element.center && typeof element.center.lat === 'number' && typeof element.center.lon === 'number') {
    return { lat: element.center.lat, lng: element.center.lon }
  }
  return null
}

const getElementName = (element, language) => {
  const tags = element.tags || {}
  return tags[`name:${language}`]
    || tags['name:en']
    || tags.name
    || tags['addr:housename']
    || ''
}

const scoreNamedPlace = (tags, distance) => {
  let score = Math.max(0, NEARBY_POI_RADIUS_METERS - distance)

  if (tags.building || tags['addr:housename']) score += 160
  if (tags.highway === 'bus_stop') score += 120
  if (tags.tourism || tags.amenity || tags.shop) score += 90
  if (tags.office || tags.healthcare || tags.leisure || tags.public_transport || tags.railway) score += 70
  if ((tags.highway && tags.highway !== 'bus_stop') || tags.waterway || tags.route) score -= 200

  return score
}

export const findNearbyNamedPlace = async (coords, language) => {
  const around = `${NEARBY_POI_RADIUS_METERS},${coords.lat},${coords.lng}`
  const query = `
    [out:json][timeout:6];
    (
      nwr(around:${around})["name"]["building"];
      nwr(around:${around})["addr:housename"];
      nwr(around:${around})["name"]["amenity"];
      nwr(around:${around})["name"]["shop"];
      nwr(around:${around})["name"]["tourism"];
      nwr(around:${around})["name"]["office"];
      nwr(around:${around})["name"]["healthcare"];
      nwr(around:${around})["name"]["leisure"];
      nwr(around:${around})["name"]["public_transport"];
      nwr(around:${around})["name"]["railway"];
      nwr(around:${around})["name"]["highway"="bus_stop"];
    );
    out center 30;
  `
  const res = await fetch(
    `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
    { headers: { Accept: 'application/json,text/plain,*/*' } }
  )
  if (!res.ok) throw new Error(`Nearby POI lookup failed with status ${res.status}`)
  const data = await res.json()
  const candidates = (data.elements || [])
    .map(element => {
      const name = getElementName(element, language)
      const elementCoords = getElementCoords(element)
      if (!name || !elementCoords) return null

      const distance = getDistanceMeters(coords, elementCoords)
      return {
        name,
        distance,
        score: scoreNamedPlace(element.tags || {}, distance)
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.distance - b.distance)

  return candidates[0]?.name || null
}

export const searchLocations = async (query, language) => {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=my&accept-language=${language === 'zh' ? 'zh' : 'en'}`,
    { headers: { 'User-Agent': 'UniLoop/1.0' } }
  )
  if (!res.ok) throw new Error(`Location search failed with status ${res.status}`)
  const data = await res.json()
  return data.map(item => ({
    name: formatLocationName(item.display_name),
    fullName: item.display_name,
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon)
  }))
}

export const resolvePickedLocationName = async (coords, language) => {
  try {
    const nearbyPlace = await findNearbyNamedPlace(coords, language)
    if (nearbyPlace) return nearbyPlace
  } catch (err) {
    console.warn('Nearby POI lookup failed:', err)
  }

  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(coords.lat),
    lon: String(coords.lng),
    zoom: '18',
    addressdetails: '1',
    'accept-language': language === 'zh' ? 'zh' : 'en'
  })
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`)
  if (!res.ok) throw new Error(`Reverse geocoding failed with status ${res.status}`)
  const data = await res.json()
  return data.display_name ? formatLocationName(data.display_name) : formatCoordinatesName(coords)
}
