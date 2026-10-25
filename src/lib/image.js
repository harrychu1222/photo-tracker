// Shrink a phone photo before upload so receipts stay small. Falls back to the original file
// if the browser cannot decode it (for example some HEIC files outside Safari).
export async function shrinkImage(file, maxSide = 1600, quality = 0.8) {
  try {
    if (!file.type.startsWith('image/')) return file
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
    const w = Math.round(bmp.width * scale)
    const h = Math.round(bmp.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d').drawImage(bmp, 0, 0, w, h)
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality))
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file
  }
}
