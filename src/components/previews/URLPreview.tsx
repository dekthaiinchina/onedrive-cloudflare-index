import { useRouter } from 'next/router'

import FourOhFour from '../FourOhFour'
import Loading from '../Loading'
import { DownloadButton } from '../DownloadBtnGtoup'
import useFileContent from '../../utils/fetchOnMount'
import { parseInternetShortcut } from '../../utils/safeUrls'
import { DownloadBtnContainer, PreviewContainer } from './Containers'

const TextPreview = ({ file }) => {
  const { asPath } = useRouter()

  const { response: content, error, validating } = useFileContent(`/api/raw?path=${asPath}`, asPath, file.size)
  if (error) {
    return (
      <PreviewContainer>
        <FourOhFour errorMsg={error} />
      </PreviewContainer>
    )
  }

  if (validating) {
    return (
      <PreviewContainer>
        <Loading loadingText={'Loading file content...'} />
      </PreviewContainer>
    )
  }

  if (!content) {
    return (
      <PreviewContainer>
        <FourOhFour errorMsg={'File is empty.'} />
      </PreviewContainer>
    )
  }

  const targetUrl = parseInternetShortcut(content)

  return (
    <div>
      <PreviewContainer>
        <pre className="overflow-x-scroll p-0 text-sm md:p-3">{content}</pre>
      </PreviewContainer>
      <DownloadBtnContainer>
        <div className="flex justify-center">
          {targetUrl && (
            <DownloadButton
              onClickCallback={() => window.open(targetUrl, '_blank', 'noopener,noreferrer')}
              btnColor="blue"
              btnText={'Open URL'}
              btnIcon="external-link-alt"
              btnTitle={`Open URL ${targetUrl}`}
            />
          )}
        </div>
      </DownloadBtnContainer>
    </div>
  )
}

export default TextPreview
