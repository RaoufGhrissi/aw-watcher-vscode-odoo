// Heartbeat model, same as odoo/aw-watcher-web:
// - while focused, a heartbeat is sent every minute with a pulsetime of 80s, so
//   consecutive heartbeats with the same data merge into one event;
// - when the data changes, the previous data is sent once more 1ms before the new
//   one, so the previous event ends exactly where the new one starts;
// - when focus is lost, the previous data is sent once more, then the same data
//   with `focused: false`, which makes a 0s event that closes the previous one.

export type Data = {
    title: string;
    branch: string;
    // `owner/name` of the remote the branch lives on, e.g. `odoo-dev/enterprise`
    repository: string;
    // Root folder of the repository
    folder: string;
    focused?: false;
};

export type Send = (data: Data, timestamp: Date) => Promise<void>;

export class Heartbeats {
    private _last: Data | undefined;
    // Heartbeats are sent one after the other, in the order they were requested
    private _queue: Promise<void> = Promise.resolve();

    constructor(
        private readonly _send: Send,
        private readonly _now: () => Date = () => new Date()
    ) {}

    // Extends the current event, or starts a new one if the data changed
    public beat(data: Data): Promise<void> {
        return this._enqueue(async () => {
            const now = this._now();
            if (this._last && !sameData(this._last, data)) {
                await this._send(this._last, new Date(now.getTime() - 1));
            }
            await this._send(data, now);
            this._last = data;
        });
    }

    // Starts a new event only if the data changed; otherwise the next beat extends it
    public beatIfChanged(data: Data): Promise<void> {
        return this._enqueue(async () => {
            if (this._last && sameData(this._last, data)) {
                return;
            }
            const now = this._now();
            if (this._last) {
                await this._send(this._last, new Date(now.getTime() - 1));
            }
            await this._send(data, now);
            this._last = data;
        });
    }

    // Ends the current event now
    public close(): Promise<void> {
        return this._enqueue(async () => {
            if (!this._last) {
                return;
            }
            const last = this._last;
            this._last = undefined;
            const now = this._now();
            await this._send(last, new Date(now.getTime() - 1));
            await this._send({ ...last, focused: false }, now);
        });
    }

    private _enqueue(task: () => Promise<void>): Promise<void> {
        this._queue = this._queue.then(task, task);
        return this._queue;
    }
}

function sameData(a: Data, b: Data): boolean {
    return (
        a.branch === b.branch && a.repository === b.repository && a.folder === b.folder && a.focused === b.focused
    );
}
