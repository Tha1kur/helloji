// Exercise real Git indexes and native hooks without touching the developer's index.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync, chmodSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

const source = fileURLToPath(new URL("../", import.meta.url));
function fixture(t) {
    const root = mkdtempSync(join(tmpdir(), "helloji-hook-test-"));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const env = { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" };
    for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR"]) delete env[key];
    const git = (...args) => execFileSync("git", args, { cwd: root, env, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
    const write = (path, content) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), content); };
    for (const path of ["scripts/quality-gates.mjs", "scripts/gitleaks.json", ".gitleaks.toml", ".nvmrc", ".githooks/pre-commit", ".githooks/pre-push", "backend/package.json", ".tools/gitleaks"]) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        copyFileSync(join(source, path), join(root, path));
    }
    chmodSync(join(root, ".tools/gitleaks"), 0o755);
    write(".gitignore", ".tools/\n");
    git("init", "-q"); git("config", "user.email", "fixture@example.invalid"); git("config", "user.name", "Gate fixture");
    git("add", "."); git("commit", "-qm", "Fixture baseline");
    const hook = (name, input = "") => spawnSync("sh", [`.githooks/${name}`], { cwd: root, env, input, encoding: "utf8" });
    return { root, git, write, hook };
}
function passes(result) { assert.equal(result.status, 0, result.stderr + result.stdout); }
function fails(result, pattern) { assert.notEqual(result.status, 0); assert.match(result.stderr + result.stdout, pattern); }

test("clean staged examples and filenames with spaces pass without changing files/index", t => {
    const f = fixture(t);
    f.write("config with spaces/.env.example", "JWT_SECRET=\n"); f.git("add", ".");
    const index = readFileSync(join(f.root, ".git/index"));
    passes(f.hook("pre-commit"));
    assert.deepEqual(readFileSync(join(f.root, ".git/index")), index);
    assert.equal(readFileSync(join(f.root, "config with spaces/.env.example"), "utf8"), "JWT_SECRET=\n");
});
test("introduced whitespace is rejected", t => {
    const f = fixture(t); f.write("note.txt", "trailing space \n"); f.git("add", ".");
    fails(f.hook("pre-commit"), /whitespace/);
});
test("private env and key paths are rejected; removal is allowed", t => {
    const f = fixture(t);
    for (const path of ["backend/.env", "frontend/.env.production", "credentials/private.pem", "keys/id_ed25519"]) {
        f.write(path, "private placeholder\n"); f.git("add", path);
        fails(f.hook("pre-commit"), /Private environment\/key/);
        f.git("reset", "-q", "HEAD", "--", path);
    }
    f.git("add", "backend/.env"); f.git("commit", "-qm", "Fixture unsafe filename");
    f.git("rm", "-q", "backend/.env"); passes(f.hook("pre-commit"));
});
test("scanner checks staged secrets even when the working copy is clean", t => {
    const f = fixture(t);
    f.write("config.txt", `token = "${"ghp_" + "Ab9cDe2FgHi3JkLm4NoPq5RsTu6VwXyZaBcD"}"\n`);
    f.git("add", "config.txt"); f.write("config.txt", "token = \"\"\n");
    fails(f.hook("pre-commit"), /leaks found/);
});
test("missing scanner fails with setup instructions", t => {
    const f = fixture(t); rmSync(join(f.root, ".tools/gitleaks"));
    fails(f.hook("pre-commit"), /install-gitleaks/);
});
test("deletion-only push does not require tools or dependencies", t => {
    const f = fixture(t); rmSync(join(f.root, ".tools/gitleaks"));
    passes(f.hook("pre-push", `(delete) ${"0".repeat(40)} refs/heads/old ${f.git("rev-parse", "HEAD")}\n`));
});
test("push of a different commit is rejected", t => {
    const f = fixture(t); const old = f.git("rev-parse", "HEAD");
    f.write("README.md", "fixture\n"); f.git("add", "."); f.git("commit", "-qm", "Fixture next commit");
    fails(f.hook("pre-push", `refs/heads/old ${old} refs/heads/old ${"0".repeat(40)}\n`), /checked out/);
});
test("dirty verification inputs are rejected without stashing", t => {
    const f = fixture(t); f.write("backend/dirty.js", "export default 1;\n");
    fails(f.hook("pre-push", `HEAD ${f.git("rev-parse", "HEAD")} refs/heads/main ${"0".repeat(40)}\n`), /uncommitted/);
    assert.equal(f.git("stash", "list"), "");
});
test("missing dependencies fail with explicit installation instructions", t => {
    const f = fixture(t);
    fails(f.hook("pre-push", `HEAD ${f.git("rev-parse", "HEAD")} refs/heads/main ${"0".repeat(40)}\n`), /npm --prefix backend ci/);
});
test("runtime mismatch fails before tests", t => {
    const f = fixture(t); f.write(".nvmrc", "0.0.0\n"); f.git("add", ".nvmrc"); f.git("commit", "-qm", "Fixture wrong runtime");
    fails(f.hook("pre-push", `HEAD ${f.git("rev-parse", "HEAD")} refs/heads/main ${"0".repeat(40)}\n`), /nvm install/);
});
