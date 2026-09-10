import {StrictMode,Suspense,lazy} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route} from 'react-router-dom';
import {Bookshelf} from './app/Bookshelf';
import {Loading} from './components/ui';
import {AppErrorBoundary} from './components/AppErrorBoundary';
import './styles/tokens.css';
import './styles.css';
import './styles/app-shell.css';

if(/Electron\//i.test(navigator.userAgent))document.documentElement.classList.add('desktop-app');

const Create=lazy(()=>import('./app/Create').then(module=>({default:module.Create})));
const Editor=lazy(()=>import('./app/Editor').then(module=>({default:module.Editor})));
const Preview=lazy(()=>import('./app/Preview').then(module=>({default:module.Preview})));
const Settings=lazy(()=>import('./app/Settings').then(module=>({default:module.Settings})));

function DesktopCloseButton(){
  if(!window.desktopWindow)return null;
  return <button
    type="button"
    className="desktop-close-button"
    aria-label="关闭 Flipbook"
    title="关闭"
    onClick={()=>{void window.desktopWindow?.close();}}
  >×</button>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <DesktopCloseButton/>
        <Suspense fallback={<main className="phone-shell"><Loading text="正在打开…"/></main>}>
          <Routes>
            <Route path="/" element={<Bookshelf/>}/>
            <Route path="/create" element={<Create/>}/>
            <Route path="/editor/:bookId" element={<Editor/>}/>
            <Route path="/preview/:bookId" element={<Preview/>}/>
            <Route path="/settings" element={<Settings/>}/>
            <Route path="*" element={<Bookshelf/>}/>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>
);
