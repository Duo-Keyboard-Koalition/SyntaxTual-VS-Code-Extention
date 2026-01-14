import { useCallback } from 'react';

interface VSCodeApi {
  postMessage: (message: any) => void;
  getState: () => any;
  setState: (state: any) => void;
}

declare global {
  interface Window {
    acquireVsCodeApi?: () => VSCodeApi;
  }
}

let vscodeApi: VSCodeApi | null = null;

export function useVSCodeApi() {
  if (!vscodeApi && typeof window !== 'undefined' && window.acquireVsCodeApi) {
    vscodeApi = window.acquireVsCodeApi();
  }

  const postMessage = useCallback((type: string, payload?: any) => {
    vscodeApi?.postMessage({ type, payload });
  }, []);

  const getState = useCallback(() => {
    return vscodeApi?.getState();
  }, []);

  const setState = useCallback((state: any) => {
    vscodeApi?.setState(state);
  }, []);

  return { postMessage, getState, setState };
}
