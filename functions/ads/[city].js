// functions/ads/[city].js
// Public reader for /ads/<city> (without .json extension)
import { onRequest as handleAdRequest } from './[city].json.js';

export async function onRequest(context) {
  return handleAdRequest(context);
}
