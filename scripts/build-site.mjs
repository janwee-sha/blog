import { spawnSync } from "node:child_process";
import {
	pagefindBundlePath,
	pagefindOutputSubdir,
	pagefindVersion,
} from "./pagefind-config.mjs";

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function run(args, env = process.env) {
	const result = spawnSync(pnpmCommand, args, {
		env,
		stdio: "inherit",
	});

	if (result.error) throw result.error;
	if (result.status !== 0) process.exit(result.status ?? 1);
}

run(["exec", "astro", "build"], {
	...process.env,
	PUBLIC_PAGEFIND_BUNDLE_PATH: pagefindBundlePath,
});
run([
	"exec",
	"pagefind",
	"--site",
	"dist",
	"--output-subdir",
	pagefindOutputSubdir,
]);

console.log(
	`Built Pagefind ${pagefindVersion} search bundle at dist/${pagefindOutputSubdir}/.`,
);
