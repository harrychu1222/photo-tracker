import { parse } from 'exifr'

/**
 * Returns the photo's original capture date, read from its EXIF data.
 * Falls back to the file's last-modified time if no EXIF date is present
 * (e.g. screenshots, edited/re-saved images, or some HEIC conversions).
 */
export async function getTakenAt(file) {
  try {
    const exif = await parse(file, ['DateTimeOriginal', 'CreateDate'])
    const exifDate = exif?.DateTimeOriginal || exif?.CreateDate
    if (exifDate instanceof Date && !isNaN(exifDate)) return exifDate
  } catch {
    // Not all files have readable EXIF — that's fine, fall through.
  }
  return file.lastModified ? new Date(file.lastModified) : new Date()
}
