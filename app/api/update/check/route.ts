import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PROJECT_DIR = "/opt/printer-ui";
const BRANCH = process.env.UPDATE_BRANCH || "main";

function runGit(args: string[]) {
  return execFileAsync("git", args, { cwd: PROJECT_DIR, timeout: 15_000 });
}

export async function GET() {
  try {
    await runGit(["fetch", "--all", "--prune"]);

    const head = (await runGit(["rev-parse", "HEAD"])).stdout.trim();
    const remote = (await runGit(["rev-parse", `origin/${BRANCH}`])).stdout.trim();

    // behind count: HEAD..origin/BRANCH
    const behindStr = (await runGit(["rev-list", "--count", `HEAD..origin/${BRANCH}`])).stdout.trim();
    const behind = Number(behindStr || "0");

    let commits: any[] = [];
    let files: string[] = [];

    if (behind > 0) {
      // commits list (max 50)
      const logOut = (await runGit([
        "log",
        "--no-decorate",
        "--date=short",
        "--pretty=format:%H|%ad|%an|%s",
        `HEAD..origin/${BRANCH}`,
        "-n",
        "50",
      ])).stdout.trim();

      commits = logOut
        ? logOut.split("\n").map((line) => {
            const [sha, date, author, subject] = line.split("|");
            return { sha, date, author, subject };
          })
        : [];

      // changed files in that range (optional)
      const filesOut = (await runGit(["diff", "--name-only", `HEAD..origin/${BRANCH}`])).stdout.trim();
      files = filesOut ? filesOut.split("\n").filter(Boolean) : [];
    }

    return NextResponse.json({
      ok: true,
      branch: BRANCH,
      head,
      remote,
      behind,
      commits,
      files,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "check failed" },
      { status: 500 }
    );
  }
}
