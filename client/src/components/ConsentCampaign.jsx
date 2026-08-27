import {useEffect,useState} from 'react';
import {api} from '../api.js';
import {useI18n} from '../i18n.jsx';

const CONSENT_KEY='iskra_marketing_consent_v1';
const sensitive=path=>['/account','/admin','/staff/scan','/tickets'].some(prefix=>path.startsWith(prefix));

export default function ConsentCampaign(){
  const {language}=useI18n();
  const [consent,setConsent]=useState(()=>localStorage.getItem(CONSENT_KEY)||'');
  const [campaign,setCampaign]=useState(null);
  const choose=choice=>{localStorage.setItem(CONSENT_KEY,choice);setConsent(choice);api.campaignConsent(choice).catch(()=>{});};
  useEffect(()=>{
    if(consent!=='granted'||sensitive(location.pathname)||navigator.globalPrivacyControl||navigator.doNotTrack==='1')return;
    let active=true;
    const timer=setTimeout(()=>api.campaignNext(language,consent).then(result=>{
      if(!active||!result.campaign)return;
      setCampaign(result.campaign);
      api.campaignRecord(result.campaign.id,'impression').catch(()=>{});
    }).catch(()=>{}),8000);
    return()=>{active=false;clearTimeout(timer);};
  },[consent,language]);
  const dismiss=()=>{if(campaign)api.campaignRecord(campaign.id,'dismiss').catch(()=>{});setCampaign(null);};
  const follow=()=>{localStorage.setItem('iskra_campaign_source',campaign.id);setCampaign(null);};
  return <>
    {!consent&&<aside className="consent-bar" aria-label="Privacy choices"><div><b>Your night. Your choice.</b><p>ISKRA uses optional first-party analytics to measure offers. No covert fingerprinting or payment-data tracking.</p></div><div><button onClick={()=>choose('essential')}>Essential only</button><button onClick={()=>choose('granted')}>Allow optional analytics</button></div></aside>}
    {campaign&&<aside className="campaign-popup" role="dialog" aria-modal="false" aria-labelledby="campaign-title"><button className="campaign-close" onClick={dismiss} aria-label="Dismiss offer">×</button><span>PRIVATE SIGNAL / PROJECT ISKRA</span><h2 id="campaign-title">{campaign.title}</h2><p>{campaign.text}</p><a className="btn btn-primary" href={campaign.href} onClick={follow}>{campaign.cta} →</a><small>Frequency limited · Dismiss anytime</small></aside>}
  </>;
}
