import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
const mode = process.argv[2];
const fail = (message) => { throw new Error(message); };
const output = (command, args, options = {}) => execFileSync(command, args, { encoding: "utf8", ...options }).trim();
const git = (...args) => args.includes("-z")
    ? execFileSync("git", args, { encoding: "utf8" })
    : output("git", args);
function run(command, args, options = {}) {
    const result = spawnSync(command, args, { stdio: "inherit", ...options });
    if (result.error) fail(`${command}: ${result.error.message}`);
    if (result.status !== 0) fail(`${command} ${args.join(" ")} failed (${result.status ?? result.signal}).`);
}
function runtime() {
    const expected = readFileSync(".nvmrc", "utf8").trim();
    if (process.versions.node !== expected) fail(`Node ${expected} required; found ${process.versions.node}. Run nvm install && nvm use.`);
    const expectedNpm = JSON.parse(readFileSync("backend/package.json")).packageManager.split("@")[1];
    if (output("npm", ["--version"]) !== expectedNpm) fail(`npm ${expectedNpm} required. Run nvm use (use the npm bundled with the pinned Node release).`);
}
function privateFile(path) {
    const name = basename(path).toLowerCase();
    if (/\.(example|sample|template)$/.test(name)) return false;
    return name === ".env" || name.startsWith(".env.") ||
        /\.(key|pem|p12|pfx|jks|keystore)$/.test(name) || /^id_(rsa|dsa|ecdsa|ed25519)(?:$|\.)/.test(name) && !name.endsWith(".pub");
}
function checkPaths(paths) {
    const rejected = paths.filter(privateFile);
    if (rejected.length) fail(`Private environment/key files must not be committed:\n${rejected.map(p => JSON.stringify(p)).join("\n")}\nUse a secret-free .example/.sample/.template file instead.`);
}
function secrets(staged) {
    const pin = JSON.parse(readFileSync("scripts/gitleaks.json"));
    const binary = join(root, ".tools/gitleaks");
    if (!existsSync(binary)) fail("Gitleaks is missing. Run node scripts/install-gitleaks.mjs once (requires network). Hooks never install tools.");
    if (output(binary, ["version"]) !== pin.version) fail(`Gitleaks ${pin.version} required. Run node scripts/install-gitleaks.mjs.`);
    run(binary, ["git", "--redact", "--no-banner", "--config", ".gitleaks.toml", ...(staged ? ["--pre-commit", "--staged"] : ["--log-opts=--all"]), "."]);
}
function syntax(directory = "backend") {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (["node_modules", ".git", "coverage"].includes(entry.name)) continue;
        const path = join(directory, entry.name);
        if (entry.isDirectory()) syntax(path);
        else if (/\.[cm]?js$/.test(entry.name)) run(process.execPath, ["--check", path]);
    }
}
async function verify() {
    runtime();
    for (const part of ["backend", "frontend"]) {
        if (!existsSync(`${part}/node_modules/.bin/vitest`)) fail(`Missing ${part} dependencies. Run npm --prefix ${part} ci --no-audit before pushing.`);
        const lock = JSON.parse(readFileSync(`${part}/package-lock.json`));
        const installedPath = `${part}/node_modules/.package-lock.json`;
        if (!existsSync(installedPath)) fail(`Missing ${part} install metadata. Run npm --prefix ${part} ci --no-audit.`);
        const installed = JSON.parse(readFileSync(installedPath));
        for (const [path, entry] of Object.entries(installed.packages)) {
            if (!lock.packages[path] || entry.version !== lock.packages[path].version) {
                fail(`Stale ${part} dependencies (${path}). Run npm --prefix ${part} ci --no-audit.`);
            }
        }
        const dependencies = spawnSync("npm", ["ls", "--all", "--omit=optional"], { cwd: join(root, part), encoding: "utf8" });
        if (dependencies.status !== 0) fail(`Invalid/incomplete ${part} dependencies. Run npm --prefix ${part} ci --no-audit.\n${dependencies.stderr || dependencies.error?.message || ""}`);
    }
    // Resolve an existing binary before running any tests. Never download in a push hook.
    process.env.MONGOMS_RUNTIME_DOWNLOAD = "false";
    process.chdir(join(root, "backend"));
    try {
        const require = createRequire(join(root, "backend/package.json"));
        const { MongoBinary } = require("mongodb-memory-server-core");
        // npm/Vitest can resolve cache directories differently from this process.
        // Reuse exactly the existing binary that passed the prerequisite check.
        process.env.MONGOMS_SYSTEM_BINARY = await MongoBinary.getPath();
    } catch {
        fail("Test MongoDB binary is missing/unusable. Prepare it explicitly: (cd backend && node node_modules/mongodb-memory-server/postinstall.js). Then retry. No binary was downloaded by this gate.");
    } finally { process.chdir(root); }
    syntax();
    run("npm", ["--prefix", "backend", "test"]);
    run("npm", ["--prefix", "frontend", "test"]);
    run("npm", ["--prefix", "frontend", "run", "build"]);
}

try {
    if (mode === "pre-commit") {
        run("git", ["diff", "--cached", "--check"]);
        checkPaths(git("diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z").split("\0").filter(Boolean));
        secrets(true);
    } else if (mode === "pre-push") {
        const refs = readFileSync(0, "utf8").trim().split("\n").filter(Boolean).map(line => line.split(/\s+/));
        const updates = refs.filter(([, sha]) => !/^0+$/.test(sha));
        if (updates.length) {
            const head = git("rev-parse", "HEAD");
            for (const [, sha] of updates) {
                if (git("rev-parse", `${sha}^{commit}`) !== head) fail("Push verification requires the pushed commit to be checked out. Check out that commit and push it separately.");
            }
            // Never stash or alter user work to obtain a passing check.
            if (git("status", "--porcelain", "--untracked-files=all", "--", "backend", "frontend", "scripts", ".githooks", ".nvmrc", ".gitleaks.toml")) {
                fail("Commit or temporarily move uncommitted verification inputs before pushing. To check current work without pushing: node scripts/quality-gates.mjs verify.");
            }
            await verify();
        }
    } else if (mode === "verify") await verify();
    else if (mode === "runtime") runtime();
    else if (mode === "syntax") syntax();
    else if (mode === "secrets") {
        checkPaths(git("ls-files", "-z").split("\0").filter(Boolean));
        secrets(false);
    } else fail("Usage: node scripts/quality-gates.mjs pre-commit|pre-push|verify|runtime|syntax|secrets");
} catch (error) {
    console.error(`Quality gate: ${error.message}`);
    process.exitCode = 1;
}
