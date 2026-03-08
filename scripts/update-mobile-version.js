import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.resolve(__dirname, '../package.json');
const gradlePath = path.resolve(__dirname, '../android/app/build.gradle');

console.log('📦 Updating Android version...');

// 1. Read package.json version
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const newVersion = packageJson.version;
console.log(`   New version from package.json: ${newVersion}`);

// 2. Read build.gradle
let gradleContent = fs.readFileSync(gradlePath, 'utf8');

// 3. Update versionCode (increment)
const versionCodeRegex = /versionCode\s+(\d+)/;
const codeMatch = gradleContent.match(versionCodeRegex);

if (!codeMatch) {
    console.error('❌ Error: Could not find versionCode in build.gradle');
    process.exit(1);
}

const currentVersionCode = parseInt(codeMatch[1], 10);
const newVersionCode = currentVersionCode + 1;
gradleContent = gradleContent.replace(versionCodeRegex, `versionCode ${newVersionCode}`);
console.log(`   Incremented versionCode: ${currentVersionCode} -> ${newVersionCode}`);

// 4. Update versionName
const versionNameRegex = /versionName\s+"[^"]+"/;
if (!versionNameRegex.test(gradleContent)) {
    console.error('❌ Error: Could not find versionName in build.gradle');
    process.exit(1);
}
gradleContent = gradleContent.replace(versionNameRegex, `versionName "${newVersion}"`);
console.log(`   Updated versionName: ${newVersion}`);

// 5. Write back to build.gradle
fs.writeFileSync(gradlePath, gradleContent);
console.log('✅ Updated android/app/build.gradle');

// 6. Git add the file so it's included in the version commit
try {
    // Check if we are in a git repository and if git is available
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
    
    // Add the file
    execSync(`git add "${gradlePath}"`);
    console.log('✅ Added android/app/build.gradle to git stage');
} catch (e) {
    console.warn('⚠️ Warning: Failed to git add build.gradle. If this is not a git repo, ignore this.');
}
