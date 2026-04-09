#!/usr/bin/env node
/*
# <swiftbar.hideAbout>true</swiftbar.hideAbout>
# <swiftbar.hideRunInTerminal>true</swiftbar.hideRunInTerminal>
# <swiftbar.hideLastUpdated>true</swiftbar.hideLastUpdated>
# <swiftbar.hideDisablePlugin>true</swiftbar.hideDisablePlugin>
# <swiftbar.hideSwiftBar>true</swiftbar.hideSwiftBar>
*/

const MINUTES_IN_DAY = 24 * 60;

const parseTimeToMinutes = (timeText) => {
	const [hoursText, minutesText] = String(timeText ?? "").split(":");
	const hours = Number(hoursText);
	const minutes = Number(minutesText);

	if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
		return null;
	}

	if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
		return null;
	}

	return hours * 60 + minutes;
};

const getMinutesBetween = (startMinutes, endMinutes) => {
	const diff = endMinutes - startMinutes;
	return diff >= 0 ? diff : diff + MINUTES_IN_DAY;
};

const formatDuration = (totalMinutes) => {
	const absoluteMinutes = Math.abs(totalMinutes);
	const hours = Math.floor(absoluteMinutes / 60);
	const minutes = absoluteMinutes % 60;
	return `${hours}h ${String(minutes).padStart(2, "0")}m`;
};

const formatSignedDuration = (totalMinutes) => {
	const sign = totalMinutes > 0 ? "+" : totalMinutes < 0 ? "-" : "";
	return `${sign}${formatDuration(totalMinutes)}`;
};

const formatClockTime = (totalMinutes) => {
	const normalized = ((totalMinutes % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
	const hours = Math.floor(normalized / 60);
	const minutes = normalized % 60;
	return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const buildProgressBar = (workedMinutes, targetMinutes, slots = 10) => {
	if (targetMinutes <= 0) {
		return "▰".repeat(slots);
	}

	const ratio = Math.max(0, Math.min(1, workedMinutes / targetMinutes));
	const filledSlots = Math.round(ratio * slots);
	const emptySlots = slots - filledSlots;
	return `${"▰".repeat(filledSlots)}${"▱".repeat(emptySlots)}`;
};

const now = new Date();
const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

const startTimeText = process.env.MEOW_START_TIME ?? "09:00";
const currentTimeText = process.env.MEOW_NOW_TIME ?? nowTime;
const breakMinutes = Math.max(0, Math.round(Number(process.env.MEOW_BREAK_MINUTES ?? "60")));
const targetHours = Math.max(0, Number(process.env.MEOW_TARGET_HOURS ?? "8"));
const targetMinutes = Math.round(targetHours * 60);

const startMinutes = parseTimeToMinutes(startTimeText);
const currentMinutes = parseTimeToMinutes(currentTimeText);

if (startMinutes === null || currentMinutes === null) {
	console.log("Time format error");
	console.log("---");
	console.log('Check MEOW_START_TIME / MEOW_NOW_TIME format. Example: "09:00"');
	process.exit(0);
}

const grossWorkedMinutes = getMinutesBetween(startMinutes, currentMinutes);
const netWorkedMinutes = Math.max(0, grossWorkedMinutes - breakMinutes);
const remainingMinutes = targetMinutes - netWorkedMinutes;
const clockOutMinutes = currentMinutes + Math.max(0, remainingMinutes);
const progressBar = buildProgressBar(netWorkedMinutes, targetMinutes);
const progressPercent =
	targetMinutes > 0 ? Math.max(0, Math.round((netWorkedMinutes / targetMinutes) * 100)) : 100;

const isOvertime = remainingMinutes <= 0;
const headline = isOvertime
	? `😼 +${formatDuration(remainingMinutes)}`
	: `🐾 ${formatDuration(remainingMinutes)}`;
const headlineColor = isOvertime ? "#ff5a7e" : "#ff7aa2";
const balanceLine = isOvertime
	? `🔥 초과 근무 ${formatSignedDuration(-remainingMinutes)}`
	: `⏳ 남은 시간 ${formatDuration(remainingMinutes)}`;

console.log(`${headline} | color=${headlineColor} dropdown=false`);
console.log("---");
console.log("🐱 Meowvertime | color=#ff7aa2 size=13");
console.log(`🎯 진행률 ${progressBar} ${progressPercent}%`);
console.log(balanceLine);
console.log("---");
console.log(`🕘 시작 시각 ${startTimeText}`);
console.log(`🕒 현재 시각 ${currentTimeText}`);
console.log(`☕ 휴게 ${breakMinutes}m`);
console.log(`💼 순근무 ${formatDuration(netWorkedMinutes)}`);
console.log(`📦 총근무 ${formatDuration(grossWorkedMinutes)}`);
console.log(`🎯 목표 ${formatDuration(targetMinutes)}`);
console.log(`🏁 예상 퇴근 ${formatClockTime(clockOutMinutes)}`);
console.log("---");
console.log("🔄 새로고침 | refresh=true");
