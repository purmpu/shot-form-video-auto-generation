const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, LevelFormat, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber,
} = require("docx");
const fs = require("fs");

// ── 공통 색상 ──────────────────────────────────────────────────
const BLUE     = "1F4E79";
const LBLUE    = "2E75B6";
const ACCENT   = "D5E8F0";   // 표 헤더 배경
const CODEBG   = "F2F2F2";   // 코드 블록 배경
const GRAY     = "595959";
const BORDER_C = "CCCCCC";

// ── 테두리 헬퍼 ──────────────────────────────────────────────
const border  = (color = BORDER_C) => ({ style: BorderStyle.SINGLE, size: 1, color });
const borders = (color = BORDER_C) => ({ top: border(color), bottom: border(color), left: border(color), right: border(color) });

// ── 기본 여백 ────────────────────────────────────────────────
const PAGE_W = 12240, PAGE_H = 15840, MARGIN = 1440, CONTENT_W = PAGE_W - MARGIN * 2;

// ── 단락 헬퍼 ────────────────────────────────────────────────
function normal(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, font: "Malgun Gothic", size: 22, ...opts })],
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { after: 80 },
    children: [new TextRun({ text, font: "Malgun Gothic", size: 22 })],
  });
}

function code(text) {
  return new Paragraph({
    spacing: { before: 40, after: 40 },
    shading: { fill: CODEBG, type: ShadingType.CLEAR },
    indent: { left: 360, right: 360 },
    children: [new TextRun({ text, font: "Courier New", size: 20, color: "1A1A1A" })],
  });
}

function spacer() {
  return new Paragraph({ spacing: { after: 120 }, children: [] });
}

function sectionLine() {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LBLUE, space: 1 } },
    children: [],
  });
}

// ── 표 헬퍼 ─────────────────────────────────────────────────
function cell(text, widthDxa, isHeader = false) {
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    borders: borders(BORDER_C),
    shading: isHeader ? { fill: ACCENT, type: ShadingType.CLEAR } : { fill: "FFFFFF", type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      children: [new TextRun({ text, font: "Malgun Gothic", size: 20, bold: isHeader, color: isHeader ? BLUE : "1A1A1A" })],
    })],
  });
}

function twoColTable(rows) {
  const COL1 = Math.round(CONTENT_W * 0.42);
  const COL2 = CONTENT_W - COL1;
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [COL1, COL2],
    rows: rows.map((r, i) => new TableRow({
      children: [cell(r[0], COL1, i === 0), cell(r[1], COL2, i === 0)],
    })),
  });
}

// ══════════════════════════════════════════════════════════════
//  문서 내용 조립
// ══════════════════════════════════════════════════════════════
const children = [];

// ── 표지 제목 ─────────────────────────────────────────────────
children.push(
  new Paragraph({ spacing: { before: 1200, after: 400 }, children: [
    new TextRun({ text: "AI 숏폼 영상 생성 파이프라인", font: "Malgun Gothic", size: 56, bold: true, color: BLUE }),
  ], alignment: AlignmentType.CENTER }),
  new Paragraph({ spacing: { after: 200 }, children: [
    new TextRun({ text: "전공자 대상 기술 설명", font: "Malgun Gothic", size: 36, color: GRAY }),
  ], alignment: AlignmentType.CENTER }),
  new Paragraph({ spacing: { after: 160 }, children: [
    new TextRun({ text: "천라쿵푸 마라탕 매장 홍보 영상 자동화 파이프라인 분석", font: "Malgun Gothic", size: 24, color: GRAY }),
  ], alignment: AlignmentType.CENTER }),
  sectionLine(),
  spacer(),
);

// ── 0. 전체 아키텍처 ──────────────────────────────────────────
children.push(
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "전체 아키텍처", font: "Malgun Gothic" })] }),
  normal("이 프로젝트는 천라쿵푸 마라탕 매장의 AI 숏폼 홍보 영상 자동 생성 파이프라인이다."),
  spacer(),
  new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "전체 처리 흐름", font: "Malgun Gothic" })] }),
);
[
  "[1단계]  원본 MOV 영상 (9장면) 입력",
  "[2단계]  Gemini Vision → 각 장면 프레임 캡처 후 JSON 반환 (장면 분석)",
  "[3단계]  LLM (Qwen 등) → 자막·나레이션 대본 생성 (9장면, 한국어)",
  "[4단계]  TTS (OpenRouter Grok / Edge TTS) → 나레이션 MP3 생성",
  "[5단계]  ffmpeg → 장면별 클립 렌더링 (자막 오버레이 + 페이드)",
  "[6단계]  ffmpeg → 9장면 concat → BGM 믹싱 → 최종 MP4 출력",
].forEach(t => children.push(bullet(t)));
children.push(spacer());

children.push(
  new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "모듈 의존 관계", font: "Malgun Gothic" })] }),
  twoColTable([
    ["레이어", "파일 / 역할"],
    ["실행 진입점", "run_gemini_qwen_single_promo.py\nrerender_single_from_summary.py\nrun_role_video_pipeline.py\ninspect_vision_models.py"],
    ["공통 비즈니스 로직", "gemini_script_compare_common.py\n(Vision 분석·TTS·렌더링·BGM 믹싱 모두 포함)"],
    ["유틸리티 계층", "inspect_vision_models.py\n(API 키·ffmpeg·base64·JSON 파싱)\nrun_role_video_pipeline.py (URL 상수)"],
    ["외부 의존", "OpenRouter API (Gemini Vision / Qwen / Grok TTS)\nffmpeg.exe (렌더링·concat·BGM 믹싱)\nedge-tts (로컬 MS TTS)"],
  ]),
  spacer(),
);

// ── 1. 모듈 계층 ──────────────────────────────────────────────
children.push(
  sectionLine(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "1. 모듈 계층 & 의존 관계", font: "Malgun Gothic" })] }),
  new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "1-1. inspect_vision_models.py — 최하위 유틸리티 계층", font: "Malgun Gothic" })] }),
  code("ROOT = Path(__file__).resolve().parent"),
);
["__file__은 현재 .py 파일의 절대 경로",
 ".resolve()로 심볼릭 링크까지 풀어서 실제 경로 획득",
 ".parent로 프로젝트 루트 디렉터리 기준점 확보",
 "이후 모든 상대 경로는 ROOT / 로 접합 → 하드코딩 없이 이식성 확보",
].forEach(t => children.push(bullet(t)));
children.push(
  spacer(),
  code("ENV_PATH = ROOT / \".env.openrouter\""),
);
["`.env` 파일을 표준 라이브러리만으로 파싱 (dotenv 라이브러리 없음)",
 "python-dotenv 대신 직접 파싱하는 이유: 의존성 최소화, 보안 민감 파일을 코드로 명확히 통제",
].forEach(t => children.push(bullet(t)));
children.push(spacer());

// ── 2. HTTP 통신 계층 ─────────────────────────────────────────
children.push(
  sectionLine(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "2. HTTP 통신 계층 — 표준 라이브러리로 구현", font: "Malgun Gothic" })] }),
  new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "load_api_key() 상세 분석", font: "Malgun Gothic" })] }),
  normal("우선순위: 환경변수 > .env 파일  (12-factor app 원칙)"),
);
["split(\"=\", 1): VALUE=abc=def 같은 경우에도 올바르게 파싱 (maxsplit=1로 값에 = 포함 허용)",
 "\"YOUR_OPENROUTER_API_KEY_HERE\" in key 감지: .env.example 복사 후 키 미입력 실수 방어",
 "require_openrouter_key()는 추가로 sk-proj- 프리픽스 감지 → OpenAI 키 혼용 실수 방지",
].forEach(t => children.push(bullet(t)));
children.push(spacer());

children.push(
  new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "find_ffmpeg_tools() 상세 분석", font: "Malgun Gothic" })] }),
  normal("탐색 순서: ROOT/abc/ffmpeg/bin → ROOT/ffmpeg/bin → 시스템 PATH fallback"),
);
["프로젝트 내 번들 ffmpeg 우선 탐색 → 없으면 시스템 PATH fallback",
 "Windows에서 ffmpeg을 프로젝트에 포함시켜 배포 환경 의존성을 제거하는 패턴",
].forEach(t => children.push(bullet(t)));
children.push(spacer());

children.push(
  new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "왜 requests 라이브러리를 안 쓰는가?", font: "Malgun Gothic" })] }),
);
["requests는 서드파티 패키지 → 설치 필요",
 "urllib은 Python 표준 라이브러리 → 의존성 제로",
 "이 프로젝트의 HTTP 패턴은 단순 POST/GET이므로 표준 라이브러리로 충분",
].forEach(t => children.push(bullet(t)));
children.push(spacer(), normal("http_json() 주요 포인트"));
["ensure_ascii=False: 한글이 \\uXXXX 이스케이프 없이 UTF-8 그대로 전송",
 "timeout=180: Vision 모델 응답이 느릴 때 소켓이 무한 블로킹되는 것 방지",
 "HTTPError 캐치 후 .read()로 에러 바디까지 포함해 RuntimeError 재발생 → 디버깅 용이",
].forEach(t => children.push(bullet(t)));
children.push(spacer());

// ── 3. 멀티모달 Vision 호출 ───────────────────────────────────
children.push(
  sectionLine(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "3. 멀티모달 Vision 호출", font: "Malgun Gothic" })] }),
  new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "OpenRouter Chat Completions API의 Vision 메시지 구조", font: "Malgun Gothic" })] }),
  normal("content가 리스트일 때 텍스트+이미지 혼합이 가능하다."),
  code("{\"role\": \"user\", \"content\": ["),
  code("  {\"type\": \"text\", \"text\": vision_prompt()},"),
  code("  {\"type\": \"image_url\", \"image_url\": {\"url\": encode_media_data_url(frame_path)}}"),
  code("]}"),
  normal("단순 문자열 content는 텍스트 전용 메시지이다."),
  spacer(),
  new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "encode_media_data_url() — Base64 Data URL 인코딩", font: "Malgun Gothic" })] }),
  normal("왜 외부 URL이 아닌 Data URL인가?"),
);
["로컬 파일이라 외부에서 접근 불가 → 파일 전체를 Base64로 직렬화해서 HTTP body에 포함",
 "mimetypes.guess_type(\"scene_01.jpg\") → \"image/jpeg\" 자동 감지",
 "path.read_bytes() → 이진 데이터 그대로 읽기",
 "base64.b64encode(...).decode(\"ascii\") → bytes → ASCII 문자열 (JSON에 포함 가능)",
 "Data URL 형식: data:<MIME>;base64,<BASE64_DATA>",
].forEach(t => children.push(bullet(t)));
children.push(spacer());

// ── 4. extract_frame ──────────────────────────────────────────
children.push(
  sectionLine(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "4. extract_frame() — ffmpeg 프레임 추출", font: "Malgun Gothic" })] }),
  normal("ffmpeg 명령 구성"),
);
["-y: 출력 파일 덮어쓰기 확인 없이 허용",
 "-ss {timestamp}  (입력 전 배치, -i 앞): 빠른 키프레임 탐색 (inaccurate fast seek)",
 "    입력 후 배치(-i 뒤)는 정확하지만 느림 — 단일 프레임 추출엔 fast seek이 적절",
 "-frames:v 1: 비디오 프레임 1장만 추출",
 "-q:v 2: JPEG 품질 (1=최고, 31=최저), 2는 고품질 VBR(Variable Bitrate) 방식",
].forEach(t => children.push(bullet(t)));
children.push(spacer());

// ── 5. parse_json_maybe ───────────────────────────────────────
children.push(
  sectionLine(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "5. parse_json_maybe() — LLM 출력 방어적 파싱", font: "Malgun Gothic" })] }),
  normal("LLM이 JSON을 어기는 3가지 패턴과 대응 전략"),
  twoColTable([
    ["LLM 출력 패턴", "대응 방법"],
    ["```json\\n{...}\\n```  (마크다운 코드블록)", "strip_fence() regex로 마크다운 펜스 제거"],
    ["{...}  (순수 JSON)", "json.loads() 직접 파싱"],
    ["\"물론입니다. {...}\"  (앞뒤 설명 텍스트 포함)", "re.search(r\"\\{.*\\}\", flags=re.DOTALL)로 JSON 추출"],
  ]),
  spacer(),
);
["re.DOTALL: .이 개행 문자 \\n도 매칭 → 멀티라인 JSON 지원",
 "r\"\\{.*\\}\": Greedy 매칭 → 가장 처음 {부터 마지막 }까지 (중첩 JSON에서 전체 객체 추출)",
].forEach(t => children.push(bullet(t)));
children.push(spacer());

// ── 6. ffmpeg 렌더링 파이프라인 ───────────────────────────────
children.push(
  sectionLine(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "6. ffmpeg 영상 렌더링 파이프라인", font: "Malgun Gothic" })] }),
  new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "render_scene_shorts_reference() — 필터 그래프 구조", font: "Malgun Gothic" })] }),
);
[
  "① color=c=black:s=1080x1920  →  세로 Full HD(1080×1920) 검정 캔버스 생성. 쇼츠/릴스/틱톡 표준 해상도. 원본이 다양한 해상도여도 일정한 출력 보장.",
  "② scale=1080:1280:force_original_aspect_ratio=increase  →  원본 영상을 1080×1280 박스 안에 비율 유지하며 확대(increase = 축 중 더 큰 쪽에 맞춤). 16:9 원본 → 1080×607이 되어 세로가 비게 됨.",
  "③ crop=1080:1280  →  scale 후 넘친 부분을 잘라내어 정확히 1080×1280 확보.",
  "④ overlay=0:320  →  1920 높이 캔버스의 y=320 위치에 클립 배치. 상단 320px: 헤드라인 영역 / 클립 아래 여백: 자막 영역.",
  "⑤ eq=saturation=1.1:contrast=1.04:brightness=0.01  →  음식 영상 보정: 채도 +10%, 명암비 +4%, 밝기 +1%.",
  "⑥ drawtext  →  fontfile: malgunbd.ttf, x=(w-text_w)/2: 수평 중앙 정렬, borderw=4:bordercolor=black: 가독성을 위한 외곽선.",
].forEach(t => children.push(bullet(t)));
children.push(spacer());

children.push(
  new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "font_path() — Windows 폰트 경로 이스케이프", font: "Malgun Gothic" })] }),
  normal("C:\\Windows\\Fonts\\malgun.ttf 처리"),
);
["\\ → / 로 치환: ffmpeg은 Unix 경로 선호",
 ": → \\: 로 이스케이프: ffmpeg 필터 파라미터에서 :는 구분자이므로 드라이브 문자(C:)가 파라미터 분리자로 오해됨 방지",
].forEach(t => children.push(bullet(t)));
children.push(spacer());

children.push(
  new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "text_units() & wrap_text_for_drawtext() — 한글 줄바꿈 처리", font: "Malgun Gothic" })] }),
  normal("text_units() 로직"),
);
["ord(char) > 127: ASCII 범위 초과 = 멀티바이트 문자 (한글, CJK, 특수문자 등)",
 "한글 = 2칸, 영문/숫자 = 1칸으로 계산 — CSS의 ch 단위 개념을 Python에서 직접 구현",
].forEach(t => children.push(bullet(t)));
children.push(spacer(), normal("wrap_text_for_drawtext() 로직"));
["그리디 Word-wrapping 알고리즘",
 "max_units=34: 화면 너비 1080px에서 폰트 크기 46px 기준으로 2행에 들어갈 한글 글자 수 경험적 계산값",
].forEach(t => children.push(bullet(t)));
children.push(spacer());

children.push(
  new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "동적 자막 박스 너비 계산", font: "Malgun Gothic" })] }),
  code("subtitle_box_width = min(1000, max(360, max(subtitle_line_units) * 25 + 72))"),
  code("subtitle_box_x = int((1080 - subtitle_box_width) / 2)"),
);
["* 25: 폰트 크기 46px × 약 0.54 비율로 한 글자 너비 추정",
 "+ 72: 좌우 패딩 36px × 2",
 "min(1000, max(360, ...)): 너무 짧거나(360px) 화면을 넘지(1000px) 않도록 클램핑",
 "(1080 - width) / 2: 화면 중앙 정렬용 x 좌표",
].forEach(t => children.push(bullet(t)));
children.push(spacer());

// ── 7. escape_drawtext ────────────────────────────────────────
children.push(
  sectionLine(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "7. escape_drawtext() — ffmpeg 특수문자 이스케이프", font: "Malgun Gothic" })] }),
  normal("이스케이프 순서 (순서가 반드시 지켜져야 함)"),
);
["1. \\ → \\\\  (역슬래시 먼저 — 이후 다른 치환의 \\가 이중 이스케이프되는 것 방지)",
 "2. : → \\:   (필터 구분자)",
 "3. ' → \\'   (문자열 인용부호)",
 "4. % → \\%   (ffmpeg strftime 포맷 특수문자: %{pts} 같은 표현식으로 해석 방지)",
 "5. \\n → 공백 (drawtext 필터는 개행 미지원)",
].forEach(t => children.push(bullet(t)));
children.push(spacer());

// ── 8. TTS 엔진 비교 ──────────────────────────────────────────
children.push(
  sectionLine(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "8. TTS 엔진 비교", font: "Malgun Gothic" })] }),
  new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "Edge TTS (로컬 실행)", font: "Malgun Gothic" })] }),
);
["edge-tts 패키지: Microsoft Edge 브라우저의 TTS 엔진을 역공학해 만든 비공식 Python 라이브러리",
 "내부적으로 MS Azure의 Speech Service WebSocket API를 사용",
 "무료이지만 MS 서버 의존 (오프라인 불가)",
 "ko-KR-SunHiNeural: 한국어 여성 신경망 음성 (자연스러운 억양)",
 "파라미터: --rate +12% (속도), --pitch +20Hz (음높이)",
].forEach(t => children.push(bullet(t)));
children.push(spacer(), new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "OpenRouter TTS (API 호출)", font: "Malgun Gothic" })] }));
["모델: x-ai/grok-voice-tts-1.0 / 목소리: Rex",
 "Fallback URL 패턴: /audio/speech → /tts 순서로 두 URL 순차 시도 (엔드포인트 변경 대비)",
 "404/405 (Method Not Allowed): URL 자체가 잘못된 것 → 다음 URL 시도",
 "다른 에러 (401, 429, 500 등): URL 문제가 아님 → 즉시 중단",
].forEach(t => children.push(bullet(t)));
children.push(spacer());

// ── 9. probe_duration ─────────────────────────────────────────
children.push(
  sectionLine(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "9. probe_duration() — ffprobe 미디어 길이 측정", font: "Malgun Gothic" })] }),
  normal("ffprobe 명령 파라미터"),
);
["-v error: 경고/정보 로그 숨김",
 "-show_entries format=duration: format 섹션의 duration만 출력",
 "-of default=noprint_wrappers=1:nokey=1: 키=값 형식 제거, 값만 출력",
 "출력 예: 3.840000 → float(\"3.840000\") = 3.84초",
].forEach(t => children.push(bullet(t)));
children.push(spacer(), normal("TTS 길이 기반 장면 길이 동적 계산"), code("duration = max(float(scene.get(\"duration_sec\", 4.0)), min(5.4, tts_duration + 0.55))"));
["TTS가 4초이면 → max(4.0, min(5.4, 4.55)) = max(4.0, 4.55) = 4.55초",
 "TTS가 5초이면 → max(4.0, min(5.4, 5.55)) = max(4.0, 5.4) = 5.4초 (상한 클램핑)",
 "즉 장면 길이 = TTS 길이 + 0.55초 (여백), 단 4.0~5.4초 범위 클램핑",
].forEach(t => children.push(bullet(t)));
children.push(spacer());

// ── 10. concat_videos ─────────────────────────────────────────
children.push(
  sectionLine(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "10. concat_videos() — 멀티 입력 concat 필터", font: "Malgun Gothic" })] }),
  normal("PTS(Presentation TimeStamp) 리셋이 필요한 이유"),
);
["각 클립의 PTS는 자기 클립 내부 시간 기준 (0에서 시작하지 않을 수 있음)",
 "setpts=PTS-STARTPTS: 각 스트림의 PTS를 0부터 다시 시작 → concat 시 타임라인 충돌 방지",
 "concat=n=9:v=1:a=1: 9개 세그먼트, 비디오 1개 스트림, 오디오 1개 스트림 연결",
].forEach(t => children.push(bullet(t)));
children.push(spacer());

// ── 11. mix_bgm ───────────────────────────────────────────────
children.push(
  sectionLine(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "11. mix_bgm() — 오디오 믹싱", font: "Malgun Gothic" })] }),
  normal("amix 필터 구성"),
);
["[0:a]: 첫 번째 입력(영상)의 오디오 = 나레이션",
 "[1:a]: 두 번째 입력(BGM mp3)의 오디오",
 "atrim: BGM을 영상 길이에 맞게 자름 (BGM이 영상보다 길 때)",
 "volume={bgm_volume}: 환경변수 BGM_VOLUME으로 제어 (기본 0.09 = 9%)",
 "amix=duration=first: 첫 번째 입력(나레이션) 길이 기준으로 믹싱 종료",
 "dropout_transition=0: 한쪽 스트림이 끝나도 급작스러운 볼륨 변화 없음",
].forEach(t => children.push(bullet(t)));
children.push(spacer(), normal("볼륨 환경변수 패턴"), code("bgm_volume      = float(os.environ.get(\"BGM_VOLUME\", \"0.09\"))"), code("narration_volume = float(os.environ.get(\"NARRATION_VOLUME\", \"1.55\"))"));
["실행 시 $env:BGM_VOLUME=\"0.035\" → BGM 3.5%, 나레이션 170% 로 코드 수정 없이 조절 가능",
].forEach(t => children.push(bullet(t)));
children.push(spacer());

// ── 12. 프롬프트 엔지니어링 ──────────────────────────────────
children.push(
  sectionLine(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "12. 대본 생성 프롬프트 엔지니어링", font: "Malgun Gothic" })] }),
  new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "Vision 프롬프트 설계 원칙", font: "Malgun Gothic" })] }),
);
["Output format 강제: \"JSON으로만\" → parse_json_maybe() 성공률 향상",
 "컨텍스트 격리: \"파일명을 모른다고 가정\" → bias 없는 순수 시각 분석 유도",
 "불확실성 명시: \"추정임을 표현하라\" → Hallucination 억제",
].forEach(t => children.push(bullet(t)));
children.push(spacer(), new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "스크립트 생성 프롬프트 — 체인 오브 모델", font: "Malgun Gothic" })] }));
["Vision 모델 결과 JSON → 스크립트 LLM 입력으로 주입",
 "두 모델이 역할을 분리 (시각 인식 vs. 언어 생성) — 각 모델의 강점 활용",
 "Vision 결과를 json.dumps(..., indent=2)로 예쁘게 포맷해서 LLM 컨텍스트에 삽입",
].forEach(t => children.push(bullet(t)));
children.push(spacer(), normal("주요 제약 프롬프트"));
["\"scenes는 반드시 9개\" → 출력 구조 강제",
 "\"나레이션은 Edge TTS로 4초 안에 읽을 수 있도록 18자 내외\" → TTS 제약 반영",
 "\"맞춤법 주의: 끓이기, 젓가락, 꿔바로우\" → 도메인 특화 규칙",
].forEach(t => children.push(bullet(t)));
children.push(spacer());

// ── 13. clean_scene_payload ───────────────────────────────────
children.push(
  sectionLine(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "13. clean_scene_payload() — LLM 출력 후처리", font: "Malgun Gothic" })] }),
);
["fallback_text(): 빈 문자열/None 방어 → 폴백 값으로 대체",
 "[:18] 슬라이싱: LLM이 프롬프트 길이 제한을 무시하는 경우에 대한 하드 트림",
 "sync_caption_narration=True: 자막과 TTS를 완전히 동일하게 강제 → 텍스트와 음성 불일치 방지",
].forEach(t => children.push(bullet(t)));
children.push(spacer());

// ── 14. dataclass frozen ──────────────────────────────────────
children.push(
  sectionLine(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "14. @dataclass(frozen=True) — 불변 장면 메타데이터", font: "Malgun Gothic" })] }),
  code("@dataclass(frozen=True)"),
  code("class SourceScene:"),
  code("    index: int"),
  code("    file: str"),
  code("    reference: str"),
  code("    frame_at: float = 1.0   # 프레임 추출 시각 (초)"),
  code("    duration: float = 4.0   # 기본 장면 길이 (초)"),
  spacer(),
);
["frozen=True: 인스턴스 생성 후 필드 변경 불가 → 장면 정의가 런타임에 변경되는 버그 원천 차단",
 "@dataclass: __init__, __repr__, __eq__ 자동 생성",
 "클래스 레벨 상수 SCENES에 저장 → 설정을 코드에 명확히 선언 (Config-as-Code 패턴)",
].forEach(t => children.push(bullet(t)));
children.push(spacer());

// ── 15. inspect_vision_models ─────────────────────────────────
children.push(
  sectionLine(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "15. inspect_vision_models.py — 멀티모델 비교 툴", font: "Malgun Gothic" })] }),
  normal("비교 대상 모델"),
);
["google/gemini-2.5-flash-lite (Gemini 2.5 Flash Lite)",
 "openai/gpt-4o-mini (GPT-4o mini)",
 "qwen/qwen2.5-vl-72b-instruct (Qwen2.5 VL 72B)",
].forEach(t => children.push(bullet(t)));
children.push(spacer(), normal("설계 특징"));
["동일 입력(이미지 + 프롬프트)을 3개 Vision 모델에 순차 전송",
 "결과를 CSV + Markdown 테이블로 저장 → 모델별 성능 비교 인프라",
 "description_match 필드: Vision 결과가 사용자 설명과 일치하는지 LLM 자체 판단 → Grounding 검증",
 "한 모델 실패해도 나머지 모델 결과는 저장 → 부분 실패 허용 설계",
].forEach(t => children.push(bullet(t)));
children.push(spacer());

// ── 16. run_role_video_pipeline ───────────────────────────────
children.push(
  sectionLine(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "16. run_role_video_pipeline.py — AI 영상 생성 기능", font: "Malgun Gothic" })] }),
);
["Image-to-Video 생성: 입력 이미지를 첫 프레임으로 고정하고 AI가 이후 영상 생성",
 "google/veo-3.1-lite: Google Veo 영상 생성 모델 (OpenRouter 중계)",
 "비동기 Job 패턴: 영상 생성 요청 → job ID 반환 → 완료될 때까지 20초 간격 폴링",
 "unsigned_urls: presigned URL 없이 임시 접근 가능한 다운로드 URL",
].forEach(t => children.push(bullet(t)));
children.push(spacer());

// ── 17. build_local_clip / Ken Burns ─────────────────────────
children.push(
  sectionLine(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "17. build_local_clip() — 이미지 → 영상 변환 (Ken Burns 효과)", font: "Malgun Gothic" })] }),
  normal("zoompan 필터"),
);
["z='min(zoom+0.0015,1.08)': 매 프레임 줌 +0.15%, 최대 108%",
 "d=150: 150프레임(5초) 기준",
 "정지 이미지에 서서히 확대되는 Ken Burns 효과 적용",
 "-loop 1: 이미지 파일을 동영상처럼 반복해서 읽기",
].forEach(t => children.push(bullet(t)));
children.push(spacer());

// ── 18. 출력 아티팩트 구조 ────────────────────────────────────
children.push(
  sectionLine(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "18. 출력 아티팩트 구조", font: "Malgun Gothic" })] }),
  twoColTable([
    ["경로", "설명"],
    ["frames/scene_XX.jpg", "Vision 분석용 장면 프레임 (9장)"],
    ["tts/scene_XX_*.mp3", "장면별 TTS 나레이션 오디오"],
    ["rendered/scene_XX.mp4", "자막 + TTS 합성 클립 (9개)"],
    ["*_concat.mp4", "9장면 연결 중간 결과물"],
    ["final_*.mp4", "BGM 믹싱 완성 최종본"],
    ["poster.jpg", "9초 지점 프레임 (SNS 썸네일용)"],
    ["scene_summary.csv", "장면별 대본 정리 (재렌더링 입력용)"],
    ["manifest.json", "전체 실행 메타데이터 (완전 재현 가능)"],
  ]),
  spacer(),
);
["run_id = 타임스탬프: 여러 번 실행해도 결과가 겹치지 않음 → 버전 관리 가능",
 "manifest.json: 어떤 모델/파라미터로 만든 영상인지 완전 재현 가능한 메타데이터 보존",
 "poster.jpg: 9초 지점 프레임 → YouTube/SNS 업로드 시 썸네일용",
].forEach(t => children.push(bullet(t)));
children.push(spacer());

// ── 19. 핵심 설계 결정 요약 ──────────────────────────────────
children.push(
  sectionLine(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "19. 핵심 설계 결정 요약", font: "Malgun Gothic" })] }),
  twoColTable([
    ["설계 결정", "이유"],
    ["표준 라이브러리만으로 HTTP 구현", "의존성 최소화, requirements.txt 단순화"],
    ["subprocess + ffmpeg", "Python 영상 처리 라이브러리(moviepy 등)보다 성능/유연성 우수"],
    ["Base64 Data URL로 이미지 전송", "로컬 파일을 외부 API에 직접 전달하는 가장 단순한 방법"],
    ["Vision → Script 체인 설계", "시각 인식과 언어 생성을 분리해 각 모델의 강점 활용"],
    ["frozen=True dataclass", "설정 데이터의 불변성 보장, 실수 방지"],
    ["환경변수로 볼륨 제어", "코드 수정 없이 믹싱 파라미터 조정 가능"],
    ["타임스탬프 기반 run_id", "실험 재현성 + 결과 누적 보존"],
    ["manifest.json 저장", "어떤 모델·파라미터로 만들었는지 완전한 출처 추적 가능"],
    ["TTS URL 두 개 순차 시도", "API 엔드포인트 변경에 대한 방어적 프로그래밍"],
    ["parse_json_maybe 방어적 파싱", "LLM 출력의 비결정적 포맷에 대한 견고한 처리"],
  ]),
  spacer(),
);

// ══════════════════════════════════════════════════════════════
//  Document 조립
// ══════════════════════════════════════════════════════════════
const doc = new Document({
  numbering: {
    config: [{
      reference: "bullets",
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: "•",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 480, hanging: 280 } } },
      }],
    }],
  },
  styles: {
    default: {
      document: { run: { font: "Malgun Gothic", size: 22 } },
    },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Malgun Gothic", color: BLUE },
        paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0 },
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Malgun Gothic", color: LBLUE },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 },
      },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: PAGE_W, height: PAGE_H },
        margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
      },
    },
    children,
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("C:\\Users\\hyper\\Downloads\\models\\AI_숏폼_파이프라인_기술설명.docx", buf);
  console.log("Done: AI_숏폼_파이프라인_기술설명.docx");
});
