const mode = () => process.env.STRIPE_MODE === 'live' ? 'live' : 'test';
const standardForMode = (name, prefix) => {
  const candidate=process.env[name] || '';
  return candidate.startsWith(prefix) ? candidate : '';
};

export const stripeEnv = () => {
  const selectedMode=mode();
  const live=selectedMode === 'live';
  return {
    mode:selectedMode,
    secretKey:live
      ? process.env.STRIPE_SECRET_KEY_live || standardForMode('STRIPE_SECRET_KEY','sk_live_')
      : process.env.STRIPE_SECRET_KEY_test || standardForMode('STRIPE_SECRET_KEY','sk_test_'),
    publishableKey:live
      ? process.env.STRIPE_PUBLISHABLE_KEY_live || standardForMode('STRIPE_PUBLISHABLE_KEY','pk_live_')
      : process.env.STRIPE_PUBLISHABLE_KEY_test || standardForMode('STRIPE_PUBLISHABLE_KEY','pk_test_'),
    webhookSecret:live
      ? process.env.STRIPE_WEBHOOK_SECRET_live || ''
      : process.env.STRIPE_WEBHOOK_SECRET_test || process.env.STRIPE_WEBHOOK_SECRET || '',
    membershipPriceId:live
      ? process.env.STRIPE_MEMBERSHIP_PRICE_ID_live || process.env.STRIPE_MEMBERSHIP_PRICE_ID || ''
      : process.env.STRIPE_MEMBERSHIP_PRICE_ID_test || process.env.STRIPE_MEMBERSHIP_PRICE_ID || '',
  };
};

export const assertStripeConfiguration = () => {
  const config=stripeEnv();
  if(config.mode !== 'live') return config;
  if(!config.secretKey.startsWith('sk_live_')) throw new Error('Production requires a Stripe sk_live_ secret key.');
  if(!config.publishableKey.startsWith('pk_live_')) throw new Error('Production requires a Stripe pk_live_ publishable key.');
  if(!config.webhookSecret.startsWith('whsec_')) throw new Error('Production requires the live endpoint Stripe whsec_ signing secret.');
  return config;
};
