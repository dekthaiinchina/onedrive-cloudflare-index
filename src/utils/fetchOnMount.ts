import axios from 'axios'
import { useEffect, useState } from 'react'
import siteConfig from '../../config/site.config'
import { humanFileSize } from './fileDetails'

/**
 * Custom hook for axios to fetch raw file content on component mount
 * @param fetchUrl The URL pointing to the raw file content
 * @param path The path of the file, used for determining whether path is protected
 */
export default function useFileContent(
  fetchUrl: string,
  path: string,
  fileSize?: number,
): { response: any; error: string; validating: boolean } {
  const requestKey = `${fetchUrl}\0${path}\0${fileSize ?? ''}`
  const [result, setResult] = useState({ requestKey: '', response: '', error: '' })
  const sizeError =
    typeof fileSize === 'number' && fileSize > siteConfig.maxPreviewSize
      ? `Preview disabled because this file is ${humanFileSize(fileSize)}. The preview limit is ${humanFileSize(
          siteConfig.maxPreviewSize,
        )}. Download the file instead.`
      : ''

  useEffect(() => {
    if (sizeError) return

    let active = true

    axios
      // Using 'blob' as response type to get the response as a raw file blob, which is later parsed as a string.
      // Axios defaults response parsing to JSON, which causes issues when parsing JSON files.
      .get(fetchUrl, { responseType: 'blob' })
      .then(async res => {
        const text = await res.data.text()
        if (active) setResult({ requestKey, response: text, error: '' })
      })
      .catch(e => {
        if (active) {
          setResult({
            requestKey,
            response: '',
            error: e instanceof Error ? e.message : 'Unable to load file content.',
          })
        }
      })

    return () => {
      active = false
    }
  }, [fetchUrl, path, requestKey, sizeError])

  if (sizeError) return { response: '', error: sizeError, validating: false }
  if (result.requestKey !== requestKey) return { response: '', error: '', validating: true }
  return { response: result.response, error: result.error, validating: false }
}
