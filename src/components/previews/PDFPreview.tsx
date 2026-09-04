import { useRouter } from 'next/router'
import DownloadButtonGroup from '../DownloadBtnGtoup'
import { DownloadBtnContainer } from './Containers'

const PDFEmbedPreview: React.FC<{ file: any }> = () => {
  const { asPath } = useRouter()
  const url = `/api/raw?path=${asPath}`

  return (
    <div>
      <div className="w-full overflow-hidden rounded" style={{ height: '90vh' }}>
        <iframe src={url} frameBorder="0" width="100%" height="100%"></iframe>
      </div>
      <DownloadBtnContainer>
        <DownloadButtonGroup />
      </DownloadBtnContainer>
    </div>
  )
}

export default PDFEmbedPreview
