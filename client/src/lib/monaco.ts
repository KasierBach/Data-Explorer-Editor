import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

type MonacoWorkerFactory = {
    getWorker: (_workerId: string, label: string) => Worker;
};

type MonacoGlobal = typeof globalThis & {
    MonacoEnvironment?: MonacoWorkerFactory;
    __DATA_EXPLORER_MONACO_CONFIGURED__?: boolean;
};

const monacoGlobal = globalThis as MonacoGlobal;

if (!monacoGlobal.__DATA_EXPLORER_MONACO_CONFIGURED__) {
    monacoGlobal.MonacoEnvironment = {
        getWorker(_workerId, label) {
            switch (label) {
                case 'json':
                    return new jsonWorker();
                case 'css':
                case 'scss':
                case 'less':
                    return new cssWorker();
                case 'html':
                case 'handlebars':
                case 'razor':
                    return new htmlWorker();
                case 'typescript':
                case 'javascript':
                    return new tsWorker();
                default:
                    return new editorWorker();
            }
        },
    };

    loader.config({ monaco });
    monacoGlobal.__DATA_EXPLORER_MONACO_CONFIGURED__ = true;
}
