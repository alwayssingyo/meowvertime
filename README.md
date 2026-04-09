# meowvertime

Flex API 연동 전에도 바로 쓸 수 있는 근무시간 계산기입니다.

- React 화면에서 `남은 근무시간`, `예상 퇴근 시각` 계산
- 같은 계산 로직을 사용하는 SwiftBar 플러그인 스크립트 제공
- Flex Open API 권한이 준비되면 입력 소스만 API로 교체해 확장 가능

## 1) 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:5173`을 열어 계산기를 사용할 수 있습니다.

## 2) 수동 계산기 사용법

- `Start time`: 근무 시작 시각
- `Current time`: 현재 시각 (Live on이면 자동 갱신)
- `Break minutes`: 휴게 시간(분)
- `Target hours`: 목표 근무시간(시간 단위)

출력값:
- `Remaining` 또는 `Overtime`
- `Gross/Net worked`
- `Expected clock-out`
- SwiftBar 상단 텍스트 미리보기

## 3) SwiftBar 연결

SwiftBar 설치 후 플러그인 폴더에 아래 스크립트를 배치합니다.

- `scripts/swiftbar/meowvertime.1m.js`

예시:

```bash
cp scripts/swiftbar/meowvertime.1m.js "$HOME/Library/Application Support/SwiftBar/Plugins/"
chmod +x "$HOME/Library/Application Support/SwiftBar/Plugins/meowvertime.1m.js"
```

`1m`은 1분 주기 새로고침 의미입니다.

## 4) SwiftBar 환경변수

기본값:
- `MEOW_START_TIME=09:00`
- `MEOW_BREAK_MINUTES=60`
- `MEOW_TARGET_HOURS=8`

선택값:
- `MEOW_NOW_TIME=18:10` (테스트용 고정 현재시각)

미리보기 실행:

```bash
npm run swiftbar:preview
```

## 5) 다음 단계(Flex API)

Flex Open API 토큰/권한이 준비되면 다음 순서로 확장하면 됩니다.

1. API에서 오늘 시작시각/누적근무/휴게시간 조회
2. 현재 수동 입력 상태(`startTime`, `breakMinutes`, `targetHours`)를 API 응답으로 대체
3. SwiftBar 스크립트도 동일 데이터 소스 사용하도록 연결
