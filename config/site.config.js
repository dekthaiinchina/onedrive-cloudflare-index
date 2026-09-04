/**
 * This file contains the configuration used for customising the website, such as the folder to share,
 * the title, used Google fonts, site icons, contact info, etc.
 */
module.exports = {
  // This is what we use to identify who you are when you are initialising the website for the first time.
  // Make sure this is exactly the same as the email address you use to sign into your Microsoft account.
  // You can also put this in your worker's environment variable if you worry about
  // your email being exposed in public.
  userPrincipalName: process.env.USER_PRINCIPAL_NAME || process.env.USER_PRINCIPLE_NAME || '',

  // [OPTIONAL] This is the website icon to the left of the title inside the navigation bar. It should be placed under the
  // /public directory of your GitHub project (not your OneDrive folder!), and referenced here by its relative path to /public.
  icon: '/icons/128.png',

  // The name of your website. Present alongside your icon.
  title: 'onedrive-cloudflare-index',

  // The folder that you are to share publicly with onedrive-cloudflare-index. Use '/' if you want to share your root folder.
  baseDirectory: process.env.BASE_DIRECTORY || '',

  // [OPTIONAL] This represents the maximum number of items that one directory lists, pagination supported.
  // Do note that this is limited up to 200 items by the upstream OneDrive API.
  maxItems: 100,

  // Maximum file size loaded entirely into the browser for text, code, Markdown, and URL previews.
  maxPreviewSize: 4 * 1024 * 1024,

  // Maximum uncompressed file size accepted by browser-generated ZIP downloads.
  // JSZip requires additional working memory, so keep this comfortably below typical device memory limits.
  maxArchiveSize: 256 * 1024 * 1024,

  // [OPTIONAL] We use Google Fonts natively for font customisations.
  // You can check and generate the required links and names at https://fonts.google.com.
  // googleFontSans - the sans serif font used in onedrive-cloudflare-index.
  googleFontSans: 'Inter',
  // googleFontMono - the monospace font used in onedrive-cloudflare-index.
  googleFontMono: 'Fira Mono',
  // googleFontLinks -  an array of links for referencing the google font assets.
  googleFontLinks: ['https://fonts.googleapis.com/css2?family=Fira+Mono&family=Inter:wght@400;500;700&display=swap'],

  // [OPTIONAL] The footer component of your website. You can write HTML here, but you need to escape double
  // quotes - changing " to \". You can write anything here, and if you like badges, generate some with https://shields.io
  footer: '',

  // [OPTIONAL] This is where you specify the folders that are password protected. It is an array of paths pointing to all
  // the directories in which you have .password set. Check the documentation for details.
  protectedRoutes: [],

  // Lifetime and basic online-guessing limits for password-protected folder sessions.
  protectedSessionTtl: 12 * 60 * 60,
  protectedLoginAttempts: 10,
  protectedLoginWindow: 15 * 60,

  // [OPTIONAL] Use "" here if you want to remove this email address from the nav bar.
  email: '',

  // [OPTIONAL] This is an array of names and links for setting your social information and links.
  // In the latest update, all brand icons inside font awesome is supported and the icon to render is based on the name
  // you provide. See the documentation for details.
  links: [],

  // This is a day.js-style datetime format string to format datetimes in the app. Ref to
  // https://day.js.org/docs/en/display/format for detailed specification. The default value is ISO 8601 full datetime
  // without timezone and replacing T with space.
  datetimeFormat: 'YYYY-MM-DD HH:mm:ss',

  // [OPTIONAL] OPDS catalog support for ebook readers.
  // Protected catalogs require a valid same-site protected-folder session cookie.
  opds: {
    enabled: false,
    title: '',
    description: '',
    fileExtensions: ['.epub', '.pdf', '.mobi', '.azw3', '.azw', '.cbz', '.cbr'],
  },
}
