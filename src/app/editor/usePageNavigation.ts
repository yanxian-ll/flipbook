import {useEffect,useRef,type PointerEvent as ReactPointerEvent,type RefObject,type WheelEvent as ReactWheelEvent} from 'react';
import type {EditorFlipBookHandle} from '../../components/EditorFlipBook';
import {flipbookMotion} from '../../flipbook/spec';
import {PAGE_WHEEL_LOCK_MS,PAGE_WHEEL_RESET_MS,PAGE_WHEEL_THRESHOLD,PAN_CANCEL_DURATION,PAN_COMMIT_DURATION,PAN_COMMIT_PROGRESS,PAN_COMMIT_VELOCITY,SINGLE_PAGE_FLIP_PHASE_GAP_MS,SINGLE_PAGE_PEEK,SINGLE_PAGE_PREFLIP_PAN_DURATION} from './constants';

type PanGesture={pointerId:number;direction:'next'|'prev';startX:number;lastX:number;lastAt:number;velocity:number;progress:number;started:boolean};

function sameContentSpread(a:number,b:number){
  if(a<=0||b<=0)return a===b;
  return Math.floor((a-1)/2)===Math.floor((b-1)/2);
}

export function usePageNavigation({zoomMode,pageIndex,pageCount,hasSelectedElement,flipBook,focusTrack,neighborIndex,neighborAvailable,showSingleAdd,pageCanvasWidth,visualReverse,focusedShift,onSelectPage,onAddPage}:{
  zoomMode:'spread'|'page';pageIndex:number;pageCount:number;hasSelectedElement:boolean;
  flipBook:RefObject<EditorFlipBookHandle|null>;focusTrack:RefObject<HTMLDivElement|null>;
  neighborIndex:number;neighborAvailable:boolean;showSingleAdd:boolean;pageCanvasWidth:number;visualReverse:boolean;focusedShift:number;
  onSelectPage:(index:number)=>void;onAddPage:()=>void;
}){
  const panGesture=useRef<PanGesture|null>(null);
  const wheelAccumulator=useRef(0),wheelLocked=useRef(false),wheelTimer=useRef<number|null>(null),wheelResetTimer=useRef<number|null>(null);
  const pendingSingleTarget=useRef<number|null>(null),singleMotionActive=useRef(false),singlePanTimer=useRef<number|null>(null),singleCommitTimer=useRef<number|null>(null),singleReleaseTimer=useRef<number|null>(null);

  useEffect(()=>()=>{
    if(wheelTimer.current!==null)window.clearTimeout(wheelTimer.current);
    if(wheelResetTimer.current!==null)window.clearTimeout(wheelResetTimer.current);
    if(singlePanTimer.current!==null)window.clearTimeout(singlePanTimer.current);
    if(singleCommitTimer.current!==null)window.clearTimeout(singleCommitTimer.current);
    if(singleReleaseTimer.current!==null)window.clearTimeout(singleReleaseTimer.current);
  },[]);

  function setTrackShift(shift:number,transition='none'){
    const node=focusTrack.current;if(!node)return;
    node.style.transition=transition;node.style.transform=`translateX(${shift}px)`;
  }
  function singleShiftFor(index:number){
    return index>0&&index%2===0?-pageCanvasWidth*(1-SINGLE_PAGE_PEEK):0;
  }
  function releaseSingleMotion(){
    if(singleReleaseTimer.current!==null)window.clearTimeout(singleReleaseTimer.current);
    singleReleaseTimer.current=window.setTimeout(()=>{singleMotionActive.current=false;},80);
  }
  function commitPendingSingle(){
    const target=pendingSingleTarget.current;
    if(target===null)return;
    pendingSingleTarget.current=null;
    if(singlePanTimer.current!==null){window.clearTimeout(singlePanTimer.current);singlePanTimer.current=null;}
    if(singleCommitTimer.current!==null){window.clearTimeout(singleCommitTimer.current);singleCommitTimer.current=null;}
    onSelectPage(target);
    requestAnimationFrame(()=>setTrackShift(singleShiftFor(target),'none'));
    releaseSingleMotion();
  }
  function animateSinglePan(targetIndex:number){
    singleMotionActive.current=true;
    const targetShift=singleShiftFor(targetIndex);
    setTrackShift(targetShift,`transform ${PAN_COMMIT_DURATION}ms cubic-bezier(.2,.76,.18,1)`);
    if(singlePanTimer.current!==null)window.clearTimeout(singlePanTimer.current);
    singlePanTimer.current=window.setTimeout(()=>{
      singlePanTimer.current=null;
      onSelectPage(targetIndex);
      requestAnimationFrame(()=>setTrackShift(targetShift,'none'));
      releaseSingleMotion();
    },PAN_COMMIT_DURATION+16);
  }
  function startCrossFlip(targetIndex:number,controller:EditorFlipBookHandle){
    pendingSingleTarget.current=targetIndex;
    singleMotionActive.current=true;
    const targetShift=singleShiftFor(targetIndex);
    const startFlip=()=>{
      if(pendingSingleTarget.current!==targetIndex)return;
      if(targetIndex>pageIndex)controller.flipNext();else controller.flipPrev();
      if(singleCommitTimer.current!==null)window.clearTimeout(singleCommitTimer.current);
      singleCommitTimer.current=window.setTimeout(commitPendingSingle,flipbookMotion.flippingTime+180);
    };
    const needsPrePan=focusTrack.current!==null&&Math.abs(targetShift-focusedShift)>1;
    if(!needsPrePan){startFlip();return;}

    setTrackShift(targetShift,`transform ${SINGLE_PAGE_PREFLIP_PAN_DURATION}ms cubic-bezier(.2,.76,.18,1)`);
    if(singlePanTimer.current!==null)window.clearTimeout(singlePanTimer.current);
    singlePanTimer.current=window.setTimeout(()=>{
      singlePanTimer.current=null;
      if(pendingSingleTarget.current!==targetIndex)return;
      setTrackShift(targetShift,'none');
      singlePanTimer.current=window.setTimeout(()=>{
        singlePanTimer.current=null;
        startFlip();
      },SINGLE_PAGE_FLIP_PHASE_GAP_MS);
    },SINGLE_PAGE_PREFLIP_PAN_DURATION+16);
  }
  function navigateSinglePage(targetIndex:number){
    if(zoomMode!=='page'||targetIndex<0||targetIndex>=pageCount||targetIndex===pageIndex)return;
    if(singleMotionActive.current)return;

    const distance=Math.abs(targetIndex-pageIndex);
    if(distance>1){
      flipBook.current?.turnTo(targetIndex);
      onSelectPage(targetIndex);
      return;
    }
    if(sameContentSpread(pageIndex,targetIndex)){
      animateSinglePan(targetIndex);
      return;
    }

    const controller=flipBook.current;
    if(!controller){onSelectPage(targetIndex);return;}
    startCrossFlip(targetIndex,controller);
  }
  function handleBookFlip(index:number){
    if(zoomMode==='page'&&(pendingSingleTarget.current!==null||singleMotionActive.current))return;
    if(index>=0&&index<pageCount)onSelectPage(index);
  }
  function handleFlipState(state:string){
    if(zoomMode==='page'&&state==='read'&&pendingSingleTarget.current!==null)commitPendingSingle();
  }

  function handlePageWheel(event:ReactWheelEvent<HTMLDivElement>){
    if(Math.abs(event.deltaY)<2)return;
    const target=event.target as HTMLElement;
    if(hasSelectedElement&&target.closest('.page-canvas,.cover-editor-photo-hit'))return;
    event.preventDefault();event.stopPropagation();
    if(wheelLocked.current)return;
    wheelAccumulator.current+=event.deltaY;
    if(wheelResetTimer.current!==null)window.clearTimeout(wheelResetTimer.current);
    wheelResetTimer.current=window.setTimeout(()=>{wheelAccumulator.current=0;},PAGE_WHEEL_RESET_MS);
    if(Math.abs(wheelAccumulator.current)<PAGE_WHEEL_THRESHOLD)return;
    const direction=wheelAccumulator.current>0?'next':'prev';
    wheelAccumulator.current=0;wheelLocked.current=true;
    let lockDuration=PAGE_WHEEL_LOCK_MS;
    if(zoomMode==='spread'){
      if(direction==='next')flipBook.current?.flipNext();else flipBook.current?.flipPrev();
    }else{
      const step=direction==='next'?1:-1,targetIndex=pageIndex+step;
      const validTarget=targetIndex>=0&&targetIndex<pageCount;
      if(validTarget){
        const crossSpread=!sameContentSpread(pageIndex,targetIndex);
        const targetShift=singleShiftFor(targetIndex);
        const needsPrePan=crossSpread&&focusTrack.current!==null&&Math.abs(targetShift-focusedShift)>1;
        lockDuration=crossSpread
          ?Math.max(PAGE_WHEEL_LOCK_MS,(needsPrePan?SINGLE_PAGE_PREFLIP_PAN_DURATION+SINGLE_PAGE_FLIP_PHASE_GAP_MS:0)+flipbookMotion.flippingTime+160)
          :Math.max(PAGE_WHEEL_LOCK_MS,PAN_COMMIT_DURATION+120);
      }
      navigateSinglePage(targetIndex);
    }
    if(wheelTimer.current!==null)window.clearTimeout(wheelTimer.current);
    wheelTimer.current=window.setTimeout(()=>{wheelLocked.current=false;},lockDuration);
  }

  function canPan(direction:'next'|'prev'){
    if(zoomMode!=='page'||pageIndex===0||singleMotionActive.current||(!neighborAvailable&&!showSingleAdd))return false;
    return direction==='next'?!visualReverse:visualReverse;
  }
  function panTargetShift(direction:'next'|'prev'){return direction==='next'?-pageCanvasWidth*(1-SINGLE_PAGE_PEEK):0;}
  function clearPan(){panGesture.current=null;if(focusTrack.current)focusTrack.current.style.transition='';}
  function finishPan(commit:boolean){
    const gesture=panGesture.current;if(!gesture)return;
    const targetShift=panTargetShift(gesture.direction);
    const remaining=commit?1-gesture.progress:gesture.progress;
    const ratio=Math.max(commit?.42:.45,Math.min(1,remaining));
    const baseDuration=commit?PAN_COMMIT_DURATION:PAN_CANCEL_DURATION;
    const duration=Math.max(commit?150:120,Math.round(baseDuration*ratio));
    singleMotionActive.current=true;
    setTrackShift(commit?targetShift:focusedShift,`transform ${duration}ms ${commit?'cubic-bezier(.2,.76,.18,1)':'cubic-bezier(.3,.72,.24,1)'}`);
    if(singlePanTimer.current!==null)window.clearTimeout(singlePanTimer.current);
    singlePanTimer.current=window.setTimeout(()=>{
      singlePanTimer.current=null;
      if(commit){
        if(neighborIndex>=0){
          onSelectPage(neighborIndex);
          requestAnimationFrame(()=>setTrackShift(singleShiftFor(neighborIndex),'none'));
        }else if(showSingleAdd)onAddPage();
      }
      clearPan();
      releaseSingleMotion();
    },duration+16);
  }
  function startPan(direction:'next'|'prev',event:ReactPointerEvent<HTMLDivElement>){
    if(event.button!==0||!canPan(direction))return;
    const now=performance.now();
    panGesture.current={pointerId:event.pointerId,direction,startX:event.clientX,lastX:event.clientX,lastAt:now,velocity:0,progress:0,started:false};
    event.currentTarget.setPointerCapture(event.pointerId);event.preventDefault();
  }
  function movePan(event:ReactPointerEvent<HTMLDivElement>){
    const gesture=panGesture.current;if(!gesture||gesture.pointerId!==event.pointerId)return;
    const now=performance.now(),dt=Math.max(1,now-gesture.lastAt);
    gesture.velocity=(event.clientX-gesture.lastX)/dt;gesture.lastX=event.clientX;gesture.lastAt=now;
    const signed=gesture.direction==='next'?gesture.startX-event.clientX:event.clientX-gesture.startX;
    const travel=Math.max(1,pageCanvasWidth*(1-SINGLE_PAGE_PEEK));
    const progress=Math.max(0,Math.min(1,signed/travel));gesture.progress=progress;
    if(!gesture.started&&progress>.01)gesture.started=true;
    if(gesture.started){setTrackShift(focusedShift+(panTargetShift(gesture.direction)-focusedShift)*progress);event.preventDefault();}
  }
  function endPan(event:ReactPointerEvent<HTMLDivElement>){
    const gesture=panGesture.current;if(!gesture||gesture.pointerId!==event.pointerId)return;
    const signedVelocity=gesture.direction==='next'?-gesture.velocity:gesture.velocity;
    const commit=gesture.started&&(gesture.progress>PAN_COMMIT_PROGRESS||signedVelocity>PAN_COMMIT_VELOCITY);
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    if(gesture.started)finishPan(commit);
    else{
      panGesture.current=null;
      if(neighborIndex>=0)animateSinglePan(neighborIndex);
      else if(showSingleAdd)onAddPage();
    }
  }
  function cancelPan(event:ReactPointerEvent<HTMLDivElement>){
    const gesture=panGesture.current;if(!gesture||gesture.pointerId!==event.pointerId)return;
    if(gesture.started)finishPan(false);else panGesture.current=null;
  }
  return {handlePageWheel,navigateSinglePage,handleBookFlip,handleFlipState,startPan,movePan,endPan,cancelPan};
}
