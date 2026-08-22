import { readFileSync, writeFileSync } from "node:fs";

const version = process.argv[2];
if (!version) {
  console.error("Usage: node scripts/extract-changelog.mjs <version>");
  process.exit(1);
}

const changelog = readFileSync("CHANGELOG.md", "utf8");
const heading = `## [${version}]`;
const start = changelog.indexOf(heading);
if (start === -1) {
  console.error(`No changelog section for ${version}`);
  process.exit(1);
}

const rest = changelog.slice(start);
const lines = rest.split(/\r?\n/);
const body = [];
for (const line of lines) {
  if (body.length > 0 && /^## \[/.test(line)) break;
  if (/^\[[^\]]+\]:/.test(line)) break;
  body.push(line);
}
const section = `${body.join("\n").trim()}\n`;
writeFileSync("release-notes.md", section);
console.log(`Wrote release-notes.md for ${version}`);
