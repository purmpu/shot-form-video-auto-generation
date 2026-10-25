const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, LevelFormat, BorderStyle, WidthType,
  ShadingType, VerticalAlign,
} = require("docx");
const fs = require("fs");

// ── 색상 ─────────────────────────────────────────────────────
const BLUE    = "1F4E79";
const LBLUE   = "2E75B6";
const ACCENT  = "D5E8F0";
const CODEBG  = "F2F2F2";
const GRAY    = "595959";
const BORDER  = "CCCCCC";
const GREEN   = "375623";
const GREENB  = "E2EFDA";
const ORANGE  = "833C00";
const ORANGEB = "FCE4D6";
const PURPLE  = "3F1F5F";
const PURPLEB = "EAD7F7";

// ── 페이지 ───────────────────────────────────────────────────
const PAGE_W = 12240, PAGE_H = 15840, MARGIN = 1440, CW = PAGE_W - MARGIN * 2;

// ── 헬퍼 ─────────────────────────────────────────────────────
const bd  = (c = BORDER) => ({ style: BorderStyle.SINGLE, size: 1, color: c });
const bds = (c = BORDER) => ({ top: bd(c), bottom: bd(c), left: bd(c), right: bd(c) });

const sp  = () => new Paragraph({ spacing: { after: 100 }, children: [] });

const div = () => new Paragraph({
  spacing: { before: 240, after: 240 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LBLUE, space: 1 } },
  children: [],
});

// 확정 태그 (초록)
const confirmed = () => new Paragraph({
  spacing: { after: 120 },
  shading: { fill: GREENB, type: ShadingType.CLEAR },
  indent: { left: 180, right: 180 },
  children: [new TextRun({ text: "✔  확정 모델 : Gemini 2.5 Flash Lite  (google/gemini-2.5-flash-lite)", font: "Malgun Gothic", size: 21, bold: true, color: GREEN })],
});

// 설계 요구사항 태그 (주황)
const req = (text) => new Paragraph({
  spacing: { before: 100, after: 100 },
  shading: { fill: ORANGEB, type: ShadingType.CLEAR },
  indent: { left: 180, right: 180 },
  children: [new TextRun({ text: "📌  설계 요구사항 : " + text, font: "Malgun Gothic", size: 21, bold: true, color: ORANGE })],
});

const p = (text) => new Paragraph({
  spacing: { after: 120 },
  children: [new TextRun({ text, font: "Malgun Gothic", size: 22, color: "1A1A1A" })],
});

const lbl = (text) => new Paragraph({
  spacing: { before: 160, after: 80 },
  children: [new TextRun({ text, font: "Malgun Gothic", size: 21, bold: true, color: LBLUE })],
});

const cd = (text) => new Paragraph({
  spacing: { before: 40, after: 40 },
  shading: { fill: CODEBG, type: ShadingType.CLEAR },
  indent: { left: 360, right: 360 },
  children: [new TextRun({ text, font: "Courier New", size: 20, color: "1A1A1A" })],
});

const bl = (text, lv = 0) => new Paragraph({
  numbering: { reference: "bullets", level: lv },
  spacing: { after: 80 },
  children: [new TextRun({ text, font: "Malgun Gothic", size: 22, color: "1A1A1A" })],
});
const sb = (t) => bl(t, 1);

const tbl = (rows, cols, headerBg = ACCENT) => new Table({
  width: { size: CW, type: WidthType.DXA },
  columnWidths: cols,
  rows: rows.map((row, ri) => new TableRow({
    children: row.map((text, ci) => new TableCell({
      width: { size: cols[ci], type: WidthType.DXA },
      borders: bds(BORDER),
      shading: { fill: ri === 0 ? headerBg : "FFFFFF", type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({
        children: [new TextRun({
          text, font: "Malgun Gothic",
          size: ri === 0 ? 21 : 20,
          bold: ri === 0,
          color: ri === 0 ? BLUE : "1A1A1A",
        })],
      })],
    })),
  })),
});

// ══════════════════════════════════════════════════════════════
const C = [];

// ── 표지 ─────────────────────────────────────────────────────
C.push(
  new Paragraph({
    spacing: { before: 1440, after: 480 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "AI 숏폼 영상 생성 파이프라인", font: "Malgun Gothic", size: 60, bold: true, color: BLUE })],
  }),
  new Paragraph({
    spacing: { after: 200 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "구현 기술 상세 설명 — 실행 순서 기준", font: "Malgun Gothic", size: 38, color: GRAY })],
  }),
  new Paragraph({
    spacing: { after: 80 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "천라쿵푸 마라탕 홍보 영상 자동화 파이프라인", font: "Malgun Gothic", size: 24, color: GRAY })],
  }),
  new Paragraph({
    spacing: { after: 160 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "모델 확정 및 설계 요구사항 반영본", font: "Malgun Gothic", size: 22, bold: true, color: ORANGE })],
  }),
  div(), sp(),
);

// ── 전체 흐름 요약표 ──────────────────────────────────────────
C.push(
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "파이프라인 실행 흐름 전체 개요", font: "Malgun Gothic" })] }),
  tbl([
    ["실행 순서", "기술 분류", "확정 모델 / 도구", "비고"],
    ["① API 게이트웨이",  "Model Router",            "OpenRouter",                    "Gemini 2.5 Flash Lite 경유"],
    ["② 프레임 추출",     "영상 처리",               "ffmpeg fast seek",              "-"],
    ["③ 프롬프트 설계",   "Prompt Engineering",       "수동 설계",                     "-"],
    ["④ VLM 장면 분석",   "Vision-Language Model",   "Gemini 2.5 Flash Lite  ✔ 확정", "-"],
    ["⑤ LLM 대본 생성",   "Large Language Model",    "Qwen3.6 Flash",                 "-"],
    ["⑥ 음성 합성 (TTS)", "Neural TTS",              "API / 내부 모델 전환 가능",      "목소리 설정 파일로 관리"],
    ["⑦ 클립 렌더링",     "ffmpeg Filter Graph",     "libx264 + drawtext",            "폰트·스타일 설정 가능"],
    ["⑧ 클립 연결",       "Stream Concat + PTS",     "ffmpeg concat",                 "-"],
    ["⑨ BGM 믹싱",        "DSP Audio Mixing",        "ffmpeg amix",                   "-"],
    ["(선택) AI 영상 생성", "Video Generation",      "Google Veo 3.1 Lite",           "Ken Burns 포함"],
  ], [1700, 2200, 2800, 2700]),
  sp(),
);

// ══════════════════════════════════════════════════════════════
// STEP 1. OpenRouter
// ══════════════════════════════════════════════════════════════
C.push(
  div(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "STEP 1 — OpenRouter : AI 모델 게이트웨이", font: "Malgun Gothic" })] }),
  confirmed(),
  sp(),
  p("파이프라인에서 Vision 분석·대본 생성·TTS 세 가지 AI 호출이 모두 OpenRouter를 통해 이루어진다. 실제 Vision 모델로는 Gemini 2.5 Flash Lite를 사용하기로 확정했다."),
  sp(),
  lbl("▶ OpenRouter란?"),
  p("여러 AI 회사의 모델을 단일 API 엔드포인트로 통합한 서비스다. OpenAI API와 완전히 호환되는 포맷을 사용하므로 model 파라미터 하나만 바꾸면 Gemini·Qwen·GPT 등 어떤 모델로도 전환된다."),
  cd("[코드]  →  POST https://openrouter.ai/api/v1/chat/completions"),
  cd("                       ↓ OpenRouter 내부 라우팅"),
  cd("   Gemini (Google)  |  Qwen (Alibaba)  |  GPT-4o (OpenAI)  |  Grok (xAI)"),
  sp(),
  lbl("▶ 이 프로젝트에서 사용하는 엔드포인트"),
  tbl([
    ["용도",            "엔드포인트",           "확정 모델"],
    ["Vision 장면 분석", "/v1/chat/completions", "google/gemini-2.5-flash-lite  ✔"],
    ["대본 생성",        "/v1/chat/completions", "qwen/qwen3.6-flash"],
    ["TTS 음성 합성",    "/v1/audio/speech",     "x-ai/grok-voice-tts-1.0  (API 모드 시)"],
    ["영상 생성(선택)", "/v1/videos",            "google/veo-3.1-lite"],
  ], [2400, 3200, 3800]),
  sp(),
  lbl("▶ 왜 각 회사 API를 직접 쓰지 않는가?"),
  bl("단일 API 키·단일 엔드포인트 → 여러 회사 계정 관리 불필요"),
  bl("model 파라미터 하나만 바꾸면 모델 전환 가능 → 실험 속도 향상"),
  bl("사용량·비용 모니터링이 한 대시보드에서 통합 관리"),
  sp(),
);

// ══════════════════════════════════════════════════════════════
// STEP 2. 프레임 추출
// ══════════════════════════════════════════════════════════════
C.push(
  div(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "STEP 2 — ffmpeg 프레임 추출", font: "Malgun Gothic" })] }),
  p("Vision AI에 전달하기 위해 MOV 영상에서 특정 시각의 정지 프레임 1장을 JPG로 추출한다."),
  sp(),
  lbl("▶ ffmpeg 명령 구성"),
  cd("ffmpeg  -y  -ss {timestamp}  -i source.MOV  -frames:v 1  -q:v 2  frame.jpg"),
  sp(),
  tbl([
    ["옵션",         "설명"],
    ["-y",           "출력 파일 덮어쓰기 — 확인 프롬프트 없이 자동 허용"],
    ["-ss {time}  (-i 앞 배치)", "Fast Seek: 키프레임 단위로 빠르게 탐색. -i 뒤에 배치하면 정확하지만 속도 느림"],
    ["-frames:v 1",  "비디오 프레임 1장만 추출하고 즉시 종료"],
    ["-q:v 2",       "JPEG VBR 품질 (1=최고화질 ~ 31=최저). 2는 고품질 — Vision AI 인식률에 직접 영향"],
  ], [3000, 6400]),
  sp(),
  lbl("▶ 왜 영상 전체가 아닌 프레임 1장인가?"),
  bl("비용: 영상 전체를 Base64로 인코딩하면 수십 MB → API 비용·전송 시간 급증"),
  bl("충분성: 홍보 영상 각 장면은 정적 구성이므로 대표 시각 1장으로 장면 설명 가능"),
  bl("Base64 Data URL: 로컬 파일을 외부 서버 업로드 없이 HTTP Body에 직접 포함"),
  sp(),
);

// ══════════════════════════════════════════════════════════════
// STEP 3. 프롬프트 엔지니어링
// ══════════════════════════════════════════════════════════════
C.push(
  div(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "STEP 3 — Prompt Engineering", font: "Malgun Gothic" })] }),
  p("VLM과 LLM을 호출하기 전에 어떤 방식으로 질문할지를 설계하는 단계다. 같은 모델이라도 프롬프트 설계에 따라 결과 품질이 크게 달라진다."),
  sp(),
  lbl("▶ Structured Output Prompting — JSON 강제 출력"),
  p("LLM에게 자유 형식 텍스트 대신 JSON 스키마를 명시해 파싱 가능한 구조화 데이터를 얻는다."),
  cd("\"출력 JSON: { scene: 1, title: '10자 이내', subtitle: '18자 이내', narration: '18자 이내' }\""),
  cd("\"JSON 외 텍스트는 출력하지 마라.\""),
  sp(),
  lbl("▶ Hallucination 억제"),
  bl("불확실성 명시 요구: \"확실하지 않은 메뉴는 '추정'이라고 표현하라\""),
  bl("컨텍스트 격리: \"파일명을 모른다고 가정하고 이미지 자체만 판단하라\" → 선입견 차단"),
  bl("금지 규칙 명시: \"위생 확실, 누수 없음 등 직접 보이지 않는 표현 금지\""),
  sp(),
  lbl("▶ Length Constraint Prompting — TTS 제약 반영"),
  cd("\"나레이션은 4초 안에 읽을 수 있도록 18자 내외의 짧은 한국어 문장\""),
  bl("한국어 기준 4초 ≈ 16~18자 (평균 발화 속도 약 4~4.5자/초)"),
  bl("LLM이 제약을 어길 경우 하드 트림(슬라이싱)으로 강제 처리"),
  sp(),
);

// ══════════════════════════════════════════════════════════════
// STEP 4. VLM 장면 분석
// ══════════════════════════════════════════════════════════════
C.push(
  div(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "STEP 4 — VLM 장면 분석 : Vision-Language Model", font: "Malgun Gothic" })] }),
  confirmed(),
  sp(),
  p("추출한 JPG 프레임을 Gemini 2.5 Flash Lite에 전달해 장면을 분석한다. 이 결과 JSON이 다음 단계 LLM 대본 생성의 입력이 된다."),
  sp(),
  lbl("▶ VLM 내부 작동 원리"),
  p("이미지를 Vision Encoder (ViT: Vision Transformer)로 패치 단위 임베딩으로 변환한 뒤, LLM의 어텐션 레이어에 텍스트 토큰과 함께 주입한다. 이를 통해 모델이 시각 정보를 자연어로 설명할 수 있다."),
  cd("[JPG 프레임]  →  Base64  →  OpenRouter  →  Gemini 2.5 Flash Lite"),
  cd("                                                      ↓"),
  cd("{ scene_summary, detected_food, keywords, caption_candidate }"),
  sp(),
  lbl("▶ Vision API 메시지 구조"),
  p("OpenAI 호환 포맷에서 content를 리스트로 구성하면 텍스트와 이미지를 혼합할 수 있다."),
  cd("\"content\": ["),
  cd("  { \"type\": \"text\",      \"text\": \"JSON으로만 출력하라...\" },"),
  cd("  { \"type\": \"image_url\", \"image_url\": { \"url\": \"data:image/jpeg;base64,...\" } }"),
  cd("]"),
  sp(),
  lbl("▶ Gemini 2.5 Flash Lite를 선택한 이유"),
  tbl([
    ["항목", "Gemini 2.5 Flash Lite", "GPT-4o mini", "Qwen2.5 VL 72B"],
    ["속도",  "매우 빠름 (경량 모델)", "빠름",         "느림 (72B 대형 모델)"],
    ["비용",  "낮음",                  "중간",          "높음"],
    ["음식 장면 인식", "우수",         "양호",          "우수"],
    ["한국어 자막 품질", "양호",       "양호",          "우수"],
    ["최종 선정", "✔  확정",          "-",             "-"],
  ], [2600, 2400, 2000, 2400]),
  sp(),
);

// ══════════════════════════════════════════════════════════════
// STEP 5. LLM 대본 생성
// ══════════════════════════════════════════════════════════════
C.push(
  div(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "STEP 5 — LLM 대본 생성 : Chain of Models", font: "Malgun Gothic" })] }),
  p("VLM이 생성한 장면 분석 JSON 9개를 한꺼번에 LLM(Qwen3.6 Flash)에 넘겨 자막·나레이션 대본을 생성한다."),
  sp(),
  lbl("▶ Chain of Models 패턴"),
  cd("[STEP 4: Gemini VLM 결과 JSON 9개]  ──→  [STEP 5: Qwen3.6 Flash 대본 생성]"),
  cd("   \"무엇이 보이는가\"                          \"어떤 말로 표현할 것인가\""),
  sp(),
  lbl("▶ 역할 분리의 이유"),
  bl("VLM은 이미지 해석에 특화, 마케팅 문구 생성은 일반 LLM이 더 뛰어남"),
  bl("두 단계로 나누면 실패 지점 격리 → 디버깅·모델 교체 용이"),
  bl("VLM 결과 JSON이 고정되면 대본 모델만 독립적으로 교체·실험 가능"),
  sp(),
  lbl("▶ JSON 파싱 방어 전략"),
  tbl([
    ["LLM 출력 패턴", "대응 방법"],
    ["```json\\n{...}\\n```  마크다운 코드블록", "Regex로 펜스(```) 제거 후 파싱"],
    ["{...}  순수 JSON",                         "json.loads() 직접 파싱"],
    ["\"물론입니다. {...}\"  앞뒤 설명 텍스트",  "re.search(r'\\{.*\\}', DOTALL)로 JSON 블록만 추출"],
  ], [4800, 4600]),
  sp(),
  lbl("▶ 출력 후처리"),
  bl("빈 문자열·None 방어: fallback_text()로 폴백 값 자동 대체"),
  bl("하드 트림: LLM이 길이 제한을 무시하면 슬라이싱으로 강제 절단"),
  bl("sync_caption_narration=True: 자막과 나레이션 완전 동일 강제 → 음성·텍스트 불일치 방지"),
  sp(),
);

// ══════════════════════════════════════════════════════════════
// STEP 6. Neural TTS — 확장 설계
// ══════════════════════════════════════════════════════════════
C.push(
  div(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "STEP 6 — Neural TTS : 음성 합성", font: "Malgun Gothic" })] }),
  req("API ↔ 내부 모델 전환 가능하도록 설계  |  목소리를 설정 파일로 쉽게 변경"),
  sp(),
  p("대본의 narration 텍스트를 MP3 오디오 파일로 변환한다. 장면 9개 각각에 대해 독립적으로 생성한다."),
  sp(),

  lbl("▶ TTS 추상화 레이어 설계"),
  p("엔진(API / 내부 모델)을 코드 수정 없이 전환할 수 있도록 단일 인터페이스로 추상화한다."),
  tbl([
    ["설정값 (TTS_ENGINE)", "동작 방식", "목소리 설정 방식"],
    ["openrouter",  "OpenRouter API 호출 (Grok TTS 등 유료 API)",    "TTS_VOICE=Rex, TTS_MODEL=x-ai/grok-voice-tts-1.0"],
    ["edge",        "MS Edge TTS — Azure Neural TTS WebSocket 호출", "TTS_VOICE=ko-KR-SunHiNeural"],
    ["piper",       "로컬 Piper TTS — 완전 오프라인 실행 가능",       "TTS_VOICE=모델 파일 경로"],
    ["kokoro",      "로컬 Kokoro TTS — 고품질 한국어 지원 예정",      "TTS_VOICE=kokoro 목소리 ID"],
  ], [2200, 3300, 3900]),
  sp(),

  lbl("▶ 환경변수 기반 목소리 설정"),
  p("목소리 변경은 코드 수정 없이 .env 파일 또는 환경변수 한 줄로 완료된다."),
  cd("# .env.tts  ← 목소리 설정 전용 파일"),
  cd("TTS_ENGINE=openrouter          # openrouter | edge | piper | kokoro"),
  cd("TTS_MODEL=x-ai/grok-voice-tts-1.0"),
  cd("TTS_VOICE=Rex                  # Rex | Coral | Nova | Alloy | ko-KR-SunHiNeural ..."),
  cd("TTS_SPEED=1.0                  # 재생 속도 (0.5 ~ 2.0)"),
  cd("TTS_PITCH=+0Hz                 # edge TTS 전용 피치 조정"),
  cd("TTS_RATE=+12%                  # edge TTS 전용 속도 조정"),
  sp(),

  lbl("▶ 지원 엔진별 목소리 옵션"),
  tbl([
    ["엔진", "사용 가능한 목소리 예시", "비고"],
    ["openrouter (Grok)",  "Rex, Coral, Nova, Alloy, Echo, Fable, Onyx, Shimmer", "유료 API, 자연스러운 영어 발화"],
    ["openrouter (OpenAI TTS)", "alloy, echo, fable, onyx, nova, shimmer",        "gpt-4o-mini-tts-2025-12-15"],
    ["edge (MS Azure)",   "ko-KR-SunHiNeural, ko-KR-InJoonNeural, ko-KR-HyunsuMultilingualNeural", "무료, 한국어 특화"],
    ["piper (로컬)",       "모델 파일(.onnx) 경로 지정",                            "완전 오프라인, 경량"],
    ["kokoro (로컬)",      "kokoro 목소리 ID 지정",                                "한국어 고품질 예정"],
  ], [2200, 4000, 3200]),
  sp(),

  lbl("▶ TTS 엔진 전환 흐름"),
  cd("TTS_ENGINE 값 읽기"),
  cd("  ├─ 'openrouter'  →  OpenRouter API 호출 (HTTP POST)"),
  cd("  ├─ 'edge'        →  edge-tts 패키지 (MS Azure WebSocket)"),
  cd("  ├─ 'piper'       →  subprocess로 piper 실행 (로컬 ONNX 모델)"),
  cd("  └─ 'kokoro'      →  kokoro-tts 패키지 호출 (로컬)"),
  cd("                        ↓  어느 엔진이든"),
  cd("                   scene_XX.mp3  (동일한 출력 포맷)"),
  sp(),

  lbl("▶ 신경망 TTS 내부 구조"),
  tbl([
    ["구성 요소", "역할"],
    ["Acoustic Model (Transformer 기반)", "텍스트 → 멜 스펙트로그램 (주파수 특성 시퀀스) 생성"],
    ["Vocoder (WaveNet / HiFi-GAN 계열)", "멜 스펙트로그램 → 실제 오디오 파형 합성"],
  ], [3800, 5600]),
  sp(),

  lbl("▶ TTS 길이 불확실성 해결"),
  p("TTS 생성 후 ffprobe로 실제 오디오 길이를 측정해 장면 길이를 동적으로 확정한다."),
  cd("장면 길이 = max(4.0초,  min(5.4초,  TTS 실제 길이 + 0.55초 여백))"),
  sp(),
);

// ══════════════════════════════════════════════════════════════
// STEP 7. ffmpeg 클립 렌더링 — 자막 스타일 설정
// ══════════════════════════════════════════════════════════════
C.push(
  div(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "STEP 7 — ffmpeg Filter Graph : 클립 렌더링", font: "Malgun Gothic" })] }),
  req("자막 폰트·스타일(반투명 박스형, 굵은 글씨형 등) 설정 가능하도록 설계"),
  sp(),
  p("원본 MOV + TTS MP3를 입력으로 받아 자막이 합성된 장면 MP4를 출력한다. 9개 장면 각각에 대해 독립적으로 실행된다."),
  sp(),

  lbl("▶ 자막 스타일 프리셋 — 3가지 선택 가능"),
  tbl([
    ["스타일 ID", "이름", "시각 효과", "추천 상황"],
    ["box",      "반투명 박스형 (기본)", "검정 반투명 박스 배경 위에 흰 텍스트", "배경이 밝거나 복잡한 장면"],
    ["bold",     "굵은 외곽선형",        "텍스트에 굵은 검정 외곽선 (배경 박스 없음)", "깔끔한 느낌, 배경이 어두운 장면"],
    ["highlight","형광 하이라이트형",    "노란색 반투명 박스 위에 검정 텍스트", "강조가 필요한 핵심 장면"],
  ], [1400, 2200, 3200, 2600]),
  sp(),

  lbl("▶ 자막 설정 파라미터 목록"),
  tbl([
    ["설정 항목",       "환경변수 / 설정키",      "기본값",                  "설명"],
    ["자막 스타일",     "SUBTITLE_STYLE",          "box",                    "box | bold | highlight"],
    ["폰트 파일",       "SUBTITLE_FONT",           "malgunbd.ttf (맑은 고딕 볼드)", "TTF 파일 경로 직접 지정 가능"],
    ["자막 글자 크기",  "SUBTITLE_FONT_SIZE",      "46",                     "픽셀 단위 (권장 범위: 36~64)"],
    ["헤드라인 크기",   "HEADLINE_FONT_SIZE",      "84",                     "상단 고정 헤드라인 글자 크기"],
    ["자막 텍스트 색",  "SUBTITLE_COLOR",          "white",                  "ffmpeg 색 이름 또는 RRGGBB"],
    ["박스 불투명도",   "SUBTITLE_BOX_ALPHA",      "0.76",                   "0.0 (투명) ~ 1.0 (불투명)"],
    ["박스 색",         "SUBTITLE_BOX_COLOR",      "black",                  "box / highlight 스타일에만 적용"],
    ["외곽선 두께",     "SUBTITLE_BORDER_WIDTH",   "3",                      "bold 스타일에만 적용 (픽셀)"],
    ["자막 세로 위치",  "SUBTITLE_Y_POSITION",     "1520 (하단)",            "픽셀 단위 y 좌표"],
    ["헤드라인 고정",   "FIXED_HEADLINE",          "\"마라탕 땡기는 날\\n여긴 어때?\"", "\\n으로 2줄 분리"],
  ], [2000, 2600, 2600, 2200]),
  sp(),

  lbl("▶ 스타일별 ffmpeg drawtext 구성"),
  p("box 스타일 (반투명 박스형) — 기본값"),
  cd("drawbox=x={x}:y={y}:w={w}:h={h}:color=black@{ALPHA}:t=fill,"),
  cd("drawtext=fontfile='{FONT}':text='{자막}':fontcolor=white:fontsize={SIZE}:x=(w-text_w)/2:y={Y}"),
  sp(),
  p("bold 스타일 (굵은 외곽선형)"),
  cd("drawtext=fontfile='{FONT}':text='{자막}':fontcolor=white:fontsize={SIZE}:"),
  cd("         borderw={BORDER_W}:bordercolor=black:x=(w-text_w)/2:y={Y}"),
  sp(),
  p("highlight 스타일 (형광 하이라이트형)"),
  cd("drawbox=x={x}:y={y}:w={w}:h={h}:color=yellow@{ALPHA}:t=fill,"),
  cd("drawtext=fontfile='{FONT}':text='{자막}':fontcolor=black:fontsize={SIZE}:x=(w-text_w)/2:y={Y}"),
  sp(),

  lbl("▶ 폰트 변경 방법"),
  tbl([
    ["폰트", "파일명", "특징"],
    ["맑은 고딕 (기본)",   "malgun.ttf",   "가독성 표준, 윈도우 기본 한글 폰트"],
    ["맑은 고딕 볼드",     "malgunbd.ttf", "강조에 적합, 자막·헤드라인 기본 사용"],
    ["나눔고딕 볼드",      "NanumGothicBold.ttf", "친근하고 둥근 느낌"],
    ["Noto Sans KR",       "NotoSansKR-Bold.otf", "SNS 트렌드 폰트, 세련된 느낌"],
    ["사용자 지정",        "임의 TTF/OTF 경로",   "SUBTITLE_FONT 환경변수로 경로 직접 지정"],
  ], [2400, 2600, 4400]),
  sp(),

  lbl("▶ Filter Graph 전체 구조"),
  cd("원본 MOV"),
  cd("  ├─ [vbg] scale → boxblur(24) ──────────────→ 블러 배경"),
  cd("  └─ [vfg] scale(비율유지) → crop(1080×1280) → 실제 클립"),
  cd("              [bg][fg] overlay(0, y=320)"),
  cd("              eq(채도 1.1 · 명암 1.04 · 밝기 +0.01)    ← Color Grading"),
  cd("              drawbox + drawtext  (스타일 프리셋 적용)   ← 자막 합성"),
  cd("              fade in / fade out  →  [v] 최종 비디오"),
  sp(),

  lbl("▶ 비디오 코덱 설정"),
  bl("libx264 / crf 19: Constant Rate Factor — 품질 기반 가변 비트레이트 (0=무손실 ~ 51=최저)"),
  bl("preset medium: 인코딩 속도와 압축률의 균형점"),
  bl("pix_fmt yuv420p: YCbCr 4:2:0 — 모든 SNS 플랫폼·플레이어 호환"),
  bl("aac 192k: 스트리밍 최적 오디오 포맷"),
  sp(),
);

// ══════════════════════════════════════════════════════════════
// STEP 8. concat + PTS
// ══════════════════════════════════════════════════════════════
C.push(
  div(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "STEP 8 — 클립 연결 : Stream Concat + PTS 처리", font: "Malgun Gothic" })] }),
  p("9개의 장면 MP4를 시간 순서대로 이어붙여 하나의 영상으로 만든다."),
  sp(),
  lbl("▶ PTS(Presentation TimeStamp) 리셋이 필요한 이유"),
  p("각 클립은 자체 내부 타임라인을 갖는다. PTS를 초기화하지 않고 concat하면 플레이어가 타임라인을 혼동해 영상이 건너뛰거나 멈추는 오류가 발생한다."),
  cd("setpts=PTS-STARTPTS    →  각 클립의 비디오 PTS를 0부터 재시작"),
  cd("asetpts=PTS-STARTPTS   →  오디오 스트림도 동일하게 리셋"),
  cd("concat=n=9:v=1:a=1     →  9개 세그먼트, 비디오·오디오 각 1스트림 순서대로 연결"),
  sp(),
);

// ══════════════════════════════════════════════════════════════
// STEP 9. BGM 믹싱
// ══════════════════════════════════════════════════════════════
C.push(
  div(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "STEP 9 — BGM 믹싱 : DSP Audio Mixing", font: "Malgun Gothic" })] }),
  p("연결된 영상의 나레이션 트랙과 BGM MP3를 하나의 오디오 트랙으로 합성해 최종 MP4를 완성한다."),
  sp(),
  lbl("▶ amix 필터 구성"),
  cd("나레이션 TTS  (volume × NARRATION_VOLUME)  ──┐"),
  cd("                                               amix  →  최종 오디오"),
  cd("BGM MP3       (volume × BGM_VOLUME)        ──┘"),
  sp(),
  lbl("▶ 볼륨 환경변수 설정"),
  cd("BGM_VOLUME=0.09         # BGM 9% (배경 분위기 수준)"),
  cd("NARRATION_VOLUME=1.55   # 나레이션 155% (음성이 음악 위에서 명확히 들리도록)"),
  sp(),
  tbl([
    ["파라미터",             "값",      "설계 이유"],
    ["duration=first",       "-",       "나레이션이 끝나면 BGM도 함께 종료 (BGM 길이 무관)"],
    ["dropout_transition=0", "-",       "스트림 종료 시 급격한 볼륨 점프 없이 자연스럽게 처리"],
    ["atrim",                "0~영상길이", "BGM을 영상 길이에 정확히 맞춰 자름 (BGM이 더 길 때)"],
  ], [2800, 1600, 5000]),
  sp(),
);

// ══════════════════════════════════════════════════════════════
// 선택 기능
// ══════════════════════════════════════════════════════════════
C.push(
  div(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "(선택) AI 영상 생성 — Google Veo + Ken Burns 효과", font: "Malgun Gothic" })] }),
  p("실제 촬영본이 없거나 AI 생성 영상이 필요할 때 사용하는 선택적 기능이다."),
  sp(),
  lbl("▶ Image-to-Video 생성 (Google Veo 3.1 Lite)"),
  p("입력 이미지를 첫 프레임으로 고정하고 AI가 이후 장면의 움직임을 생성한다."),
  cd("[실제 촬영 JPG] + [영어 설명 프롬프트]  →  Veo 3.1 Lite  →  [AI 생성 MP4]"),
  sp(),
  lbl("▶ 비동기 Job 패턴"),
  cd("1.  POST /v1/videos          →  { id: 'job-xxx', status: 'pending' }"),
  cd("2.  20초마다 GET /v1/videos/job-xxx"),
  cd("3.                           →  { status: 'completed', unsigned_urls: [...] }"),
  cd("4.  영상 URL에서 다운로드"),
  sp(),
  lbl("▶ Ken Burns 효과 — 정지 이미지 영상화"),
  cd("zoompan=z='min(zoom+0.0015, 1.08)':d=150:s=1080x1920:fps=30"),
  bl("매 프레임 줌 +0.15%, 최대 108%까지 서서히 확대"),
  bl("150프레임(5초) 기준으로 자연스러운 당기는 속도"),
  bl("-loop 1: 정지 이미지를 동영상처럼 반복 읽기"),
  sp(),
);

// ── 전체 요약 표 ──────────────────────────────────────────────
C.push(
  div(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "전체 기술 스택 요약", font: "Malgun Gothic" })] }),
  tbl([
    ["실행 순서", "기술",                              "확정 모델 / 도구",                       "설계 요구사항"],
    ["STEP 1", "Model Router",                         "OpenRouter + Gemini 2.5 Flash Lite",    "✔ 확정"],
    ["STEP 2", "ffmpeg Fast Seek 프레임 추출",          "ffmpeg + ffprobe",                       "-"],
    ["STEP 3", "Prompt Engineering",                   "Structured Output · Hallucination 억제", "-"],
    ["STEP 4", "Vision-Language Model",                "Gemini 2.5 Flash Lite",                  "✔ 확정"],
    ["STEP 5", "LLM + Chain of Models",                "Qwen3.6 Flash",                          "-"],
    ["STEP 6", "Neural TTS (추상화 레이어)",            "openrouter / edge / piper / kokoro",     "📌 엔진 전환 + 목소리 설정 파일"],
    ["STEP 7", "ffmpeg Filter Graph + 자막 스타일",    "libx264 · drawtext",                     "📌 box / bold / highlight 프리셋"],
    ["STEP 8", "Stream Concat + PTS 리셋",             "ffmpeg concat 필터",                     "-"],
    ["STEP 9", "DSP Audio Mixing",                     "ffmpeg amix · atrim · volume",           "-"],
    ["(선택)", "Video Generation + Ken Burns",         "Google Veo 3.1 Lite · zoompan",          "-"],
  ], [1500, 2800, 3000, 2100]),
  sp(),
);

// ══════════════════════════════════════════════════════════════
const doc = new Document({
  numbering: {
    config: [{
      reference: "bullets",
      levels: [
        { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 480, hanging: 280 } } } },
        { level: 1, format: LevelFormat.BULLET, text: "–", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 900, hanging: 280 } } } },
      ],
    }],
  },
  styles: {
    default: { document: { run: { font: "Malgun Gothic", size: 22 } } },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 38, bold: true, font: "Malgun Gothic", color: BLUE },
        paragraph: { spacing: { before: 400, after: 160 }, outlineLevel: 0 },
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
    children: C,
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("C:\\Users\\hyper\\Downloads\\models\\AI_숏폼_구현기술_최종.docx", buf);
  console.log("Done: AI_숏폼_구현기술_최종.docx");
});
