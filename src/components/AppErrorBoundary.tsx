import {Component,type ErrorInfo,type ReactNode} from 'react';
import {Button} from './ui';

export class AppErrorBoundary extends Component<{children:ReactNode},{error:Error|null}>{
  state={error:null as Error|null};
  static getDerivedStateFromError(error:Error){return {error};}
  componentDidCatch(error:Error,info:ErrorInfo){console.error('FLIPBOOK application error',error,info);}
  render(){
    if(!this.state.error)return this.props.children;
    return <main className="phone-shell app-error-boundary" role="alert">
      <div><h1>页面出现问题</h1><p>本地作品数据没有因此被主动删除。可以先重新加载；如果仍然出现问题，请返回书架再打开作品。</p><details><summary>查看错误信息</summary><code>{this.state.error.message}</code></details><div className="actions"><Button onClick={()=>window.location.reload()}>重新加载</Button><Button className="primary" onClick={()=>{window.location.href='/';}}>返回书架</Button></div></div>
    </main>;
  }
}
