import { execSync } from 'child_process';

const steps = [
  { name: 'Lint',      cmd: 'npm run lint'        },
  { name: 'Typecheck', cmd: 'npm run typecheck'    },
  { name: 'Test',      cmd: 'npx vitest run'       },
  { name: 'Build',     cmd: 'npm run build'        },
];

let failed = false;

for (const step of steps) {
  console.log(`\n▶ ${step.name}`);
  console.log('─'.repeat(40));
  try {
    execSync(step.cmd, { stdio: 'inherit' });
    console.log(`✅ ${step.name} passed`);
  } catch {
    console.error(`❌ ${step.name} failed`);
    failed = true;
    break;
  }
}

if (failed) {
  process.exit(1);
} else {
  console.log('\n✅ All CI checks passed');
}
