import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

import Image from 'next/image'
import { useRouter } from 'next/router'
import { FC, useState } from 'react'

import { matchProtectedRoute } from '../utils/protectedRouteHandler'

const Auth: FC<{ redirect: string }> = ({ redirect }) => {
  const protectedRoute = matchProtectedRoute(redirect)

  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const authenticate = async () => {
    if (!password || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: protectedRoute, password }),
      })
      const body = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(body.error || 'Authentication failed.')
      await router.replace(router.asPath)
      router.reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Authentication failed.')
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col space-y-4 md:my-10">
      <div className="mx-auto w-3/4 md:w-5/6">
        <Image src={'/images/fabulous-wapmire-weekdays.png'} alt="authenticate" width={912} height={912} priority />
      </div>
      <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{'Enter Password'}</div>

      <p className="text-sm font-medium text-gray-500">
        {'This route (the folder itself and the files inside) is password protected. ' +
          'If you know the password, please enter it below.'}
      </p>

      <div className="flex items-center space-x-2">
        <input
          className="flex-1 rounded border border-gray-600/10 p-2 font-mono focus:ring focus:ring-blue-300 focus:outline-none dark:bg-gray-600 dark:text-white dark:focus:ring-blue-700"
          autoFocus
          type="password"
          placeholder="************"
          value={password}
          onChange={e => {
            setPassword(e.target.value)
          }}
          onKeyPress={e => {
            if (e.key === 'Enter' || e.key === 'NumpadEnter') {
              void authenticate()
            }
          }}
        />
        <button
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-500 focus:ring focus:ring-blue-400 focus:outline-none"
          disabled={submitting || !password}
          onClick={() => void authenticate()}
        >
          <FontAwesomeIcon icon="arrow-right" />
        </button>
      </div>
      {error && <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}

export default Auth
