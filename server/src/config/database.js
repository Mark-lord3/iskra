const stagingUri = uri => {
  if(!uri) return '';
  const parsed=new URL(uri);
  const current=parsed.pathname.replace(/^\//,'') || 'iskra_promo';
  parsed.pathname=`/${current.endsWith('_staging') ? current : `${current}_staging`}`;
  return parsed.toString();
};

export const databaseUri = () => {
  const environment=process.env.DEPLOY_ENV || 'development';
  const uri=environment === 'production'
    ? process.env.MONGODB_URI_live || process.env.MONGODB_URI || ''
    : environment === 'staging'
      ? process.env.MONGODB_URI_staging || stagingUri(process.env.MONGODB_URI)
      : process.env.MONGODB_URI || '';
  if(!uri)return uri;
  const database=new URL(uri).pathname.replace(/^\//,'');
  if(environment === 'staging'&&!database.endsWith('_staging'))
    throw new Error(`Staging must use an isolated *_staging database, received "${database}".`);
  if(environment === 'production'&&database.endsWith('_staging'))
    throw new Error(`Production cannot use the staging database "${database}".`);
  return uri;
};
