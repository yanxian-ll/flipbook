import {create} from 'zustand';

export type CoverSide='front'|'back';

interface CoverContextState {
  side:CoverSide|null;
  setSide:(side:CoverSide|null)=>void;
}

export const useCoverContext=create<CoverContextState>(set=>({
  side:null,
  setSide:side=>set({side}),
}));
