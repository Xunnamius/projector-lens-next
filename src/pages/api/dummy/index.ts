import { handleEndpoint } from 'universe/backend/middleware';

import type { NextApiResponse, NextApiRequest } from 'next';

// ? https://nextjs.org/docs/api-routes/api-middlewares#custom-config
export { config } from 'universe/backend/middleware';

export default async function (req: NextApiRequest, res: NextApiResponse) {
  await handleEndpoint(
    async () => {
      // TODO
    },
    { group: 'dummy', req, res }
  );
}
