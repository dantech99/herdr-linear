# Linear for Herdr

A [Herdr](https://herdr.dev) mod that lists the Linear issues assigned to you and starts a coding
agent on one in a fresh git worktree.

![Linear](preview.png)

- Your open issues (not completed or canceled), with state, priority and labels.
- Filter by `Todo`, `In progress`, `Backlog`, or by id and title.
- `Agent` on an issue: pick an installed agent (Claude Code, Codex, OpenCode, Pi…), a model and a
  reasoning level. It creates a worktree on Linear's suggested branch and starts the agent with the
  issue as its task. Optionally asks the agent to use subagents.

## Install

Tell your coding agent:

```
Read ~/.config/herdr-app/AGENTS.md, then add this mod: https://github.com/dantech99/herdr-linear
```

Or by hand:

```sh
git clone https://github.com/dantech99/herdr-linear && cd herdr-linear
cp -R mods/linear mods/linear-agent ~/.config/herdr-app/mods/
```

Then add `"ctrl-shift-y": "mod.open:linear"` to the `global` section of
`~/.config/herdr-app/keys.json`.

## Set up your API key

Create a personal API key in Linear (Settings → Security & access), then:

```sh
cat > ~/.config/herdr-app/linear.json <<'EOF'
{ "apiKey": "lin_api_..." }
EOF
chmod 600 ~/.config/herdr-app/linear.json
```

Or export `LINEAR_API_KEY` in your shell instead.

Optionally map Linear teams to local repos, so `Agent` works from any space:

```json
{
  "apiKey": "lin_api_...",
  "repos": { "ENG": "~/dev/app", "OPS": "~/dev/infra" }
}
```

Unmapped teams use the repo of the space you're in.

## What it touches

- Network: `api.linear.app` (your key goes only there) and `git fetch` when an agent starts.
- Programs: `git`, `sh`, the agents' CLIs (to list models) and your system's URL opener.
- Files: reads `~/.config/herdr-app/linear.json`; creates worktrees under `~/.herdr/worktrees`.
- The issue's description goes into the agent's first message, and the agent is asked to push and
  open a PR. It runs with whatever permissions its own config gives it.

## Develop

```sh
node --test
herdr-app check mods/linear && herdr-app check mods/linear-agent
```

[`RECIPE.md`](RECIPE.md) is the full brief: everything an agent needs to rebuild the mod from an
empty folder.

## License

[MIT](LICENSE). The agent dialog is adapted from `issue-agent` in
[obrunogonzaga/herdr-mods](https://github.com/obrunogonzaga/herdr-mods) (MIT).
