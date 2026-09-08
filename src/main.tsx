import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route} from 'react-router-dom';
import {Bookshelf} from './app/Bookshelf';
import {Create} from './app/Create';
import {Editor} from './app/Editor';
import {Preview} from './app/Preview';
import './styles.css';
createRoot(document.getElementById('root')!).render(<StrictMode><BrowserRouter><Routes><Route path="/" element={<Bookshelf/>}/><Route path="/create" element={<Create/>}/><Route path="/editor/:bookId" element={<Editor/>}/><Route path="/preview/:bookId" element={<Preview/>}/><Route path="*" element={<Bookshelf/>}/></Routes></BrowserRouter></StrictMode>);
