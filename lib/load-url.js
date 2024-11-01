import https from 'https'

export async function loadUrl(url, onlyContent, sslVerify) {
  url = url ? url : this.content || this[0]
  onlyContent = typeof onlyContent === 'boolean' ? onlyContent : this.onlyContent
  sslVerify = typeof sslVerify === 'boolean' ? sslVerify : this.sslVerify
  let options = {}
  if (!sslVerify && url.startsWith('https://')) {
    const agent = new https.Agent({ rejectUnauthorized: false })
    options.agent = agent
  }
  let content = await fetch(url, options).then(res => res.text())
  const maxSize = this.maxSize
  if (maxSize > 0) {content = content.slice(0, maxSize)}
  if (!onlyContent) {content = `web url: ${url}\nweb content:\n${content}`;}
  return content
}
