import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import {
  faDiscord,
  faFacebook,
  faGithub,
  faInstagram,
  faLinkedin,
  faMastodon,
  faTelegram,
  faTwitter,
  faWeibo,
  faYoutube,
} from '@fortawesome/free-brands-svg-icons'
import { Dialog, DialogBackdrop, Transition } from '@headlessui/react'
import toast, { Toaster } from 'react-hot-toast'
import { useHotkeys } from 'react-hotkeys-hook'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { Fragment, useEffect, useState } from 'react'

import siteConfig from '../../config/site.config'
import SearchModal from './SearchModal'
import useDeviceOS from '../utils/useDeviceOS'

const brandIcons: Record<string, IconDefinition> = {
  discord: faDiscord,
  facebook: faFacebook,
  github: faGithub,
  instagram: faInstagram,
  linkedin: faLinkedin,
  mastodon: faMastodon,
  telegram: faTelegram,
  twitter: faTwitter,
  weibo: faWeibo,
  youtube: faYoutube,
}

const Navbar = () => {
  const router = useRouter()
  const os = useDeviceOS()

  const [tokenPresent, setTokenPresent] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    // Remove password-equivalent hashes left by older deployments, then query the HttpOnly session state.
    try {
      siteConfig.protectedRoutes.forEach(route => localStorage.removeItem(route))
      Object.keys(localStorage).forEach(key => {
        try {
          const value = JSON.parse(localStorage.getItem(key) ?? 'null')
          if (typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value)) localStorage.removeItem(key)
        } catch {
          // Ignore unrelated non-JSON local storage values.
        }
      })
    } catch {
      // Session cookies continue to work when local storage is unavailable.
    }
    fetch('/api/auth', { cache: 'no-store' })
      .then(response => response.json())
      .then((body: { authenticated?: boolean }) => setTokenPresent(body.authenticated === true))
      .catch(() => setTokenPresent(false))
  }, [])

  const [searchOpen, setSearchOpen] = useState(false)
  const openSearchBox = () => setSearchOpen(true)

  useHotkeys(`${os === 'mac' ? 'meta' : 'ctrl'}+k`, e => {
    openSearchBox()
    e.preventDefault()
  })

  const clearTokens = async () => {
    setIsOpen(false)
    try {
      const response = await fetch('/api/auth', { method: 'DELETE' })
      if (!response.ok) throw new Error('Unable to clear the protected session.')
      setTokenPresent(false)
      toast.success('Protected session cleared')
      setTimeout(() => router.reload(), 1000)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to clear the protected session.')
    }
  }

  return (
    <div className="bg-opacity-80 sticky top-0 z-[100] border-b border-gray-900/10 bg-white backdrop-blur-md dark:border-gray-500/30 dark:bg-gray-900">
      <Toaster />

      <SearchModal searchOpen={searchOpen} setSearchOpen={setSearchOpen} />

      <div className="mx-auto flex w-full items-center justify-between space-x-4 px-4 py-1">
        <Link href="/" passHref className="flex items-center space-x-2 py-2 hover:opacity-80 md:p-2 dark:text-white">
          <Image src={siteConfig.icon} alt="icon" width="25" height="25" priority />
          <span className="hidden font-bold sm:block">{siteConfig.title}</span>
        </Link>

        <div className="flex flex-1 items-center space-x-4 text-gray-700 md:flex-initial">
          <button
            className="flex flex-1 items-center justify-between rounded-lg bg-gray-100 px-2.5 py-1.5 hover:opacity-80 md:w-48 dark:bg-gray-800 dark:text-white"
            onClick={openSearchBox}
          >
            <div className="flex items-center space-x-2">
              <FontAwesomeIcon className="h-4 w-4" icon="search" />
              <span className="truncate text-sm font-medium">{'Search ...'}</span>
            </div>

            <div className="hidden items-center space-x-1 md:flex">
              <div className="rounded-lg bg-gray-200 px-2 py-1 text-xs font-medium dark:bg-gray-700">
                {os === 'mac' ? '⌘' : 'Ctrl'}
              </div>
              <div className="rounded-lg bg-gray-200 px-2 py-1 text-xs font-medium dark:bg-gray-700">K</div>
            </div>
          </button>

          {siteConfig.links.length !== 0 &&
            siteConfig.links.map((l: { name: string; link: string }) => (
              <a
                key={l.name}
                href={l.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 hover:opacity-80 dark:text-white"
              >
                <FontAwesomeIcon icon={brandIcons[l.name.toLowerCase()] ?? 'link'} />
                <span className="hidden text-sm font-medium md:inline-block">{l.name}</span>
              </a>
            ))}

          {siteConfig.email && (
            <a href={siteConfig.email} className="flex items-center space-x-2 hover:opacity-80 dark:text-white">
              <FontAwesomeIcon icon={['far', 'envelope']} />
              <span className="hidden text-sm font-medium md:inline-block">{'Email'}</span>
            </a>
          )}

          {tokenPresent && (
            <button
              className="flex items-center space-x-2 hover:opacity-80 dark:text-white"
              onClick={() => setIsOpen(true)}
            >
              <span className="hidden text-sm font-medium md:inline-block">{'Logout'}</span>
              <FontAwesomeIcon icon="sign-out-alt" />
            </button>
          )}
        </div>
      </div>

      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="fixed inset-0 z-10 overflow-y-auto" open={isOpen} onClose={() => setIsOpen(false)}>
          <div className="min-h-screen px-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-100"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-50"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <DialogBackdrop className="fixed inset-0 bg-gray-50 dark:bg-gray-800" />
            </Transition.Child>

            {/* This element is to trick the browser into centering the modal contents. */}
            <span className="inline-block h-screen align-middle" aria-hidden="true">
              &#8203;
            </span>
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-100"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-50"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <div className="my-8 inline-block w-full max-w-md transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle transition-all dark:bg-gray-900">
                <Dialog.Title className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {'End protected session?'}
                </Dialog.Title>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    {'This session authorizes password-protected folders. Ending it means that you will need to ' +
                      'enter those passwords again.'}
                  </p>
                </div>

                <div className="mt-4 max-h-32 overflow-y-scroll font-mono text-sm dark:text-gray-100">
                  {siteConfig.protectedRoutes.map((r, i) => (
                    <div key={i} className="flex items-center space-x-1">
                      <FontAwesomeIcon icon="key" />
                      <span className="truncate">{r}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex items-center justify-end">
                  <button
                    className="mr-3 inline-flex items-center justify-center space-x-2 rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-400 focus:ring focus:ring-blue-300 focus:outline-none"
                    onClick={() => setIsOpen(false)}
                  >
                    {'Cancel'}
                  </button>
                  <button
                    className="inline-flex items-center justify-center space-x-2 rounded bg-red-500 px-4 py-2 text-white hover:bg-red-400 focus:ring focus:ring-red-300 focus:outline-none"
                    onClick={() => void clearTokens()}
                  >
                    <FontAwesomeIcon icon={['far', 'trash-alt']} />
                    <span>{'End session'}</span>
                  </button>
                </div>
              </div>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </div>
  )
}

export default Navbar
