import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pagefindEntryPath = fileURLToPath(import.meta.resolve("pagefind"));
const pagefindPackagePath = path.resolve(
	path.dirname(pagefindEntryPath),
	"..",
	"package.json",
);
const pagefindPackage = JSON.parse(
	fs.readFileSync(pagefindPackagePath, "utf8"),
);

if (
	typeof pagefindPackage.version !== "string" ||
	!/^[0-9A-Za-z][0-9A-Za-z.+-]*$/.test(pagefindPackage.version)
) {
	throw new Error("Unable to determine a safe installed Pagefind version.");
}

export const pagefindVersion = pagefindPackage.version;
export const pagefindOutputSubdir = `pagefind-${pagefindVersion}`;
export const pagefindBundlePath = `/${pagefindOutputSubdir}/`;
