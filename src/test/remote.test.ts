import * as assert from 'assert';
import { pickRemote, repositoryName } from '../remote';

describe('repositoryName', () => {
    it('extracts owner/name from remote URLs', () => {
        assert.strictEqual(repositoryName('git@github.com:odoo-dev/enterprise.git'), 'odoo-dev/enterprise');
        assert.strictEqual(repositoryName('https://github.com/odoo/odoo.git'), 'odoo/odoo');
        assert.strictEqual(repositoryName('https://github.com/odoo/upgrade'), 'odoo/upgrade');
        assert.strictEqual(repositoryName('ssh://git@github.com:22/odoo/odoo.git'), 'odoo/odoo');
        assert.strictEqual(repositoryName('https://gitlab.com/group/sub/project.git/'), 'group/sub/project');
    });

    it('never returns credentials embedded in the URL', () => {
        assert.strictEqual(repositoryName('https://abgh:ghp_secret@github.com/odoo/odoo.git'), 'odoo/odoo');
    });
});

describe('pickRemote', () => {
    it('picks the tracked remote, then origin, then the first one', () => {
        assert.strictEqual(pickRemote(['origin', 'odoo'], 'odoo'), 'odoo');
        assert.strictEqual(pickRemote(['origin', 'odoo'], undefined), 'origin');
        assert.strictEqual(pickRemote(['dev', 'odoo'], 'gone'), 'dev');
        assert.strictEqual(pickRemote([], undefined), undefined);
    });
});
