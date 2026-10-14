import tailwind from "bun-plugin-tailwind";
import { rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

// bun run build.ts [--outdir <dir>] [--no-sourcemap]
const { values: args } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    outdir: { type: "string", default: "dist" },
    "no-sourcemap": { type: "boolean", default: false },
  },
});

const outdir = path.resolve(args.outdir);
// The output directory is wiped before every build, so refuse anything that holds more than a build.
const contains = (dir: string, p: string) => {
  const rel = path.relative(dir, p);
  return rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
};
if ([process.cwd(), os.homedir()].some((p) => contains(outdir, p))) {
  console.error(`Refusing to build into ${outdir}: it would wipe the project or your home directory.`);
  process.exit(1);
}
await rm(outdir, { recursive: true, force: true });

const entrypoints = [...new Bun.Glob("src/**/*.html").scanSync()];

const result = await Bun.build({
  entrypoints,
  outdir,
  plugins: [tailwind],
  minify: true,
  target: "browser",
  sourcemap: args["no-sourcemap"] ? "none" : "linked",
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
});

for (const output of result.outputs) {
  console.log(` ${path.relative(process.cwd(), output.path)}  ${(output.size / 1024).toFixed(1)} KB`);
}
