// The part of the built-in Git extension API used here.
// Full definition: https://github.com/microsoft/vscode/blob/main/extensions/git/src/api/git.d.ts

import { Event, Uri } from 'vscode';

export interface Repository {
    readonly rootUri: Uri;
    readonly state: {
        readonly HEAD: { readonly name?: string; readonly upstream?: { readonly remote: string } } | undefined;
        readonly remotes: { readonly name: string; readonly fetchUrl?: string; readonly pushUrl?: string }[];
        // Fires when the Git extension sees a change in the repository, including a checkout
        readonly onDidChange: Event<void>;
    };
}

export interface API {
    readonly repositories: Repository[];
    readonly onDidOpenRepository: Event<Repository>;
    getRepository(uri: Uri): Repository | null;
}

export interface GitExtension {
    readonly enabled: boolean;
    getAPI(version: 1): API;
}
