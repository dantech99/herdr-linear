import { test } from "node:test";
import assert from "node:assert/strict";
import { ISSUES_QUERY, parseConfig, parseIssues, linearError, filterIssues, STATUSES, ago } from "../mods/linear/linear.js";
import { safeUrl } from "../mods/linear/urls.js";

const node = (over = {}) => ({
  id: "a1", identifier: "ENG-12", title: "Fix login", url: "https://linear.app/acme/issue/ENG-12/fix-login",
  branchName: "dan/eng-12-fix-login", priority: 2, priorityLabel: "High", updatedAt: "2026-10-29T10:00:00.000Z",
  description: "Users can't log in\nwith SSO.",
  state: { name: "In Progress", type: "started", color: "#f2c94c" },
  team: { key: "ENG", name: "Engineering" },
  labels: { nodes: [{ name: "Bug", color: "#eb5757" }] },
  ...over,
});

test("the query asks only for the viewer's open issues", () => {
  assert.match(ISSUES_QUERY, /viewer\s*{\s*assignedIssues/);
  assert.match(ISSUES_QUERY, /nin:\s*\["completed",\s*"canceled"\]/);
  assert.match(ISSUES_QUERY, /branchName/);
});

test("parseConfig reads apiKey and expands ~ in team repos", () => {
  const config = parseConfig('{ "apiKey": " lin_api_x ", "repos": { "ENG": "~/dev/app", "OPS": "/srv/ops" } }', "/home/me");
  assert.deepEqual(config, { apiKey: "lin_api_x", repos: { ENG: "/home/me/dev/app", OPS: "/srv/ops" } });
});

test("parseConfig tolerates a missing or broken file", () => {
  assert.deepEqual(parseConfig(null, "/h"), { apiKey: null, repos: {} });
  assert.deepEqual(parseConfig("not json", "/h"), { apiKey: null, repos: {}, error: "linear.json is not valid JSON" });
});

test("parseIssues flattens labels and keeps what rows need", () => {
  const [issue] = parseIssues({ data: { viewer: { assignedIssues: { nodes: [node()] } } } });
  assert.equal(issue.identifier, "ENG-12");
  assert.equal(issue.team, "ENG");
  assert.equal(issue.stateType, "started");
  assert.deepEqual(issue.labels, [{ name: "Bug", color: "#eb5757" }]);
  assert.equal(issue.branchName, "dan/eng-12-fix-login");
});

test("parseIssues surfaces GraphQL errors", () => {
  assert.throws(() => parseIssues({ errors: [{ message: "Authentication required, not authenticated" }] }), /Invalid Linear API key/);
  assert.throws(() => parseIssues({ errors: [{ message: "Rate limited" }] }), /Rate limited/);
});

test("linearError explains HTTP failures", () => {
  assert.equal(linearError(401, ""), "Invalid Linear API key");
  assert.equal(linearError(400, '{"errors":[{"message":"Authentication required"}]}'), "Invalid Linear API key");
  assert.equal(linearError(500, "boom"), "Linear answered 500");
});

test("filterIssues by status group and text", () => {
  const issues = parseIssues({ data: { viewer: { assignedIssues: { nodes: [
    node(),
    node({ id: "a2", identifier: "OPS-3", title: "Rotate certs", state: { name: "Todo", type: "unstarted", color: "#ccc" }, team: { key: "OPS", name: "Ops" } }),
    node({ id: "a3", identifier: "ENG-40", title: "Idea", state: { name: "Backlog", type: "backlog", color: "#999" } }),
  ] } } } });
  const ids = (list) => list.map((i) => i.identifier);
  assert.deepEqual(STATUSES.map((s) => s.id), ["all", "todo", "doing", "backlog"]);
  assert.deepEqual(ids(filterIssues(issues, { status: "all", text: "" })), ["ENG-12", "OPS-3", "ENG-40"]);
  assert.deepEqual(ids(filterIssues(issues, { status: "doing", text: "" })), ["ENG-12"]);
  assert.deepEqual(ids(filterIssues(issues, { status: "todo", text: "" })), ["OPS-3"]);
  assert.deepEqual(ids(filterIssues(issues, { status: "backlog", text: "" })), ["ENG-40"]);
  assert.deepEqual(ids(filterIssues(issues, { status: "all", text: "ops-3" })), ["OPS-3"]);
  assert.deepEqual(ids(filterIssues(issues, { status: "all", text: "CERTS" })), ["OPS-3"]);
});

test("ago counts minutes, hours and days", () => {
  const now = Date.parse("2026-10-30T12:00:00Z");
  assert.equal(ago("2026-10-30T11:55:00Z", now), "5m");
  assert.equal(ago("2026-10-30T09:00:00Z", now), "3h");
  assert.equal(ago("2026-10-27T12:00:00Z", now), "3d");
});

test("safeUrl lets only https through", () => {
  assert.equal(safeUrl("https://linear.app/x"), "https://linear.app/x");
  assert.equal(safeUrl("http://linear.app/x"), null);
  assert.equal(safeUrl("file:///etc/passwd"), null);
  assert.equal(safeUrl("--help"), null);
});
