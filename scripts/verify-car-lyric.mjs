#!/usr/bin/env node
/**
 * 蓝牙车载歌词 · 真机验证脚本
 *
 * 模拟器没有蓝牙协议栈，AVRCP 链路只能真机验证。用法：
 *   1. 手机通过 USB 连上电脑并开启 USB 调试（车机同理）
 *   2. adb logcat -c          清空日志
 *   3. 打开 Otter Music 播一首有歌词的歌，并在设置里打开「车载歌词」
 *   4. npm run verify:car-lyric
 *
 * 脚本按顺序检查四件事，并把需要人工判断的地方标出来：
 *   1. adb 与设备是否就绪
 *   2. MediaSession 是否活着、TITLE 是否已经变成歌词行
 *   3. 蓝牙侧 AVRCP 是否连上（车机是否在控制这条会话）
 *   4. logcat 里最近的 AVRCP 元数据事件
 *
 * 注意：脚本只能证明「手机侧动作正确」，最终车机屏幕是否显示歌词取决于车机固件。
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const APP_ID = "com.otterhub.music";

const ADB_CANDIDATES = [
  process.env.ANDROID_HOME &&
    path.join(process.env.ANDROID_HOME, "platform-tools", "adb.exe"),
  process.env.ANDROID_SDK_ROOT &&
    path.join(process.env.ANDROID_SDK_ROOT, "platform-tools", "adb.exe"),
  process.env.LOCALAPPDATA &&
    path.join(
      process.env.LOCALAPPDATA,
      "Android",
      "Sdk",
      "platform-tools",
      "adb.exe"
    ),
  process.env.HOME &&
    path.join(process.env.HOME, "Library/Android/sdk/platform-tools/adb"),
  "/usr/local/bin/adb",
  "/usr/bin/adb",
].filter(Boolean);

function resolveAdb() {
  for (const candidate of ADB_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }

  // 最后尝试 PATH 里的 adb
  try {
    execFileSync("adb", ["version"], { stdio: "ignore" });
    return "adb";
  } catch {
    return null;
  }
}

const ADB = resolveAdb();

function adb(args, { allowFailure = false } = {}) {
  try {
    return execFileSync(ADB, args, {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      // 压掉 adb 守护进程自己的 stderr 噪音（如 "daemon not running"）
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch (error) {
    if (allowFailure) return "";
    throw error;
  }
}

function line(char = "─") {
  return char.repeat(64);
}

function section(title) {
  console.log(`\n${line()}\n${title}\n${line()}`);
}

function bullet(text) {
  console.log(`  ${text}`);
}

function pickLines(text, pattern, limit) {
  return text
    .split(/\r?\n/)
    .filter((l) => pattern.test(l))
    .slice(0, limit);
}

function printLines(lines, emptyHint) {
  if (lines.length === 0) {
    bullet(`（没有匹配到内容）${emptyHint ?? ""}`);
    return;
  }
  for (const l of lines) bullet(l.trim());
}

function main() {
  console.log("Otter Music · 蓝牙车载歌词真机验证");
  console.log(`应用包名：${APP_ID}`);

  /* ---------------- 1. 设备 ---------------- */
  section("[1/4] adb 与设备");

  if (!ADB) {
    bullet("找不到 adb。请安装 Android SDK Platform-Tools，");
    bullet("或设置环境变量 ANDROID_HOME / LOCALAPPDATA 指向 SDK。");
    process.exitCode = 1;
    return;
  }

  bullet(`adb：${ADB}`);

  const devices = adb(["devices", "-l"], { allowFailure: true });
  const attached = devices
    .split(/\r?\n/)
    .slice(1)
    .filter((l) => l.trim() && !l.includes("offline"));

  if (attached.length === 0) {
    console.log("");
    bullet("没有检测到设备。");
    bullet("请用 USB 连上手机并开启 USB 调试，然后重跑本脚本。");
    bullet("（模拟器验证不了 AVRCP，必须是真机）");
    process.exitCode = 1;
    return;
  }

  for (const d of attached) bullet(d.trim());

  /* ---------------- 2. MediaSession ---------------- */
  section("[2/4] MediaSession 状态（手机侧是否已把歌词写进 TITLE）");

  const dump = adb(["shell", "dumpsys", "media_session"], {
    allowFailure: true,
  });

  if (!dump.trim()) {
    bullet("dumpsys 没有返回内容，跳过。");
  } else {
    const owned = pickLines(
      dump,
      new RegExp(`${APP_ID.replace(/\./g, "\\.")}|Otter`, "i"),
      6
    );
    printLines(owned, " → 会话还没起来，先在应用里播放一首歌");

    const metadata = pickLines(dump, /metadata|description=/i, 8);
    printLines(metadata);

    console.log("");
    bullet("看这里：metadata 的 title 应当等于**当前那句歌词**；");
    bullet("如果 title 是歌名，说明没有覆写——检查设置里的「车载歌词」开关；");
    bullet("如果是空的，说明 MediaSession 没建起来，问题在链路而不是歌词。");
  }

  /* ---------------- 3. 蓝牙 / AVRCP ---------------- */
  section("[3/4] 蓝牙 AVRCP 连接状态");

  const bt = adb(["shell", "dumpsys", "bluetooth_manager"], {
    allowFailure: true,
  });

  if (!bt.trim()) {
    bullet("dumpsys bluetooth_manager 没有返回内容（部分机型需要更高权限）。");
  } else {
    const avrcp = pickLines(bt, /avrcp|a2dp.*connected|Connected devices/i, 12);
    printLines(avrcp, " → 看起来没有蓝牙连接，先在系统里连上车机");

    console.log("");
    bullet("需要看到车机作为 connected device 出现，且 AVRCP 为已连接；");
    bullet("只有 A2DP 连上、AVRCP 没连的话，车机拿不到任何元数据。");
  }

  /* ---------------- 4. logcat ---------------- */
  section("[4/4] logcat 中最近的 AVRCP 事件");

  const log = adb(["logcat", "-d", "-t", "2000"], { allowFailure: true });
  const hits = pickLines(log, /avrcp|蓝牙歌词|setCarLyric/i, 25);

  if (hits.length === 0) {
    bullet("没抓到 AVRCP 日志。多为日志已经滚动掉了，按下面重来一次：");
    bullet("  1) adb logcat -c");
    bullet("  2) 在应用里播一首有歌词的歌，等它唱过两三句");
    bullet("  3) npm run verify:car-lyric");
  } else {
    for (const h of hits) bullet(h.trim());
  }

  section("结论怎么读");
  bullet(
    "手机侧全部正确 + 车机不显示歌词 → 车机固件不认 TITLE 更新，属预期内风险；"
  );
  bullet("手机侧 TITLE 没变成歌词 → 先查设置开关，再查 useCarLyric 是否在跑；");
  bullet("AVRCP 没连上 → 是蓝牙链路问题，与歌词无关，先解决它。");
  console.log("");
}

main();
