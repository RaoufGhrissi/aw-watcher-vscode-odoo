// `owner/name` of a remote URL, e.g. `odoo-dev/enterprise` for
// `git@github.com:odoo-dev/enterprise.git` or `https://user:token@github.com/odoo/odoo`.
// Only the path is kept, so credentials embedded in the URL are never sent.
export function repositoryName(url: string): string | undefined {
    let path = url.trim();
    const scpLike = /^[^/:]+@[^/:]+:(?!\/)(.+)$/.exec(path); // git@host:owner/name
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\/[^/]*\/(.+)$/i.exec(path); // https://, ssh://
    if (scpLike) {
        path = scpLike[1];
    } else if (withScheme) {
        path = withScheme[1];
    }
    return path.replace(/\/+$/, '').replace(/\.git$/, '') || undefined;
}

// The remote a branch lives on: the one it tracks, else `origin`, else the first one
export function pickRemote(remotes: string[], tracked: string | undefined): string | undefined {
    if (tracked && remotes.includes(tracked)) {
        return tracked;
    }
    return remotes.includes('origin') ? 'origin' : remotes[0];
}
