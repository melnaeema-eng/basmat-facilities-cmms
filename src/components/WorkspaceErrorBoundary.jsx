import {Component} from 'react'
export default class WorkspaceErrorBoundary extends Component {
 state={failed:false}
 static getDerivedStateFromError(){return {failed:true}}
 componentDidCatch(error){console.error('Workspace module failed',error)}
 render(){
  if(!this.state.failed)return this.props.children
  const ar=document.documentElement.lang==='ar'
  return <section className="facility-panel" role="alert"><h1>{ar?'تعذر فتح الوحدة':'Unable to open module'}</h1><p>{ar?'أعد تحميل الصفحة للمحاولة مرة أخرى.':'Reload the page to try again.'}</p><button className="btn primary" onClick={()=>window.location.reload()}>{ar?'إعادة التحميل':'Reload'}</button></section>
 }
}
