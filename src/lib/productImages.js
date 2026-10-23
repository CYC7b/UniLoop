// A listing's images and thumbnails are parallel arrays: thumbnails[i] is the
// small version of images[i]. Listings without a thumbnail fall back to the
// full image, matching how product cards pick their thumbnail.

// Pairs a listing's images with their thumbnails for editing.
export function pairImages(imageUrls = [], thumbnails = []) {
  return imageUrls.map((image, i) => ({ image, thumb: thumbnails[i] || image }))
}

// Builds the images/thumbnails payload from the kept pairs plus newly
// uploaded files, keeping both arrays index-aligned.
export function buildImagePayload(retained = [], newUrls = [], newThumbUrls = []) {
  return {
    images: [...retained.map(p => p.image), ...newUrls],
    thumbnails: [...retained.map(p => p.thumb), ...newUrls.map((url, i) => newThumbUrls[i] || url)]
  }
}
