import type { OdFileObject } from '../../types'
import { FC, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'

import Preview from 'preview-office-docs'

import DownloadButtonGroup from '../DownloadBtnGtoup'
import { DownloadBtnContainer, PreviewContainer } from './Containers'
import { getBaseUrl } from '../../utils/getBaseUrl'
import { matchProtectedRoute } from '../../utils/protectedRouteHandler'

const OfficePreview: FC<{ file: OdFileObject }> = () => {
  const { asPath } = useRouter()
  const isProtected = Boolean(matchProtectedRoute(asPath))

  const docContainer = useRef<HTMLDivElement>(null)
  const [docContainerWidth, setDocContainerWidth] = useState(600)

  const docUrl = encodeURIComponent(`${getBaseUrl()}/api/raw?path=${asPath}`)

  useEffect(() => {
    setDocContainerWidth(docContainer.current ? docContainer.current.offsetWidth : 600)
  }, [])

  if (isProtected) {
    return (
      <div>
        <PreviewContainer>
          <p className="py-8 text-center text-sm text-gray-500">
            Online Office preview is disabled for protected files so the folder credential is not sent to a third-party
            viewer. Download the file to open it locally.
          </p>
        </PreviewContainer>
        <DownloadBtnContainer>
          <DownloadButtonGroup />
        </DownloadBtnContainer>
      </div>
    )
  }

  return (
    <div>
      <div className="overflow-scroll" ref={docContainer} style={{ maxHeight: '90vh' }}>
        <Preview url={docUrl} width={docContainerWidth.toString()} height="600" />
      </div>
      <DownloadBtnContainer>
        <DownloadButtonGroup />
      </DownloadBtnContainer>
    </div>
  )
}

export default OfficePreview
