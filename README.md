# aw-watcher-vscode-odoo

VS Code watcher for [ActivityWatch](https://activitywatch.net) that records the time
spent per Git branch. It follows the same heartbeat model as the Odoo web watcher
([odoo/aw-watcher-web](https://github.com/odoo/aw-watcher-web)).

## What it records

Events of type `app.vscode.activity` in the bucket `aw-watcher-vscode-odoo_<hostname>`,
with the data:

```json
{
    "title": "saas-19.2-timesheet_grid-assistant-outlook-abgh (odoo-dev/enterprise)",
    "branch": "saas-19.2-timesheet_grid-assistant-outlook-abgh",
    "repository": "odoo-dev/enterprise",
    "folder": "/home/odoo/raouf/odoo/enterprise"
}
```

- All of it describes the repository of the last file opened in a repository.
  Switching files, or to Claude Code, the terminal, settings, or a file outside any
  repository, keeps the current repository, so the event goes on.
- `repository` is the `owner/name` of the remote the branch lives on: the remote it
  tracks, else `origin`, else the first one; the folder name without any remote.
  Credentials in remote URLs are never sent.
- `title` is `branch (repository)`, for the aw-webui timeline.
- A new event starts only when the repository or the branch changes: opening a file
  of another repository, or a checkout, from VS Code or a terminal (seen by the Git
  extension within a few seconds).
- `"unknown"` until a file of a repository is opened; `branch` is also `"unknown"` on
  a detached HEAD.

Not `app.editor.activity`: aw-webui expects `file`, `language` and `project` in
those events, and sending the file would start a new event on every file switch.

## How

While the VS Code window is focused, a heartbeat is sent every minute with a
pulsetime of 80s, so they merge into one event. When the data changes, the previous
data is sent once more 1ms before the new one, so events don't overlap. When the
window loses focus, the previous data is sent once more, then the same data with
`"focused": false`, a 0s event that closes the previous one.
Unfocused windows send nothing. Being away from the keyboard is left to
`aw-watcher-afk`.

## Requirements

- ActivityWatch running on `http://127.0.0.1:5600`.
- VS Code 1.85+ with the built-in Git extension enabled.

Logs: Output panel, "ActivityWatch" channel (set the log level to Debug to see each
heartbeat).

## Development

```sh
npm install
npm test          # unit tests of the heartbeat model
npm run package   # builds the .vsix
code --install-extension aw-watcher-vscode-odoo-*.vsix
```
