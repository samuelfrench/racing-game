import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const workflowDirectory = '.github/workflows';

const minimumActionMajors = new Map([
  ['actions/checkout', 6],
  ['actions/setup-node', 6],
  ['actions/configure-pages', 6],
  ['actions/upload-pages-artifact', 5],
  ['actions/deploy-pages', 5],
]);

const workflowFiles = readdirSync(workflowDirectory)
  .filter((fileName) => fileName.endsWith('.yml') || fileName.endsWith('.yaml'))
  .map((fileName) => join(workflowDirectory, fileName));

const failures = [];

for (const workflowFile of workflowFiles) {
  const source = readFileSync(workflowFile, 'utf8');

  if (source.includes('FORCE_JAVASCRIPT_ACTIONS_TO_NODE24')) {
    failures.push(`${workflowFile}: remove FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 after action majors are Node24-ready`);
  }

  for (const match of source.matchAll(/uses:\s*(actions\/[A-Za-z0-9_.-]+)@(v(\d+))/g)) {
    const [, actionName, versionLabel, majorText] = match;
    const minimumMajor = minimumActionMajors.get(actionName);
    if (minimumMajor === undefined) {
      continue;
    }

    const actualMajor = Number.parseInt(majorText, 10);
    if (actualMajor < minimumMajor) {
      failures.push(`${workflowFile}: ${actionName}@${versionLabel} must be >= v${minimumMajor}`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Verified ${workflowFiles.length} workflow file(s) use Node24-ready GitHub Action majors.`);
