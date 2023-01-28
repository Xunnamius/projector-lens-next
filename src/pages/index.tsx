import * as React from 'react';
import { hydrateSystemDb, unhydratedDummySystemData } from 'testverse/db';
import { getEnv } from 'universe/backend/env';
import { initializeSystemDb, destroySystemDb, getSystemDb } from 'universe/backend/db';

let previouslyHydratedDb = false;

export async function getServerSideProps() {
  const env = getEnv();
  const shouldHydrateSystemDb =
    env.NODE_ENV == 'development' && !previouslyHydratedDb && env.HYDRATE_DB_ON_STARTUP;

  const props = {
    isInProduction: env.NODE_ENV == 'production',
    shouldHydrateDb: shouldHydrateSystemDb,
    previouslyHydratedDb,
    nodeEnv: env.NODE_ENV
  };

  if (shouldHydrateSystemDb) {
    const db = await getSystemDb();

    await destroySystemDb(db);
    await initializeSystemDb(db);
    await hydrateSystemDb(db, unhydratedDummySystemData);

    previouslyHydratedDb = true;
  }

  return { props };
}

export default function Index({
  previouslyHydratedDb,
  shouldHydrateDb,
  isInProduction,
  nodeEnv
}: {
  previouslyHydratedDb: boolean;
  shouldHydrateDb: boolean;
  isInProduction: boolean;
  nodeEnv: string;
}) {
  let status = <span style={{ color: 'gray' }}>unchanged</span>;

  if (previouslyHydratedDb)
    status = <span style={{ color: 'green' }}>previously hydrated</span>;

  if (shouldHydrateDb) status = <span style={{ color: 'darkred' }}>hydrated</span>;

  return (
    <React.Fragment>
      <p>Psst: there is no web frontend for this API just yet. Check back soon!</p>
      {!isInProduction && (
        <p>
          <strong>
            {`[ NODE_ENV=${nodeEnv} | db=`}
            {status}
            {' ]'}
          </strong>
        </p>
      )}
    </React.Fragment>
  );
}
