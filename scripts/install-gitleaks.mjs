// Explicit setup only. Hooks never download tools.
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync, copyFileSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const pin = JSON.parse(readFileSync(new URL("./gitleaks.json", import.meta.url)));
const platform = `${process.platform}_${process.arch}`;
if (!pin.checksums[platform]) throw new Error(`Unsupported platform: ${platform}. Use Linux/macOS for these hooks.`);
const archive = `gitleaks_${pin.version}_${platform}.tar.gz`;
const temporary = mkdtempSync(join(tmpdir(), "helloji-gitleaks-"));
try {
    const response = await fetch(`https://github.com/gitleaks/gitleaks/releases/download/v${pin.version}/${archive}`, {
        signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error(`Gitleaks download failed: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (createHash("sha256").update(bytes).digest("hex") !== pin.checksums[platform]) {
        throw new Error("Gitleaks checksum mismatch; refusing to install.");
    }
    writeFileSync(join(temporary, archive), bytes);
    execFileSync("tar", ["-xzf", join(temporary, archive), "-C", temporary, "gitleaks"]);
    const version = execFileSync(join(temporary, "gitleaks"), ["version"], { encoding: "utf8" }).trim();
    if (version !== pin.version) throw new Error(`Unexpected Gitleaks version: ${version}`);
    mkdirSync(join(root, ".tools"), { recursive: true });
    copyFileSync(join(temporary, "gitleaks"), join(root, ".tools", "gitleaks"));
    chmodSync(join(root, ".tools", "gitleaks"), 0o755);
    console.log(`Installed verified Gitleaks ${pin.version} in .tools/gitleaks`);
} finally {
    rmSync(temporary, { recursive: true, force: true });
}
