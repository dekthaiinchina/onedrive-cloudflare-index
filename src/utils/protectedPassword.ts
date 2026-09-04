import sha256 from 'crypto-js/sha256.js'

/** Compare a submitted password with .password contents without storing or returning either value. */
export function compareProtectedPassword({
  submittedPassword,
  dotPassword,
}: {
  submittedPassword: string
  dotPassword: string
}): boolean {
  const actual = sha256(dotPassword.trim()).toString()
  const supplied = sha256(submittedPassword).toString()
  let difference = actual.length ^ supplied.length
  for (let index = 0; index < Math.max(actual.length, supplied.length); index += 1) {
    difference |= (actual.charCodeAt(index) || 0) ^ (supplied.charCodeAt(index) || 0)
  }
  return difference === 0
}
