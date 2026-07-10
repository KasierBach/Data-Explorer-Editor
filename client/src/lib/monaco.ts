import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
import 'monaco-editor/esm/vs/basic-languages/sql/sql.contribution.js';
import 'monaco-editor/esm/vs/language/json/monaco.contribution.js';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';

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
            if (label === 'json') {
                return new jsonWorker();
            }

            return new editorWorker();
        },
    };

    loader.config({ monaco });
    monacoGlobal.__DATA_EXPLORER_MONACO_CONFIGURED__ = true;
}
