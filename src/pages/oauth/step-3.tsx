import Head from 'next/head'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useEffect, useState } from 'react'

import siteConfig from '../../../config/site.config'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'
type OAuthStep3Result = {
  stored: boolean
  error?: string
  description?: string
}

export default function OAuthStep3() {
  const router = useRouter()
  const [result, setResult] = useState<OAuthStep3Result | null>(null)

  useEffect(() => {
    if (!router.isReady) return

    const timeout = window.setTimeout(() => {
      if (router.query.stored === '1') {
        setResult({ stored: true })
        return
      }

      try {
        const storedResult = sessionStorage.getItem('oauth-setup-result')
        sessionStorage.removeItem('oauth-setup-result')
        const parsed = storedResult ? (JSON.parse(storedResult) as Partial<OAuthStep3Result>) : {}
        setResult({
          stored: false,
          error: typeof parsed.error === 'string' ? parsed.error : 'OAuth setup failed',
          description: typeof parsed.description === 'string' ? parsed.description : 'Restart the authorization flow.',
        })
      } catch {
        setResult({ stored: false, error: 'OAuth setup failed', description: 'Restart the authorization flow.' })
      }
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [router.isReady, router.query.stored])

  const { stored = false, error, description } = result ?? {}

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white dark:bg-gray-900">
      <Head>
        <title>{`OAuth Step 3 - ${siteConfig.title}`}</title>
      </Head>

      <main className="flex w-full flex-1 flex-col bg-gray-50 dark:bg-gray-800">
        <Navbar />

        <div className="mx-auto w-full max-w-5xl p-4">
          <div className="rounded bg-white p-3 dark:bg-gray-900 dark:text-gray-100">
            <div className="mx-auto w-52">
              <Image
                src="/images/fabulous-celebration.png"
                width={912}
                height={912}
                alt="fabulous celebration"
                priority
              />
            </div>
            <h3 className="mb-4 text-center text-xl font-medium">{'Welcome to your new onedrive-cloudflare-index 🎉'}</h3>
            <h3 className="mt-4 mb-2 text-lg font-medium">{'Step 3/3: Store access securely'}</h3>

            {error ? (
              <div>
                <p className="py-1 font-medium text-red-500">
                  <FontAwesomeIcon icon="exclamation-circle" className="mr-2" />
                  <span>{`Whoops, looks like we got a problem: ${error}.`}</span>
                </p>
                <p className="my-2 rounded border border-gray-400/20 bg-gray-50 p-2 font-mono text-sm whitespace-pre-line opacity-80 dark:bg-gray-800">
                  {description}
                </p>
                <div className="mt-6 mb-2 text-right">
                  <button
                    className="rounded-lg bg-gradient-to-br from-red-500 to-orange-400 px-4 py-2.5 text-sm font-medium text-white hover:bg-gradient-to-bl"
                    onClick={() => router.push('/oauth/step-1')}
                  >
                    <FontAwesomeIcon icon="arrow-left" /> <span>{'Restart'}</span>
                  </button>
                </div>
              </div>
            ) : stored ? (
              <div>
                <p className="py-1 font-medium text-green-600 dark:text-green-400">
                  <FontAwesomeIcon icon={['far', 'check-circle']} className="mr-2" />
                  OAuth tokens were verified and stored in Cloudflare KV without exposing them to the browser.
                </p>
                <div className="mt-6 mb-2 text-right">
                  <button
                    className="rounded-lg bg-gradient-to-br from-green-500 to-cyan-400 px-4 py-2.5 text-sm font-medium text-white hover:bg-gradient-to-bl"
                    onClick={() => router.push('/')}
                  >
                    <span>{'Go home'}</span> <FontAwesomeIcon icon="arrow-right" />
                  </button>
                </div>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-gray-500">Finalizing OAuth setup ...</p>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
