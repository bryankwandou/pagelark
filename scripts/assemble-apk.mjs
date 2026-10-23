// Runs Gradle assembleDebug in android/ and copies the APK to release/pagelark-debug.apk.
// Used by `npm run apk` after the web build and `cap sync android`.
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, statSync } from 'node:fs';

const win = process.platform === 'win32';
const r = spawnSync(win ? '.\\gradlew.bat' : './gradlew', ['assembleDebug'], { cwd: 'android', stdio: 'inherit', shell: win });
if (r.status !== 0) process.exit(r.status ?? 1);

const src = 'android/app/build/outputs/apk/debug/app-debug.apk';
mkdirSync('release', { recursive: true });
copyFileSync(src, 'release/pagelark-debug.apk');
console.log(`release/pagelark-debug.apk  ${(statSync(src).size / 1048576).toFixed(1)} MB`);
