// Pure helpers for the Linear panel: the GraphQL query, config and response parsing, filters.
// No Herdr imports, so `node --test` can load this file.

export const API_URL = "https://api.linear.app/graphql";

// Linear's largest page; a load follows `endCursor` until the last page, up to MAX_PAGES.
export const PAGE_SIZE = 250;
export const MAX_PAGES = 40;

// The viewer's open issues: anything not completed or canceled, most recently updated first.
export const ISSUES_QUERY = `query AssignedIssues($first: Int!, $after: String) {
  viewer {
    assignedIssues(first: $first, after: $after, orderBy: updatedAt, filter: { state: { type: { nin: ["completed", "canceled"] } } }) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id identifier title url branchName priority priorityLabel updatedAt description
        state { name type color }
        team { key name }
        labels { nodes { name color } }
      }
    }
  }
}`;

// Status chips, by Linear's workflow state types.
export const STATUSES = [
  { id: "all", label: "All", types: null },
  { id: "todo", label: "Todo", types: ["unstarted"] },
  { id: "doing", label: "In progress", types: ["started"] },
  { id: "backlog", label: "Backlog", types: ["backlog", "triage"] },
];

const expand = (path, home) => (path.startsWith("~/") ? `${home}${path.slice(1)}` : path);

// `~/.config/herdr-app/linear.json`: { "apiKey": "lin_api_…", "repos": { "<TEAM KEY>": "~/dev/repo" },
// "repoChoices": ["~/dev/other", …] } (more folders on this computer the agent dialog offers).
export function parseConfig(text, home) {
  if (text == null) return { apiKey: null, repos: {}, repoChoices: [] };
  let raw;
  try { raw = JSON.parse(text); } catch { return { apiKey: null, repos: {}, repoChoices: [], error: "linear.json is not valid JSON" }; }
  const apiKey = typeof raw?.apiKey === "string" && raw.apiKey.trim() ? raw.apiKey.trim() : null;
  const repos = {};
  for (const [team, folder] of Object.entries(raw?.repos ?? {})) {
    if (typeof folder === "string" && folder.trim()) repos[team.toUpperCase()] = expand(folder.trim(), home);
  }
  const choices = Array.isArray(raw?.repoChoices) ? raw.repoChoices : [];
  const repoChoices = choices.filter((f) => typeof f === "string" && f.trim()).map((f) => expand(f.trim(), home));
  return { apiKey, repos, repoChoices };
}

// The dialog's repositories: the default one first, then each choice on this computer, once each.
export function repoOptions(start, choices) {
  const options = start.cwd ? [start] : [];
  for (const cwd of choices) {
    if (!options.some((o) => o.cwd === cwd && !o.on)) options.push({ cwd, on: null });
  }
  return options;
}

const isAuthError = (message) => /authenticat/i.test(message ?? "");

// A short reason for a failed request, from its status and body.
export function linearError(status, body) {
  if (status === 401) return "Invalid Linear API key";
  try {
    const message = JSON.parse(body)?.errors?.[0]?.message;
    if (message) return isAuthError(message) ? "Invalid Linear API key" : message;
  } catch { /* not JSON */ }
  return `Linear answered ${status}`;
}

export function parseIssues(json) {
  const message = json?.errors?.[0]?.message;
  if (message) throw new Error(isAuthError(message) ? "Invalid Linear API key" : message);
  return (json?.data?.viewer?.assignedIssues?.nodes ?? []).map((n) => ({
    id: n.id, identifier: n.identifier, title: n.title, url: n.url, branchName: n.branchName ?? null,
    priority: n.priority ?? 0, priorityLabel: n.priorityLabel ?? "", updatedAt: n.updatedAt,
    description: n.description ?? null,
    state: n.state?.name ?? "", stateType: n.state?.type ?? "", stateColor: n.state?.color ?? null,
    team: n.team?.key ?? "", teamName: n.team?.name ?? "",
    labels: (n.labels?.nodes ?? []).map((l) => ({ name: l.name, color: l.color })),
  }));
}

// The cursor of the next page, or null on the last one.
export function nextCursor(json) {
  const info = json?.data?.viewer?.assignedIssues?.pageInfo;
  return info?.hasNextPage && info.endCursor ? info.endCursor : null;
}

export function filterIssues(issues, { status, text }) {
  const types = STATUSES.find((s) => s.id === status)?.types ?? null;
  const needle = (text ?? "").trim().toLowerCase();
  return issues.filter((i) => (!types || types.includes(i.stateType))
    && (!needle || `${i.identifier} ${i.title}`.toLowerCase().includes(needle)));
}

export function ago(iso, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
}
