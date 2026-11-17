export type PdfImage = {
  data: Uint8Array
  width: number
  height: number
}

function ascii(text: string) {
  const out = new Uint8Array(text.length)
  for (let index = 0; index < text.length; index += 1) out[index] = text.charCodeAt(index) & 255
  return out
}

function concat(parts: Uint8Array[]) {
  const length = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(length)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

/** 把每一页 JPEG 嵌进一页 A4。不依赖第三方库，小程序里也能直接写文件。 */
export function buildPdf(images: PdfImage[]) {
  const pageW = 595.28
  const pageH = 841.89
  const chunks: Array<{ id: number; body: Uint8Array }> = []
  const pageIds = images.map((_, index) => 3 + index * 3)
  chunks.push({
    id: 1,
    body: ascii('<< /Type /Catalog /Pages 2 0 R >>'),
  })
  chunks.push({
    id: 2,
    body: ascii(`<< /Type /Pages /Count ${images.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`),
  })
  images.forEach((image, index) => {
    const pageId = pageIds[index]
    const contentId = pageId + 1
    const imageId = pageId + 2
    const content = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im0 Do Q\n`
    chunks.push({
      id: pageId,
      body: ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents ${contentId} 0 R /Resources << /XObject << /Im0 ${imageId} 0 R >> >> >>`),
    })
    chunks.push({
      id: contentId,
      body: ascii(`<< /Length ${content.length} >>\nstream\n${content}endstream`),
    })
    const head = ascii(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.data.length} >>\nstream\n`)
    const foot = ascii('\nendstream')
    const body = new Uint8Array(head.length + image.data.length + foot.length)
    body.set(head, 0)
    body.set(image.data, head.length)
    body.set(foot, head.length + image.data.length)
    chunks.push({ id: imageId, body })
  })
  chunks.sort((a, b) => a.id - b.id)

  const header = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xff, 0xff, 0xff, 0xff, 0x0a])
  const parts: Uint8Array[] = [header]
  const offsets = [0]
  let cursor = header.length
  for (const chunk of chunks) {
    offsets[chunk.id] = cursor
    const piece = concat([ascii(`${chunk.id} 0 obj\n`), chunk.body, ascii('\nendobj\n')])
    parts.push(piece)
    cursor += piece.length
  }
  let xref = `xref\n0 ${chunks.length + 1}\n0000000000 65535 f \n`
  for (let id = 1; id <= chunks.length; id += 1) {
    xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`
  }
  xref += `trailer\n<< /Size ${chunks.length + 1} /Root 1 0 R >>\nstartxref\n${cursor}\n%%EOF`
  parts.push(ascii(xref))
  return concat(parts)
}
