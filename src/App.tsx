import { useEffect, useMemo, useState } from "react";
import "./App.css";

const DEFAULT_START_TIME = "09:00";
const DEFAULT_BREAK_MINUTES = 60;
const DEFAULT_TARGET_HOURS = 8;
const MINUTES_IN_DAY = 24 * 60;

const getCurrentTimeString = (): string => {
	const now = new Date();
	const hours = String(now.getHours()).padStart(2, "0");
	const minutes = String(now.getMinutes()).padStart(2, "0");

	return `${hours}:${minutes}`;
};

const parseTimeToMinutes = (timeText: string): number | null => {
	const [hoursText, minutesText] = timeText.split(":");
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

const getMinutesBetween = (startMinutes: number, endMinutes: number): number => {
	const diff = endMinutes - startMinutes;

	if (diff >= 0) {
		return diff;
	}

	return diff + MINUTES_IN_DAY;
};

const formatDuration = (totalMinutes: number): string => {
	const absoluteMinutes = Math.abs(totalMinutes);
	const hours = Math.floor(absoluteMinutes / 60);
	const minutes = absoluteMinutes % 60;

	return `${hours}h ${String(minutes).padStart(2, "0")}m`;
};

const formatClockTime = (totalMinutes: number): string => {
	const normalized = ((totalMinutes % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
	const hours = Math.floor(normalized / 60);
	const minutes = normalized % 60;

	return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

type CalculationResult = {
	clockOutTime: string;
	grossWorkedMinutes: number;
	menuBarText: string;
	netWorkedMinutes: number;
	progressRatio: number;
	remainingMinutes: number;
	targetMinutes: number;
};

function App() {
	const [startTime, setStartTime] = useState(DEFAULT_START_TIME);
	const [currentTime, setCurrentTime] = useState(getCurrentTimeString);
	const [useLiveTime, setUseLiveTime] = useState(true);
	const [breakMinutes, setBreakMinutes] = useState(DEFAULT_BREAK_MINUTES);
	const [targetHours, setTargetHours] = useState(DEFAULT_TARGET_HOURS);

	useEffect(() => {
		if (!useLiveTime) {
			return undefined;
		}

		const syncCurrentTime = () => {
			setCurrentTime(getCurrentTimeString());
		};

		const timeoutId = window.setTimeout(syncCurrentTime, 0);
		const intervalId = window.setInterval(syncCurrentTime, 60_000);

		return () => {
			window.clearTimeout(timeoutId);
			window.clearInterval(intervalId);
		};
	}, [useLiveTime]);

	const calculation = useMemo<CalculationResult | null>(() => {
		const startMinutes = parseTimeToMinutes(startTime);
		const nowMinutes = parseTimeToMinutes(currentTime);

		if (startMinutes === null || nowMinutes === null) {
			return null;
		}

		const validBreakMinutes = Math.max(0, Math.round(breakMinutes));
		const validTargetMinutes = Math.max(0, Math.round(targetHours * 60));
		const grossWorkedMinutes = getMinutesBetween(startMinutes, nowMinutes);
		const netWorkedMinutes = Math.max(0, grossWorkedMinutes - validBreakMinutes);
		const remainingMinutes = validTargetMinutes - netWorkedMinutes;
		const expectedClockOutMinutes = nowMinutes + Math.max(0, remainingMinutes);
		const progressRatio =
			validTargetMinutes === 0 ? 1 : Math.min(netWorkedMinutes / validTargetMinutes, 1);
		const menuBarText =
			remainingMinutes > 0
				? `Left ${formatDuration(remainingMinutes)}`
				: `Overtime ${formatDuration(remainingMinutes)}`;

		return {
			clockOutTime: formatClockTime(expectedClockOutMinutes),
			grossWorkedMinutes,
			menuBarText,
			netWorkedMinutes,
			progressRatio,
			remainingMinutes,
			targetMinutes: validTargetMinutes,
		};
	}, [breakMinutes, currentTime, startTime, targetHours]);

	return (
		<main className="app">
			<header className="app__hero">
				<p className="app__eyebrow">React fallback calculator first</p>
				<h1>meowvertime</h1>
				<p className="app__description">
					Flex API 연동이 막혀도 바로 쓸 수 있게, 수동 입력으로 남은 근무시간과 예상 퇴근시각을
					계산합니다.
				</p>
			</header>

			<section className="panel">
				<div className="panel__titleRow">
					<h2>Calculator</h2>
					<label className="toggle">
						<input
							checked={useLiveTime}
							onChange={(event) => {
								setUseLiveTime(event.target.checked);
							}}
							type="checkbox"
						/>
						Live now time
					</label>
				</div>

				<div className="formGrid">
					<label className="field">
						<span>Start time</span>
						<input
							onChange={(event) => {
								setStartTime(event.target.value);
							}}
							type="time"
							value={startTime}
						/>
					</label>

					<label className="field">
						<span>Current time</span>
						<input
							disabled={useLiveTime}
							onChange={(event) => {
								setCurrentTime(event.target.value);
							}}
							type="time"
							value={currentTime}
						/>
					</label>

					<label className="field">
						<span>Break minutes</span>
						<input
							min={0}
							onChange={(event) => {
								const nextValue = Number(event.target.value);
								setBreakMinutes(Number.isNaN(nextValue) ? 0 : nextValue);
							}}
							type="number"
							value={breakMinutes}
						/>
					</label>

					<label className="field">
						<span>Target hours</span>
						<input
							min={0}
							onChange={(event) => {
								const nextValue = Number(event.target.value);
								setTargetHours(Number.isNaN(nextValue) ? 0 : nextValue);
							}}
							step={0.5}
							type="number"
							value={targetHours}
						/>
					</label>
				</div>
			</section>

			{calculation ? (
				<section className="panel panel--result">
					<div className="resultHeadline">
						<p>Remaining</p>
						<strong>
							{calculation.remainingMinutes > 0
								? formatDuration(calculation.remainingMinutes)
								: `Overtime ${formatDuration(calculation.remainingMinutes)}`}
						</strong>
					</div>

					<div className="progress">
						<div
							className="progress__bar"
							style={{ width: `${Math.max(0, calculation.progressRatio * 100)}%` }}
						/>
					</div>

					<div className="statsGrid">
						<p>
							<span>Gross worked</span>
							<strong>{formatDuration(calculation.grossWorkedMinutes)}</strong>
						</p>
						<p>
							<span>Net worked</span>
							<strong>{formatDuration(calculation.netWorkedMinutes)}</strong>
						</p>
						<p>
							<span>Target</span>
							<strong>{formatDuration(calculation.targetMinutes)}</strong>
						</p>
						<p>
							<span>Expected clock-out</span>
							<strong>{calculation.clockOutTime}</strong>
						</p>
					</div>

					<div className="menuPreview">
						<p>SwiftBar top-line preview</p>
						<code>{calculation.menuBarText}</code>
					</div>
				</section>
			) : (
				<section className="panel panel--result">
					<p className="errorText">시간 입력 형식이 올바르지 않습니다. HH:MM 형식으로 입력해 주세요.</p>
				</section>
			)}

			<section className="panel panel--note">
				<h2>Flex API next</h2>
				<p>
					다음 단계에서 Flex Open API 토큰과 권한이 준비되면, 현재 계산 로직의 입력값을 수동 입력
					대신 API 응답값으로 바꿔서 그대로 확장할 수 있습니다.
				</p>
			</section>
		</main>
	);
}

export default App;
