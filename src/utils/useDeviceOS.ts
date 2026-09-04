import { useSyncExternalStore } from 'react'

const subscribe = () => () => undefined

const getDeviceOS = () => {
  const userAgent = window.navigator.userAgent

  if (userAgent.includes('Windows')) return 'windows'
  if (userAgent.includes('Mac OS')) return 'mac'
  if (userAgent.includes('Linux')) return 'linux'
  return 'other'
}

export default function useDeviceOS(): string {
  return useSyncExternalStore(subscribe, getDeviceOS, () => '')
}
