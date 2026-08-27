import { Component } from 'react';

const copy={
  en:{eyebrow:'System interruption',title:'The spark cut out.',text:'Something unexpected happened. Reload the page to reconnect.',button:'Reload page'},
  uk:{eyebrow:'Системна помилка',title:'Іскра згасла.',text:'Сталася неочікувана помилка. Перезавантажте сторінку, щоб відновити роботу.',button:'Перезавантажити'},
  ru:{eyebrow:'Системная ошибка',title:'Искра погасла.',text:'Произошла непредвиденная ошибка. Перезагрузите страницу, чтобы восстановить работу.',button:'Перезагрузить'}
};

export default class ErrorBoundary extends Component{
  state={failed:false};

  static getDerivedStateFromError(){ return {failed:true}; }

  componentDidCatch(error,info){
    console.error('ISKRA interface error',error,info);
  }

  render(){
    if(!this.state.failed) return this.props.children;
    const message=copy[document.documentElement.lang] || copy.en;
    return <main className="fatal-error" role="alert">
      <div>
        <span className="eyebrow">{message.eyebrow}</span>
        <h1>{message.title}</h1>
        <p>{message.text}</p>
        <button className="btn btn-primary" type="button" onClick={()=>location.reload()}>{message.button}</button>
      </div>
    </main>;
  }
}
