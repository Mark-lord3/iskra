import {useI18n} from '../i18n.jsx';

const OPTIONS=[['en','EN'],['uk','УКР'],['ru','РУС']];

export default function LanguageSwitcher({className=''}){
  const {language,setLanguage,t}=useI18n();
  return <div className={`language-switcher ${className}`} role="group" aria-label={t('language.label')}>
    {OPTIONS.map(([value,label])=><button key={value} type="button" className={language===value?'active':''} aria-pressed={language===value} aria-label={t(`language.${value}`)} onClick={()=>setLanguage(value)}>{label}</button>)}
  </div>;
}
