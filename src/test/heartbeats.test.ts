import * as assert from 'assert';
import { Data, Heartbeats } from '../heartbeats';

const d = (branch: string, repository = 'odoo-dev/enterprise'): Data => ({
    title: `${branch} (${repository})`,
    branch,
    repository,
    folder: `/src/${repository.split('/')[1]}`,
});

// Records what would be sent to the server, with a clock the test moves forward
function setup() {
    let now = Date.parse('2026-10-01T10:00:00Z');
    const sent: string[] = [];
    const heartbeats = new Heartbeats(
        async (data: Data, timestamp: Date) => {
            const t = (timestamp.getTime() - Date.parse('2026-10-01T10:00:00Z')) / 1000;
            const repo = data.repository === 'odoo-dev/enterprise' ? '' : ` (${data.repository})`;
            sent.push(`${t}s ${data.branch}${repo}${data.focused === false ? ' focused=false' : ''}`);
        },
        () => new Date(now)
    );
    const at = (seconds: number) => (now = Date.parse('2026-10-01T10:00:00Z') + seconds * 1000);
    return { heartbeats, sent, at };
}

describe('Heartbeats', () => {
    it('extends the same event with a heartbeat every minute', async () => {
        const { heartbeats, sent, at } = setup();
        await heartbeats.beat(d('saas-19.2-foo'));
        at(60);
        await heartbeats.beat(d('saas-19.2-foo'));
        at(120);
        await heartbeats.beat(d('saas-19.2-foo'));
        assert.deepStrictEqual(sent, ['0s saas-19.2-foo', '60s saas-19.2-foo', '120s saas-19.2-foo']);
    });

    it('ends the previous event 1ms before the new one when the branch changes', async () => {
        const { heartbeats, sent, at } = setup();
        await heartbeats.beat(d('saas-19.2-foo'));
        at(30);
        await heartbeats.beat(d('saas-19.2'));
        assert.deepStrictEqual(sent, ['0s saas-19.2-foo', '29.999s saas-19.2-foo', '30s saas-19.2']);
    });

    it('sends nothing on editor changes that keep the branch', async () => {
        const { heartbeats, sent, at } = setup();
        await heartbeats.beat(d('saas-19.2-foo'));
        at(10);
        await heartbeats.beatIfChanged(d('saas-19.2-foo'));
        at(20);
        await heartbeats.beatIfChanged(d('saas-19.2-foo'));
        assert.deepStrictEqual(sent, ['0s saas-19.2-foo']);
    });

    it('starts a new event right away on an editor change to another branch', async () => {
        const { heartbeats, sent, at } = setup();
        await heartbeats.beat(d('saas-19.2-foo'));
        at(10);
        await heartbeats.beatIfChanged(d('master-bar'));
        assert.deepStrictEqual(sent, ['0s saas-19.2-foo', '9.999s saas-19.2-foo', '10s master-bar']);
    });

    it('starts a new event when switching to another repository on the same branch name', async () => {
        const { heartbeats, sent, at } = setup();
        await heartbeats.beat(d('saas-19.2'));
        at(10);
        await heartbeats.beatIfChanged(d('saas-19.2', 'odoo/odoo'));
        assert.deepStrictEqual(sent, ['0s saas-19.2', '9.999s saas-19.2', '10s saas-19.2 (odoo/odoo)']);
    });

    it('closes the event with a focused=false heartbeat when focus is lost', async () => {
        const { heartbeats, sent, at } = setup();
        await heartbeats.beat(d('saas-19.2-foo'));
        at(45);
        await heartbeats.close();
        assert.deepStrictEqual(sent, ['0s saas-19.2-foo', '44.999s saas-19.2-foo', '45s saas-19.2-foo focused=false']);
    });

    it('starts a fresh event when focus comes back', async () => {
        const { heartbeats, sent, at } = setup();
        await heartbeats.beat(d('saas-19.2-foo'));
        at(45);
        await heartbeats.close();
        at(300);
        await heartbeats.beat(d('saas-19.2-foo'));
        // No extra "previous data" heartbeat: the closed event must not be extended
        assert.deepStrictEqual(sent.slice(3), ['300s saas-19.2-foo']);
    });

    it('does nothing when focus is lost twice', async () => {
        const { heartbeats, sent } = setup();
        await heartbeats.close();
        await heartbeats.beat(d('saas-19.2-foo'));
        await heartbeats.close();
        await heartbeats.close();
        assert.strictEqual(sent.filter((s) => s.includes('focused=false')).length, 1);
    });

    it('keeps the order of heartbeats requested at the same time', async () => {
        const { heartbeats, sent, at } = setup();
        at(0);
        const first = heartbeats.beat(d('a'));
        const second = heartbeats.close();
        await Promise.all([first, second]);
        assert.deepStrictEqual(sent, ['0s a', '-0.001s a', '0s a focused=false']);
    });
});
