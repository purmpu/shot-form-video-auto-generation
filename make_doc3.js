const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, LevelFormat, BorderStyle, WidthType,
  ShadingType, VerticalAlign,
} = require("docx");
const fs = require("fs");

// ── 색상 ─────────────────────────────────────────────────────
const BLUE   = "1F4E79";
const LBLUE  = "2E75B6";
const ACCENT = "D5E8F0";
const CODEBG = "F2F2F2";
const GRAY   = "595959";
const BORDER = "CCCCCC";

// ── 페이지 ───────────────────────────────────────────────────
const PAGE_W = 12240, PAGE_H = 15840, MARGIN = 1440, CW = PAGE_W - MARGIN * 2;

// ── 테두리 헬퍼 ───────────────────────────────────────────────
const bd  = (c = BORDER) => ({ style: BorderStyle.SINGLE, size: 1, color: c });
const bds = (c = BORDER) => ({ top: bd(c), bottom: bd(c), left: bd(c), right: bd(c) });

// ── 단락 헬퍼 ────────────────────────────────────────────────
const sp = () => new Paragraph({ spacing: { after: 100 }, children: [] });

const div = () => new Paragraph({
  spacing: { before: 240, after: 240 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LBLUE, space: 1 } },
  children: [],
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

const sb = (text) => bl(text, 1);

// ── 표 헬퍼 ──────────────────────────────────────────────────
const tbl = (rows, cols) => new Table({
  width: { size: CW, type: WidthType.DXA },
  columnWidths: cols,
  rows: rows.map((row, ri) => new TableRow({
    children: row.map((text, ci) => new TableCell({
      width: { size: cols[ci], type: WidthType.DXA },
      borders: bds(BORDER),
      shading: { fill: ri === 0 ? ACCENT : "FFFFFF", type: ShadingType.CLEAR },
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
const C = [];   // children 배열

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
    spacing: { after: 160 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "천라쿵푸 마라탕 홍보 영상 자동화 파이프라인", font: "Malgun Gothic", size: 24, color: GRAY })],
  }),
  div(), sp(),
);

// ── 파이프라인 전체 흐름 요약 ─────────────────────────────────
C.push(
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "파이프라인 실행 흐름 전체 개요", font: "Malgun Gothic" })] }),
  tbl([
    ["실행 순서", "기술 분류", "모델 / 도구", "출력물"],
    ["① API 게이트웨이 준비", "Model Router", "OpenRouter", "API 키 + 엔드포인트"],
    ["② 프레임 추출",         "영상 처리",   "ffmpeg fast seek", "JPG 프레임 (장면당 1장)"],
    ["③ 프롬프트 설계",       "Prompt Engineering", "수동 설계", "Vision / Script 프롬프트"],
    ["④ VLM 장면 분석",       "Vision-Language Model", "Gemini 2.5 Flash Lite", "장면 분석 JSON"],
    ["⑤ LLM 대본 생성",       "Large Language Model", "Qwen3.6 Flash", "자막·나레이션 대본 JSON"],
    ["⑥ 음성 합성 (TTS)",     "Neural TTS", "Grok TTS / Edge TTS", "나레이션 MP3 (장면당 1개)"],
    ["⑦ 클립 렌더링",         "ffmpeg Filter Graph", "libx264 + drawtext", "장면 MP4 (9개)"],
    ["⑧ 클립 연결",           "Stream Concat + PTS 처리", "ffmpeg concat", "통합 MP4"],
    ["⑨ BGM 믹싱",            "DSP Audio Mixing", "ffmpeg amix", "최종 MP4"],
    ["(선택) 영상 AI 생성",   "Video Generation", "Google Veo 3.1 Lite", "AI 생성 영상"],
  ], [1900, 2200, 2500, 2800]),
  sp(),
);

// ══════════════════════════════════════════════════════════════
//  STEP 1. OpenRouter
// ══════════════════════════════════════════════════════════════
C.push(
  div(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "STEP 1 — OpenRouter : AI 모델 게이트웨이", font: "Malgun Gothic" })] }),
  p("파이프라인에서 Vision 분석·대본 생성·TTS 세 가지 AI 호출이 모두 OpenRouter를 통해 이루어진다. 코드가 실행되면 가장 먼저 API 키를 로드하고 엔드포인트를 확정하는 이 계층이 준비된다."),
  sp(),
  lbl("▶ OpenRouter란?"),
  p("여러 AI 회사의 모델을 단일 API 엔드포인트로 통합한 서비스다. OpenAI API와 완전히 호환되는 포맷을 사용하므로 model 파라미터 하나만 바꾸면 Gemini·Qwen·GPT 등 어떤 모델로도 전환된다."),
  cd("[코드]  →  POST https://openrouter.ai/api/v1/chat/completions"),
  cd("                       ↓ OpenRouter 내부 라우팅"),
  cd("   Gemini (Google)  |  Qwen (Alibaba)  |  GPT-4o (OpenAI)  |  Grok (xAI)"),
  sp(),
  lbl("▶ 이 프로젝트에서 사용하는 엔드포인트"),
  tbl([
    ["용도", "엔드포인트", "모델"],
    ["Vision 장면 분석", "/v1/chat/completions", "google/gemini-2.5-flash-lite"],
    ["대본 생성",        "/v1/chat/completions", "qwen/qwen3.6-flash"],
    ["TTS 음성 합성",    "/v1/audio/speech",     "x-ai/grok-voice-tts-1.0"],
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
//  STEP 2. 프레임 추출
// ══════════════════════════════════════════════════════════════
C.push(
  div(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "STEP 2 — ffmpeg 프레임 추출", font: "Malgun Gothic" })] }),
  p("Vision AI에 전달하기 위해 MOV 영상에서 특정 시각의 정지 프레임 1장을 JPG로 추출한다. 영상 전체를 보내는 대신 대표 프레임 1장만 사용한다."),
  sp(),
  lbl("▶ ffmpeg 명령 구성"),
  cd("ffmpeg -y  -ss {timestamp}  -i source.MOV  -frames:v 1  -q:v 2  frame.jpg"),
  sp(),
  tbl([
    ["옵션", "값", "의미"],
    ["-y",           "-",             "출력 파일 덮어쓰기 — 확인 프롬프트 없이 자동 허용"],
    ["-ss {time}",   "-i 앞에 배치", "Fast Seek: 키프레임 단위로 빠르게 탐색 (-i 뒤에 배치하면 정확하지만 느림)"],
    ["-frames:v 1",  "1프레임",      "비디오 프레임 딱 1장만 추출하고 종료"],
    ["-q:v 2",       "품질 2",       "JPEG VBR 품질 (1=최고화질, 31=최저). 2는 고품질 — Vision AI 인식률에 영향"],
  ], [1800, 2200, 5400]),
  sp(),
  lbl("▶ 왜 영상 전체가 아닌 프레임 1장인가?"),
  bl("비용: 영상 파일 전체를 Base64로 인코딩하면 수십 MB → API 비용·전송 시간 급증"),
  bl("충분성: 홍보 영상 각 장면은 정적 구성이므로 대표 시각 1장으로 장면 설명 가능"),
  bl("속도: Base64 이미지 1장(수십 KB) << 영상 파일 전체(수십 MB)"),
  sp(),
  lbl("▶ Base64 Data URL 인코딩 — API 전달 방식"),
  p("추출한 JPG를 외부 서버에 업로드하지 않고, 파일 전체를 Base64로 직렬화해 HTTP Body에 직접 포함시킨다."),
  cd("data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...   (이미지 바이너리 전체를 ASCII 텍스트로 변환)"),
  sp(),
);

// ══════════════════════════════════════════════════════════════
//  STEP 3. 프롬프트 엔지니어링
// ══════════════════════════════════════════════════════════════
C.push(
  div(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "STEP 3 — Prompt Engineering", font: "Malgun Gothic" })] }),
  p("VLM과 LLM을 호출하기 전에 어떤 방식으로 질문할지를 설계하는 단계다. 같은 모델이라도 프롬프트 설계에 따라 결과 품질이 크게 달라진다."),
  sp(),
  lbl("▶ Structured Output Prompting — JSON 강제 출력"),
  p("LLM에게 자유 형식 텍스트 대신 JSON 스키마를 명시해 파싱 가능한 구조화 데이터를 얻는다. AI 파이프라인 설계의 핵심 패턴이다."),
  cd("\"출력 JSON: { scene: 1, title: '10자 이내', subtitle: '18자 이내', narration: '18자 이내' }\""),
  cd("\"JSON 외 텍스트는 출력하지 마라.\""),
  sp(),
  lbl("▶ Hallucination 억제"),
  p("AI가 사실이 아닌 내용을 생성하는 Hallucination을 방지하기 위한 3가지 기법"),
  bl("불확실성 명시 요구: \"확실하지 않은 메뉴는 '추정'이라고 표현하라\""),
  bl("컨텍스트 격리: \"파일명을 모른다고 가정하고 이미지 자체만 판단하라\" → 선입견 차단"),
  bl("금지 규칙 명시: \"위생 확실, 누수 없음 등 직접 보이지 않는 표현 금지\""),
  sp(),
  lbl("▶ Length Constraint Prompting — TTS 제약 반영"),
  p("다운스트림 시스템(TTS)의 물리적 제약을 업스트림 LLM 프롬프트에 직접 반영한다."),
  cd("\"나레이션은 Edge TTS로 4초 안에 읽을 수 있도록 18자 내외의 짧은 한국어 문장\""),
  bl("한국어 기준 4초 ≈ 16~18자 (평균 발화 속도 약 4~4.5자/초)"),
  bl("LLM이 제약을 어길 경우 하드 트림([:18] 슬라이싱)으로 강제 처리"),
  sp(),
  lbl("▶ Tone Directive Prompting — 문체·스타일 지정"),
  cd("\"subtitle과 narration은 반드시 같은 문장으로 작성한다\""),
  cd("\"과한 정보 나열보다 음식 비주얼, 신선함, 방문 유도 흐름을 우선한다\""),
  cd("\"마지막 장면은 방문 또는 주문 행동을 유도하는 문장으로 마무리한다\""),
  sp(),
);

// ══════════════════════════════════════════════════════════════
//  STEP 4. VLM 장면 분석
// ══════════════════════════════════════════════════════════════
C.push(
  div(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "STEP 4 — VLM 장면 분석 : Vision-Language Model", font: "Malgun Gothic" })] }),
  p("추출한 JPG 프레임을 Gemini Vision에 전달해 장면이 무엇인지 분석한다. 이 결과 JSON이 다음 단계 LLM 대본 생성의 입력이 된다."),
  sp(),
  lbl("▶ VLM이란?"),
  p("이미지와 텍스트를 동시에 입력받아 텍스트를 출력하는 AI 모델이다. 이미지를 Vision Encoder (ViT: Vision Transformer)로 패치 단위 임베딩으로 변환한 뒤, LLM의 어텐션 레이어에 텍스트 토큰과 함께 주입한다."),
  cd("[JPG 프레임] → Base64 → OpenRouter API → Gemini VLM"),
  cd("                                              ↓"),
  cd("{ scene_summary, detected_food, keywords, caption_candidate }"),
  sp(),
  lbl("▶ Vision API 메시지 구조"),
  p("OpenAI 호환 포맷에서 content를 리스트로 구성하면 텍스트와 이미지를 혼합할 수 있다."),
  cd("\"content\": ["),
  cd("  { \"type\": \"text\",      \"text\": \"JSON으로만 출력하라...\" },"),
  cd("  { \"type\": \"image_url\", \"image_url\": { \"url\": \"data:image/jpeg;base64,...\" } }"),
  cd("]"),
  sp(),
  lbl("▶ 멀티모델 벤치마킹 — 어떤 VLM이 더 나은가?"),
  p("inspect_vision_models.py는 동일한 프레임을 3개 VLM에 전송해 결과를 자동으로 비교한다."),
  tbl([
    ["모델", "특징", "비교 목적"],
    ["google/gemini-2.5-flash-lite", "경량·고속, 음식 장면 인식 우수",   "주력 모델로 최종 선정"],
    ["openai/gpt-4o-mini",           "범용 VLM, 광범위한 학습 데이터",    "성능 비교 기준선"],
    ["qwen/qwen2.5-vl-72b-instruct", "72B 대형 모델, 세밀한 장면 묘사",  "고품질 vs 비용 비교"],
  ], [3200, 3200, 2900]),
  p("결과는 CSV + Markdown 리포트로 자동 저장된다. description_match 필드로 LLM 스스로 분석 결과의 정확도를 판단하게 하는 LLM-as-Judge 패턴도 적용한다."),
  sp(),
);

// ══════════════════════════════════════════════════════════════
//  STEP 5. LLM 대본 생성
// ══════════════════════════════════════════════════════════════
C.push(
  div(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "STEP 5 — LLM 대본 생성 : Chain of Models", font: "Malgun Gothic" })] }),
  p("VLM이 생성한 장면 분석 JSON 9개를 한꺼번에 LLM에 넘겨 자막(subtitle)과 나레이션(narration) 대본을 생성한다."),
  sp(),
  lbl("▶ Chain of Models 패턴"),
  p("한 AI 모델의 출력을 다음 AI 모델의 입력으로 연결하는 파이프라인 구조다."),
  cd("[STEP 4: VLM 결과 JSON 9개]  ──────→  [STEP 5: LLM 대본 생성]"),
  cd("   Gemini 2.5 Flash Lite                  Qwen3.6 Flash"),
  cd("   \"무엇이 보이는가\"                     \"어떤 말로 표현할 것인가\""),
  sp(),
  lbl("▶ 왜 역할을 분리하는가?"),
  bl("VLM은 이미지 해석에 특화되어 있으나 마케팅 문구 생성은 일반 LLM이 더 뛰어남"),
  bl("두 단계로 나누면 실패 지점이 격리되어 디버깅·모델 교체가 용이함"),
  bl("VLM 결과를 JSON으로 고정해두면 대본 모델만 독립적으로 교체·실험 가능"),
  sp(),
  lbl("▶ JSON 파싱 방어 전략"),
  p("LLM이 JSON 형식을 100% 따르지 않는 경우를 3단계로 방어한다."),
  tbl([
    ["LLM 출력 패턴", "대응 방법"],
    ["```json\\n{...}\\n```  마크다운 코드블록 감싸기", "Regex로 코드블록 펜스(```) 제거 후 파싱"],
    ["{...}  순수 JSON",                               "json.loads() 직접 파싱"],
    ["\"물론입니다. {...}\"  앞뒤 설명 텍스트 포함",   "re.search(r'\\{.*\\}', DOTALL)로 JSON 블록만 추출"],
  ], [4800, 4600]),
  sp(),
  lbl("▶ 출력 후처리 (clean_scene_payload)"),
  bl("빈 문자열·None 방어: fallback_text()로 폴백 값 자동 대체"),
  bl("하드 트림: LLM이 길이 제한을 무시하면 슬라이싱으로 강제 절단 (title[:18], subtitle[:28])"),
  bl("sync_caption_narration=True: 자막과 나레이션을 완전히 동일하게 강제 → 음성·텍스트 불일치 방지"),
  sp(),
);

// ══════════════════════════════════════════════════════════════
//  STEP 6. Neural TTS
// ══════════════════════════════════════════════════════════════
C.push(
  div(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "STEP 6 — Neural TTS : 음성 합성", font: "Malgun Gothic" })] }),
  p("대본의 narration 텍스트를 MP3 오디오 파일로 변환한다. 장면 9개 각각에 대해 독립적으로 생성한다."),
  sp(),
  lbl("▶ 신경망 TTS 구조"),
  p("전통적인 규칙 기반 TTS와 달리 신경망 TTS는 실제 사람 음성 데이터를 학습해 자연스러운 억양·감정 표현이 가능하다."),
  tbl([
    ["구성 요소", "역할"],
    ["Acoustic Model (Transformer 기반)", "텍스트 → 멜 스펙트로그램 (주파수 특성 시퀀스)"],
    ["Vocoder (WaveNet 계열)",            "멜 스펙트로그램 → 실제 오디오 파형 생성"],
  ], [3800, 5600]),
  sp(),
  lbl("▶ Edge TTS — Microsoft Azure Neural TTS"),
  bl("edge-tts 패키지: MS Edge 브라우저의 TTS 엔진을 역공학해 만든 비공식 Python 라이브러리"),
  sb("내부적으로 MS Azure Speech Service WebSocket API를 사용"),
  bl("ko-KR-SunHiNeural: 신경망이 학습한 자연스러운 한국어 여성 음성"),
  bl("rate +12%: 발화 속도 12% 가속 → 숏폼에 맞게 경쾌하게"),
  bl("pitch +20Hz: 기본 피치보다 20Hz 높임 → 밝고 생동감 있는 톤"),
  sp(),
  lbl("▶ OpenRouter Grok TTS"),
  bl("모델: x-ai/grok-voice-tts-1.0 / 목소리: Rex (남성)"),
  bl("Fallback URL 패턴: /v1/audio/speech → /v1/tts 두 엔드포인트 순차 시도"),
  sb("404 / 405: URL 자체가 잘못된 것 → 다음 URL로 재시도"),
  sb("401 / 429 / 500: URL 문제가 아님 → 즉시 중단"),
  sp(),
  lbl("▶ TTS 길이 불확실성 문제와 해결"),
  p("같은 텍스트라도 TTS 모델마다 출력 오디오 길이가 다르다. 생성 후 ffprobe로 실제 길이를 측정하고 영상 길이를 동적으로 확정한다."),
  cd("장면 길이 = max(4.0초,  min(5.4초,  TTS 실제 길이 + 0.55초 여백))"),
  bl("TTS 3.9초 → max(4.0, min(5.4, 4.45)) = 4.45초"),
  bl("TTS 5.0초 → max(4.0, min(5.4, 5.55)) = 5.4초 (상한 클램핑)"),
  sp(),
);

// ══════════════════════════════════════════════════════════════
//  STEP 7. ffmpeg 클립 렌더링
// ══════════════════════════════════════════════════════════════
C.push(
  div(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "STEP 7 — ffmpeg Filter Graph : 클립 렌더링", font: "Malgun Gothic" })] }),
  p("원본 MOV + TTS MP3를 입력으로 받아 자막이 합성된 장면 MP4를 출력한다. 9개 장면 각각에 대해 독립적으로 실행된다."),
  sp(),
  lbl("▶ Filter Graph DAG 구조"),
  p("ffmpeg의 filter_complex는 여러 스트림을 DAG(Directed Acyclic Graph) 형태로 연결해 복잡한 처리를 한 명령으로 수행한다."),
  cd("원본 MOV"),
  cd("  ├─ [vbg] scale → boxblur(24) ──────────────────→ 블러 배경"),
  cd("  └─ [vfg] scale(비율유지) → crop(1080×1280) ──→ 실제 클립"),
  cd("              [bg][fg] overlay(0, y=320)"),
  cd("              eq(채도 1.1 · 명암 1.04 · 밝기 +0.01)"),
  cd("              drawbox(반투명 자막 배경)"),
  cd("              drawtext × 2 (헤드라인 + 자막)"),
  cd("              fade in / fade out  →  [v] 최종 비디오"),
  sp(),
  lbl("▶ 세로 숏폼 변환 원리 (9:16 포맷)"),
  tbl([
    ["필터", "역할", "핵심 파라미터"],
    ["color=s=1080x1920",      "검정 캔버스 생성",     "쇼츠·릴스·틱톡 표준 세로 해상도"],
    ["scale + crop",           "비율 유지 리사이즈 후 크롭", "force_original_aspect_ratio=increase → 넘치게 확대 후 정확히 잘라냄"],
    ["overlay=0:320",          "캔버스 위 클립 배치",   "y=320: 상단 320px를 헤드라인 영역으로 확보"],
    ["eq",                     "Color Grading",        "채도+10% · 명암+4% · 밝기+1% → 음식이 더 먹음직스럽게"],
    ["drawbox",                "자막 배경 박스",         "color=black@0.76: 반투명 박스로 자막 가독성 확보"],
    ["drawtext",               "폰트 텍스트 렌더링",    "malgunbd.ttf · borderw=4 외곽선 · x=(w-text_w)/2 중앙 정렬"],
    ["fade",                   "페이드 인/아웃",        "장면 시작·끝 0.2초 블랙 페이드"],
  ], [2400, 2200, 4800]),
  sp(),
  lbl("▶ 한글 자막 줄바꿈 처리"),
  p("ffmpeg drawtext는 자동 줄바꿈을 지원하지 않아 직접 구현한다."),
  bl("text_units(): 한글 = 2칸, 영문/숫자 = 1칸으로 너비 계산 → CSS ch 단위와 동일한 개념"),
  bl("wrap_text_for_drawtext(): 그리디 Word-wrapping 알고리즘으로 최대 2줄로 분리"),
  bl("동적 박스 너비: max(글자수 × 25 + 72, 360px), min(상한 1000px) → 텍스트 길이에 맞게 자동 조정"),
  sp(),
  lbl("▶ 비디오 코덱 — H.264 (libx264)"),
  bl("preset medium: 인코딩 속도와 압축률의 균형점"),
  bl("crf 19: Constant Rate Factor — 품질 기반 가변 비트레이트 (0=무손실 ~ 51=최저품질)"),
  bl("pix_fmt yuv420p: YCbCr 4:2:0 크로마 서브샘플링 → 모든 SNS 플랫폼·플레이어 호환"),
  bl("aac 192k: Advanced Audio Coding — 스트리밍 최적 오디오 포맷"),
  sp(),
);

// ══════════════════════════════════════════════════════════════
//  STEP 8. concat + PTS
// ══════════════════════════════════════════════════════════════
C.push(
  div(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "STEP 8 — 클립 연결 : Stream Concat + PTS 처리", font: "Malgun Gothic" })] }),
  p("9개의 장면 MP4를 시간 순서대로 이어붙여 하나의 영상으로 만든다."),
  sp(),
  lbl("▶ PTS(Presentation TimeStamp)란?"),
  p("각 미디어 프레임이 언제 재생되어야 하는지를 나타내는 타임스탬프다. 개별 클립은 자기 내부 시간 기준(0부터 시작하지 않을 수 있음)을 갖는다."),
  sp(),
  lbl("▶ PTS 리셋이 필요한 이유"),
  p("PTS를 초기화하지 않고 concat하면 플레이어가 재생 타임라인을 혼동해 영상이 건너뛰거나 멈추는 오류가 발생한다."),
  cd("setpts=PTS-STARTPTS   →  각 클립의 PTS를 0부터 재시작"),
  cd("asetpts=PTS-STARTPTS  →  오디오 스트림도 동일하게 리셋"),
  cd("concat=n=9:v=1:a=1   →  9개 세그먼트, 비디오 1스트림 + 오디오 1스트림 순서대로 연결"),
  sp(),
);

// ══════════════════════════════════════════════════════════════
//  STEP 9. BGM 믹싱
// ══════════════════════════════════════════════════════════════
C.push(
  div(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "STEP 9 — BGM 믹싱 : DSP Audio Mixing", font: "Malgun Gothic" })] }),
  p("연결된 영상의 나레이션 트랙과 BGM MP3를 하나의 오디오 트랙으로 합성해 최종 MP4를 완성한다."),
  sp(),
  lbl("▶ amix 필터 구성"),
  cd("나레이션 TTS  (volume × 1.55)  ──┐"),
  cd("                                   amix  →  최종 오디오 트랙"),
  cd("BGM MP3       (volume × 0.09)  ──┘"),
  sp(),
  lbl("▶ 파라미터 설계"),
  tbl([
    ["파라미터", "값", "설계 이유"],
    ["나레이션 volume", "1.55 (155%)", "배경음악 위에서 음성이 명확히 들리도록 증폭"],
    ["BGM volume",     "0.09 (9%)",   "배경 분위기만 제공하는 수준으로 감쇄"],
    ["duration=first", "-",           "나레이션이 끝나면 BGM도 함께 종료 (BGM 길이 무관)"],
    ["dropout_transition=0", "-",     "스트림 종료 시 급격한 볼륨 점프 없이 자연스럽게"],
    ["atrim",          "0~영상길이",  "BGM을 영상 길이에 정확히 맞춰 자름"],
  ], [2600, 1800, 5000]),
  sp(),
  lbl("▶ 환경변수 기반 볼륨 제어"),
  p("볼륨 값은 코드 수정 없이 환경변수로 외부 주입해 조절한다. 12-factor app의 Configuration 원칙을 따른다."),
  cd("$env:BGM_VOLUME=\"0.035\"        # BGM 3.5%로 낮춤"),
  cd("$env:NARRATION_VOLUME=\"1.7\"    # 나레이션 170%로 높임"),
  sp(),
);

// ══════════════════════════════════════════════════════════════
//  선택 기능 — AI 영상 생성 / Ken Burns
// ══════════════════════════════════════════════════════════════
C.push(
  div(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "(선택) AI 영상 생성 — Google Veo + Ken Burns 효과", font: "Malgun Gothic" })] }),
  p("실제 촬영본이 없거나 AI 생성 영상이 필요할 때 사용하는 선택적 기능이다. run_role_video_pipeline.py에 구현되어 있다."),
  sp(),
  lbl("▶ Image-to-Video 생성 (Google Veo 3.1 Lite)"),
  p("입력 이미지를 첫 프레임으로 고정하고 AI가 이후 장면의 움직임을 생성하는 확산(Diffusion) 기반 영상 생성 모델이다."),
  cd("[실제 촬영 JPG] + [영어 설명 프롬프트]  →  Veo 3.1 Lite  →  [AI 생성 MP4]"),
  sp(),
  lbl("▶ 비동기 Job 패턴"),
  p("영상 생성은 수 분이 걸리므로 동기 HTTP 요청으로 처리할 수 없다. REST API 표준 비동기 패턴을 따른다."),
  cd("1.  POST /v1/videos          →  { id: 'job-xxx', status: 'pending' }"),
  cd("2.  20초마다 GET /v1/videos/job-xxx"),
  cd("3.                           →  { status: 'completed', unsigned_urls: [...] }"),
  cd("4.  영상 URL에서 다운로드"),
  bl("unsigned_urls: presigned URL 없이 임시 접근 가능한 다운로드 URL"),
  bl("failed / cancelled / expired 상태 감지 시 즉시 RuntimeError 발생"),
  sp(),
  lbl("▶ Ken Burns 효과 — 정지 이미지 영상화"),
  p("촬영본이 없는 장면에 정지 이미지를 사용할 때, 아무 움직임 없이 고정하면 단조롭다. Ken Burns 효과는 사진 다큐멘터리에서 유래한 기법으로 서서히 확대·이동하는 움직임을 준다."),
  cd("zoompan=z='min(zoom+0.0015, 1.08)':d=150:s=1080x1920:fps=30"),
  tbl([
    ["파라미터", "값", "의미"],
    ["z='min(zoom+0.0015, 1.08)'", "수식",       "매 프레임 줌 +0.15%, 최대 108%까지 확대"],
    ["d=150",                      "150프레임",  "5초(30fps) 기준 자연스러운 확대 속도"],
    ["-loop 1",                    "입력 옵션",  "정지 이미지를 동영상처럼 반복 읽기"],
  ], [3200, 1800, 4400]),
  sp(),
);

// ── 전체 기술 스택 요약 표 ────────────────────────────────────
C.push(
  div(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "전체 기술 스택 요약", font: "Malgun Gothic" })] }),
  tbl([
    ["실행 순서", "기술",                           "모델 / 도구"],
    ["STEP 1", "Model Router (AI 게이트웨이)",       "OpenRouter"],
    ["STEP 2", "ffmpeg Fast Seek 프레임 추출",       "ffmpeg + ffprobe"],
    ["STEP 3", "Prompt Engineering",                 "Structured Output · Hallucination 억제 · Length Constraint"],
    ["STEP 4", "Vision-Language Model (VLM)",        "Gemini 2.5 Flash Lite"],
    ["STEP 5", "LLM + Chain of Models",              "Qwen3.6 Flash"],
    ["STEP 6", "Neural TTS (Acoustic Model + Vocoder)", "Grok TTS (Rex) / Azure Neural (SunHi)"],
    ["STEP 7", "ffmpeg Filter Graph + H.264 인코딩", "libx264 · AAC · drawtext · eq · yuv420p"],
    ["STEP 8", "Stream Concat + PTS 리셋",           "ffmpeg concat 필터"],
    ["STEP 9", "DSP Audio Mixing",                   "ffmpeg amix · atrim · volume"],
    ["(선택)", "Video Generation + Ken Burns",       "Google Veo 3.1 Lite · ffmpeg zoompan"],
  ], [1600, 3600, 4200]),
  sp(),
);

// ══════════════════════════════════════════════════════════════
//  Document 조립
// ══════════════════════════════════════════════════════════════
const doc = new Document({
  numbering: {
    config: [{
      reference: "bullets",
      levels: [
        {
          level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 480, hanging: 280 } } },
        },
        {
          level: 1, format: LevelFormat.BULLET, text: "–", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 900, hanging: 280 } } },
        },
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
  fs.writeFileSync("C:\\Users\\hyper\\Downloads\\models\\AI_숏폼_구현기술_실행순서.docx", buf);
  console.log("Done: AI_숏폼_구현기술_실행순서.docx");
});
