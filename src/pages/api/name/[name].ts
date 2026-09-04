import { webHandler as rawFileHandler } from '../raw'
import { NextRequest } from 'next/server'
import { nodeApiHandler } from '../../../utils/nodeApiHandler'

async function webHandler(req: NextRequest): Promise<Response> {
  return rawFileHandler(req)
}

export default nodeApiHandler(webHandler)
