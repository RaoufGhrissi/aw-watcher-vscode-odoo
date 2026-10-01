import { hostname } from 'os';
import { AWClient } from 'aw-client';
import { ExtensionContext, LogOutputChannel, Uri, extensions, window } from 'vscode';
import { API as GitAPI, GitExtension, Repository as GitRepository } from './git';
import { Data, Heartbeats } from './heartbeats';
import { pickRemote, repositoryName } from './remote';

// Not `app.editor.activity`: aw-webui expects `file`, `language` and `project` in
// those events, and this watcher records the repository and branch, not the file
const CLIENT_NAME = 'aw-watcher-vscode-odoo';
const BUCKET_ID = `${CLIENT_NAME}_${hostname()}`;
const EVENT_TYPE = 'app.vscode.activity';
const INTERVAL_MS = 60 * 1000;
const PULSETIME_S = 80;

let heartbeats: Heartbeats | undefined;

export async function activate(context: ExtensionContext) {
    const log = window.createOutputChannel('ActivityWatch', { log: true });
    context.subscriptions.push(log);

    const client = new AWClient(CLIENT_NAME);
    let bucketReady = false;
    heartbeats = new Heartbeats(async (data, timestamp) => {
        try {
            if (!bucketReady) {
                await client.ensureBucket(BUCKET_ID, EVENT_TYPE, hostname());
                bucketReady = true;
            }
            await client.heartbeat(BUCKET_ID, PULSETIME_S, { timestamp, duration: 0, data });
            log.debug('heartbeat', timestamp.toISOString(), JSON.stringify(data));
        } catch (err) {
            // The server may be down or restarted (bucket gone): retry everything next time
            bucketReady = false;
            log.warn(`heartbeat failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    });

    const git = await getGitApi(log);
    const repositories = new RepositoryTracker(git);
    const beats = heartbeats;
    const currentData = (): Data => repositories.current();
    // Starts a new event right away if the repository or the branch changed
    const onChange = () => window.state.focused && beats.beatIfChanged(currentData());

    context.subscriptions.push(
        window.onDidChangeWindowState((state) => (state.focused ? beats.beat(currentData()) : beats.close())),
        // Opening a file of another repository
        window.onDidChangeActiveTextEditor(onChange)
    );
    // A checkout, from VS Code or a terminal. Also fires on edits, which send
    // nothing as long as the branch is the same.
    if (git) {
        const watch = (repository: GitRepository) => context.subscriptions.push(repository.state.onDidChange(onChange));
        git.repositories.forEach(watch);
        context.subscriptions.push(git.onDidOpenRepository(watch));
    }
    const timer = setInterval(() => window.state.focused && beats.beat(currentData()), INTERVAL_MS);
    context.subscriptions.push({ dispose: () => clearInterval(timer) });

    if (window.state.focused) {
        beats.beat(currentData());
    }
}

export function deactivate() {
    return heartbeats?.close();
}

// The repository of the last file opened in a repository. Anything else (Claude
// Code, terminal, settings, files outside a repository) keeps the current one, so
// it does not start a new event.
class RepositoryTracker {
    private _lastRepoFile: Uri | undefined;

    constructor(private readonly _git: GitAPI | undefined) {}

    public current(): Data {
        const file = window.activeTextEditor?.document.uri;
        if (file && this._git?.getRepository(file)) {
            this._lastRepoFile = file;
        }
        // Read again each time, so a checkout is picked up
        const repository = this._lastRepoFile && this._git?.getRepository(this._lastRepoFile);
        if (!repository) {
            return { title: 'unknown', branch: 'unknown', repository: 'unknown', folder: 'unknown' };
        }
        const { HEAD, remotes } = repository.state;
        const remoteName = pickRemote(
            remotes.map((r) => r.name),
            HEAD?.upstream?.remote
        );
        const remote = remotes.find((r) => r.name === remoteName);
        const url = remote?.fetchUrl ?? remote?.pushUrl;
        const folder = repository.rootUri.fsPath;
        const branch = HEAD?.name ?? 'unknown';
        const name = (url && repositoryName(url)) || folder.split(/[\\/]/).pop() || 'unknown';
        // `title` is what aw-webui shows on the timeline; it only depends on the other fields
        return { title: `${branch} (${name})`, branch, repository: name, folder };
    }
}

async function getGitApi(log: LogOutputChannel): Promise<GitAPI | undefined> {
    try {
        const extension = extensions.getExtension<GitExtension>('vscode.git');
        const git = extension && (extension.isActive ? extension.exports : await extension.activate());
        return git?.enabled ? git.getAPI(1) : undefined;
    } catch (err) {
        log.warn(`Git extension unavailable, branch will be "unknown": ${String(err)}`);
        return undefined;
    }
}
