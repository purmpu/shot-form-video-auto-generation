const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, LevelFormat, BorderStyle, WidthType,
  ShadingType, VerticalAlign,
} = require("docx");
const fs = require("fs");

// ── 색상 팔레트 ───────────────────────────────────────────────
const BLUE    = "1F4E79";
const LBLUE   = "2E75B6";
const ACCENT  = "D5E8F0";
const CODEBG  = "F2F2F2";
const GRAY    = "595959";
const BORDER  = "CCCCCC";
const GREEN   = "375623";
const LGREENB = "E2EFDA";

// ── 페이지 설정 ───────────────────────────────────────────────
const PAGE_W = 12240, PAGE_H = 15840, MARGIN = 1440, CONTENT_W = PAGE_W - MARGIN * 2;

// ── 테두리 헬퍼 ───────────────────────────────────────────────
const bd  = (c = BORDER) => ({ style: BorderStyle.SINGLE, size: 1, color: c });
const bds = (c = BORDER) => ({ top: bd(c), bottom: bd(c), left: bd(c), right: bd(c) });

// ── 단락 헬퍼 ────────────────────────────────────────────────
const spacer = () => new Paragraph({ spacing: { after: 100 }, children: [] });

const divider = () => new Paragraph({
  spacing: { before: 240, after: 240 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LBLUE, space: 1 } },
  children: [],
});

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, font: "Malgun Gothic", size: 22, color: "1A1A1A", ...opts })],
  });
}

function pMixed(runs) {
  return new Paragraph({
    spacing: { after: 120 },
    children: runs.map(r =>
      new TextRun({ font: r.code ? "Courier New" : "Malgun Gothic", size: r.code ? 20 : 22, color: "1A1A1A", ...r })
    ),
  });
}

function bullet(text, level = 0, bold = false) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { after: 80 },
    children: [new TextRun({ text, font: "Malgun Gothic", size: 22, bold, color: "1A1A1A" })],
  });
}

function sub(text) {
  // 들여쓰기 된 설명 (불릿 2레벨)
  return bullet(text, 1);
}

function code(text) {
  return new Paragraph({
    spacing: { before: 40, after: 40 },
    shading: { fill: CODEBG, type: ShadingType.CLEAR },
    indent: { left: 360, right: 360 },
    children: [new TextRun({ text, font: "Courier New", size: 20, color: "1A1A1A" })],
  });
}

function label(text) {
  return new Paragraph({
    spacing: { before: 160, after: 80 },
    children: [new TextRun({ text, font: "Malgun Gothic", size: 21, bold: true, color: LBLUE })],
  });
}

// ── 표 헬퍼 ──────────────────────────────────────────────────
function makeTable(rows, colWidths, headerBg = ACCENT) {
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: rows.map((row, ri) =>
      new TableRow({
        children: row.map((text, ci) =>
          new TableCell({
            width: { size: colWidths[ci], type: WidthType.DXA },
            borders: bds(BORDER),
            shading: {
              fill: ri === 0 ? headerBg : "FFFFFF",
              type: ShadingType.CLEAR,
            },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({
              children: [new TextRun({
                text,
                font: "Malgun Gothic",
                size: ri === 0 ? 21 : 20,
                bold: ri === 0,
                color: ri === 0 ? BLUE : "1A1A1A",
              })],
            })],
          })
        ),
      })
    ),
  });
}

// ══════════════════════════════════════════════════════════════
//  문서 콘텐츠
// ══════════════════════════════════════════════════════════════
const children = [];

// ── 표지 ─────────────────────────────────────────────────────
children.push(
  new Paragraph({
    spacing: { before: 1440, after: 480 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "AI 숏폼 영상 생성 파이프라인", font: "Malgun Gothic", size: 60, bold: true, color: BLUE })],
  }),
  new Paragraph({
    spacing: { after: 200 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "구현 기술 상세 설명", font: "Malgun Gothic", size: 40, color: GRAY })],
  }),
  new Paragraph({
    spacing: { after: 160 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "천라쿵푸 마라탕 홍보 영상 자동화 — 전공자 기술 문서", font: "Malgun Gothic", size: 24, color: GRAY })],
  }),
  divider(),
  spacer(),
);

// ── 파이프라인 개요 표 ────────────────────────────────────────
children.push(
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "파이프라인 전체 개요", font: "Malgun Gothic" })] }),
  makeTable([
    ["단계", "기술 분류", "사용 모델 / 도구"],
    ["① 프레임 추출",   "영상 처리",             "ffmpeg (fast seek)"],
    ["② 장면 분석",     "Vision-Language Model", "Gemini 2.5 Flash Lite"],
    ["③ 대본 생성",     "Large Language Model",  "Qwen3.6 Flash"],
    ["④ 음성 합성",     "Neural TTS",            "Grok TTS / Edge TTS (Azure Neural)"],
    ["⑤ 클립 렌더링",  "ffmpeg Filter Graph",   "libx264 + drawtext + eq"],
    ["⑥ 클립 연결",    "Stream Concat",          "ffmpeg concat + PTS 리셋"],
    ["⑦ BGM 믹싱",    "DSP Audio Mixing",        "ffmpeg amix"],
    ["⑧ (선택) 영상생성", "Video Generation",    "Google Veo 3.1 Lite"],
  ], [2200, 3200, 4000]),
  spacer(),
);

// ══════════════════════════════════════════════════════════════
//  1. Multimodal AI — VLM
// ══════════════════════════════════════════════════════════════
children.push(
  divider(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "1. Multimodal AI — Vision-Language Model (VLM)", font: "Malgun Gothic" })] }),
  p("VLM은 이미지와 텍스트를 동시에 입력받아 텍스트를 출력하는 AI 모델이다. 기존 LLM이 텍스트 토큰만 처리했다면, VLM은 이미지 픽셀 데이터를 언어 토큰과 같은 임베딩 공간에 투영해 함께 처리한다."),
  spacer(),
  label("▶ 내부 작동 원리"),
  p("이미지를 Vision Encoder (보통 ViT: Vision Transformer)로 패치 단위 임베딩으로 변환한 뒤, LLM의 어텐션 레이어에 텍스트 토큰과 함께 주입한다. 이를 통해 모델이 시각 정보를 자연어로 설명할 수 있게 된다."),
  code("[MOV 영상] → ffmpeg → [JPG 프레임] → Base64 인코딩"),
  code("    → OpenRouter API → Gemini VLM"),
  code("    → JSON { scene_summary, detected_food, keywords, caption_candidate }"),
  spacer(),
  label("▶ 이 프로젝트에서 사용한 모델"),
  makeTable([
    ["모델", "용도", "특징"],
    ["google/gemini-2.5-flash-lite", "주력 Vision 분석", "경량·고속, 음식 장면 인식 우수"],
    ["openai/gpt-4o-mini",           "비교 실험용",      "범용 VLM, 광범위한 학습 데이터"],
    ["qwen/qwen2.5-vl-72b-instruct", "비교 실험용",      "72B 대형 모델, 세밀한 장면 묘사"],
  ], [3500, 2800, 3100]),
  spacer(),
  label("▶ 왜 영상 전체가 아닌 단일 프레임인가?"),
  bullet("비용: 영상 전체 전송 시 토큰 급증 → 단일 프레임 1장으로 핵심 정보 충분히 파악 가능"),
  bullet("속도: Base64 이미지 1장(~수십 KB) << 영상 파일 전체(수십 MB)"),
  bullet("충분성: 홍보 영상의 각 장면은 정적 구성이므로 대표 프레임 1장으로 장면 설명 가능"),
  spacer(),
  label("▶ Base64 Data URL 인코딩"),
  p("로컬 파일은 외부 API에서 접근 불가하므로 파일 전체를 Base64로 직렬화해 HTTP Body에 포함시킨다."),
  code("data:image/jpeg;base64,/9j/4AAQSkZJRgAB...  (이미지 바이너리 전체를 ASCII로 인코딩)"),
  spacer(),
);

// ══════════════════════════════════════════════════════════════
//  2. Chain of Models
// ══════════════════════════════════════════════════════════════
children.push(
  divider(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "2. LLM 기반 대본 생성 — Chain of Models 패턴", font: "Malgun Gothic" })] }),
  p("한 AI 모델의 출력을 다음 AI 모델의 입력으로 연결하는 파이프라인 구조다. 단일 모델에 모든 것을 맡기지 않고 각 모델이 역할을 분담한다."),
  code("[VLM: 시각 분석]  ──JSON──→  [LLM: 대본 생성]"),
  code("  Gemini 2.5 Flash Lite          Qwen3.6 Flash"),
  code("  \"무엇이 보이는가\"              \"어떤 말로 표현할 것인가\""),
  spacer(),
  label("▶ 역할 분리의 이유"),
  bullet("VLM은 이미지 해석에 특화되어 있지만 마케팅 문구 생성은 일반 LLM이 더 뛰어남"),
  bullet("두 단계로 나누면 실패 지점이 격리되어 디버깅과 모델 교체가 용이함"),
  bullet("VLM 결과를 JSON으로 고정해두면 대본 모델을 독립적으로 실험하거나 교체 가능"),
  spacer(),
  label("▶ Structured Output (JSON 강제 출력)"),
  p("LLM에게 자유 형식 텍스트 대신 JSON 스키마를 프롬프트로 명시해 구조화된 출력을 유도한다. 현재 AI 파이프라인 설계의 표준 기법이다."),
  code("\"출력 JSON: { scene: 1, title: '10자 이내', subtitle: '18자 이내', narration: '18자 이내' }\""),
  code("\"JSON 외 텍스트는 출력하지 마라.\""),
  spacer(),
  label("▶ LLM JSON 파싱 방어 전략"),
  p("LLM이 JSON을 100% 따르지 않는 3가지 실패 패턴과 대응:"),
  makeTable([
    ["실패 패턴", "대응 방법"],
    ["```json\\n{...}\\n```  마크다운 코드블록 감싸기", "Regex로 코드블록 펜스 제거 후 파싱"],
    ["{...}  순수 JSON", "json.loads() 직접 파싱"],
    ["\"물론입니다. {...}\"  앞뒤 설명 텍스트 추가", "re.search(r'\\{.*\\}', DOTALL)로 JSON 블록만 추출"],
  ], [5000, 4400]),
  spacer(),
);

// ══════════════════════════════════════════════════════════════
//  3. Neural TTS
// ══════════════════════════════════════════════════════════════
children.push(
  divider(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "3. Neural TTS (신경망 음성 합성)", font: "Malgun Gothic" })] }),
  p("TTS(Text-to-Speech)는 텍스트를 음성 파형으로 변환하는 기술이다. 전통적인 규칙 기반 TTS와 달리 신경망 TTS는 실제 사람 음성 데이터를 학습해 자연스러운 억양과 감정 표현이 가능하다."),
  spacer(),
  label("▶ Edge TTS — Microsoft Azure Neural TTS"),
  p("Microsoft Azure의 신경망 TTS 서비스를 Edge 브라우저 엔진의 WebSocket API를 통해 호출한다."),
  bullet("모델 구조: Transformer 기반 음향 모델(Acoustic Model) + Vocoder (WaveNet 계열)"),
  sub("Acoustic Model: 텍스트 → 멜 스펙트로그램 (주파수 특성 시퀀스)"),
  sub("Vocoder: 멜 스펙트로그램 → 실제 오디오 파형 생성"),
  bullet("한국어 음성: ko-KR-SunHiNeural — 신경망이 학습한 자연스러운 억양 패턴"),
  bullet("파라미터 제어: rate +12% (발화 속도 12% 가속), pitch +20Hz (기본 피치보다 높여 경쾌한 톤)"),
  bullet("출력: MP3 오디오 파일"),
  spacer(),
  label("▶ OpenRouter Grok TTS"),
  p("xAI의 Grok 음성 모델을 OpenRouter를 통해 API로 호출한다."),
  bullet("모델: x-ai/grok-voice-tts-1.0 / 목소리: Rex (남성, 영어 기반)"),
  bullet("Fallback URL 패턴: /v1/audio/speech → /v1/tts 두 엔드포인트 순차 시도"),
  sub("404 / 405 응답: URL 자체가 잘못된 것 → 다음 URL로 재시도"),
  sub("401 / 429 / 500 응답: URL 문제가 아님 → 즉시 중단하고 에러 발생"),
  spacer(),
  label("▶ TTS 길이 불확실성 문제와 해결"),
  p("TTS는 같은 텍스트라도 모델에 따라 출력 오디오 길이가 다르다. 이를 해결하기 위해 TTS 생성 후 ffprobe로 실제 길이를 측정하고, 그에 맞춰 영상 장면 길이를 동적으로 결정한다."),
  code("장면 길이 = max(4.0초, min(5.4초, TTS 실제 길이 + 0.55초 여백))"),
  bullet("TTS가 3.9초 → max(4.0, min(5.4, 4.45)) = 4.45초"),
  bullet("TTS가 5.0초 → max(4.0, min(5.4, 5.55)) = 5.4초 (상한 클램핑)"),
  spacer(),
);

// ══════════════════════════════════════════════════════════════
//  4. OpenRouter
// ══════════════════════════════════════════════════════════════
children.push(
  divider(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "4. OpenRouter — AI 모델 게이트웨이", font: "Malgun Gothic" })] }),
  p("OpenRouter는 여러 AI 회사의 모델을 단일 API 엔드포인트로 통합한 서비스다. OpenAI API 호환 포맷을 사용하므로 모델 전환 시 코드 변경이 거의 없다."),
  code("[코드] → POST https://openrouter.ai/api/v1/chat/completions"),
  code("              ↓ OpenRouter 내부 라우팅"),
  code("   Gemini (Google) | Qwen (Alibaba) | GPT-4o (OpenAI) | Grok (xAI)"),
  spacer(),
  label("▶ 이 프로젝트에서 사용하는 OpenRouter 기능"),
  makeTable([
    ["기능",       "엔드포인트",         "모델"],
    ["Vision 분석", "/v1/chat/completions", "google/gemini-2.5-flash-lite"],
    ["대본 생성",   "/v1/chat/completions", "qwen/qwen3.6-flash"],
    ["TTS",        "/v1/audio/speech",     "x-ai/grok-voice-tts-1.0"],
    ["영상 생성(선택)", "/v1/videos",      "google/veo-3.1-lite"],
  ], [2400, 3600, 3400]),
  spacer(),
  label("▶ 왜 직접 각 회사 API를 쓰지 않는가?"),
  bullet("단일 API 키, 단일 엔드포인트 → 여러 회사 계정 관리 불필요"),
  bullet("모델 교체 시 model 파라미터만 바꾸면 됨 → 실험이 빠름"),
  bullet("Usage 및 비용 모니터링이 한 곳에서 가능"),
  spacer(),
);

// ══════════════════════════════════════════════════════════════
//  5. ffmpeg Filter Graph
// ══════════════════════════════════════════════════════════════
children.push(
  divider(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "5. ffmpeg Filter Graph — 영상 처리 파이프라인", font: "Malgun Gothic" })] }),
  p("ffmpeg의 filter_complex는 여러 입력 스트림을 DAG(Directed Acyclic Graph) 형태로 연결해 복잡한 영상·오디오 처리를 하나의 명령으로 수행하는 기술이다."),
  spacer(),
  label("▶ 세로 숏폼 변환 레이아웃 (9:16 포맷)"),
  p("원본 촬영본(다양한 비율)을 쇼츠/릴스/틱톡 표준 해상도인 1080×1920으로 변환한다."),
  code("원본 MOV"),
  code("  ├─ [vbg] scale → boxblur(24) ───────────────→ 블러 처리된 배경"),
  code("  └─ [vfg] scale(비율유지) → crop(1080×1280) → 실제 클립"),
  code("                [bg][fg] overlay(0, y=320)     → 캔버스 합성"),
  code("                eq(채도·명암·밝기 보정)"),
  code("                drawtext × 2 (헤드라인 + 자막)"),
  code("                fade in / out"),
  spacer(),
  label("▶ 각 필터 기술 설명"),
  makeTable([
    ["필터",                  "역할",                           "파라미터 의미"],
    ["color=s=1080x1920",    "검정 캔버스 생성",                "쇼츠 표준 세로 해상도 기준점"],
    ["scale + crop",         "비율 유지 리사이즈 후 크롭",       "force_original_aspect_ratio=increase → 넘치게 키운 후 정확히 잘라냄"],
    ["overlay=0:320",        "캔버스 위에 클립 배치",            "y=320: 상단 320px을 헤드라인 영역으로 확보"],
    ["eq",                   "색 보정 (Color Grading)",         "채도 1.1, 명암 1.04, 밝기 +0.01 → 음식이 더 먹음직스럽게"],
    ["drawbox",              "자막 배경 박스",                   "color=black@0.76: 반투명 검정박스로 자막 가독성 확보"],
    ["drawtext",             "폰트 텍스트 렌더링",               "malgunbd.ttf 한글 볼드, borderw=4 외곽선, x=(w-text_w)/2 중앙 정렬"],
    ["fade",                 "페이드 인/아웃",                   "장면 전환 시 부드러운 블랙 페이드"],
  ], [2400, 2600, 4400]),
  spacer(),
  label("▶ 비디오 코덱 — H.264 (libx264)"),
  bullet("libx264: 현재 가장 널리 지원되는 H.264 오픈소스 인코더"),
  bullet("preset medium: 인코딩 속도와 압축률의 균형점 (slow→더 작은 파일, fast→더 빠름)"),
  bullet("crf 19: Constant Rate Factor — 품질 기반 가변 비트레이트 인코딩 (0=무손실, 51=최저품질)"),
  bullet("pix_fmt yuv420p: YCbCr 4:2:0 크로마 서브샘플링 — SNS 플랫폼 및 모든 플레이어 호환"),
  spacer(),
  label("▶ PTS (Presentation TimeStamp) 처리"),
  p("각 클립은 자체 내부 타임라인을 갖는다. 9개 클립을 이어붙일 때 PTS를 초기화하지 않으면 플레이어가 재생 타임라인을 혼동해 영상이 건너뛰거나 멈추는 오류가 발생한다."),
  code("setpts=PTS-STARTPTS  →  각 스트림의 PTS를 0부터 재시작"),
  code("concat=n=9:v=1:a=1   →  9개 세그먼트, 비디오 1스트림 + 오디오 1스트림 연결"),
  spacer(),
  label("▶ 오디오 코덱 — AAC"),
  bullet("aac -b:a 192k: Advanced Audio Coding 192kbps — 스트리밍·SNS 업로드 최적 포맷"),
  spacer(),
);

// ══════════════════════════════════════════════════════════════
//  6. Audio Mixing
// ══════════════════════════════════════════════════════════════
children.push(
  divider(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "6. Audio Mixing — amix 필터 (DSP)", font: "Malgun Gothic" })] }),
  p("나레이션 MP3와 BGM MP3를 하나의 오디오 트랙으로 합성하는 디지털 신호 처리(DSP) 기술이다."),
  code("나레이션 TTS (volume × 1.55) ──┐"),
  code("                                amix → 최종 오디오 트랙"),
  code("BGM MP3      (volume × 0.09) ──┘"),
  spacer(),
  label("▶ amix 필터 파라미터 설명"),
  makeTable([
    ["파라미터",            "값",      "의미"],
    ["나레이션 volume",     "1.55",    "155%로 증폭 — 음악 위에서 음성이 명확히 들리도록"],
    ["BGM volume",         "0.09",    "9%로 감쇄 — 배경음으로 깔리는 수준"],
    ["duration=first",     "-",       "첫 번째 입력(나레이션)이 끝나면 믹싱 종료"],
    ["dropout_transition", "0",       "스트림 종료 시 급격한 볼륨 변화 없음"],
    ["atrim",              "0~영상길이", "BGM을 영상 길이에 정확히 맞춰 자름"],
  ], [2800, 1600, 5000]),
  spacer(),
  label("▶ 환경변수 기반 볼륨 제어"),
  p("볼륨 값은 환경변수로 외부 주입받아 코드 수정 없이 조절 가능하다. 12-factor app의 Configuration 원칙을 따른다."),
  code("$env:BGM_VOLUME=\"0.035\"       # BGM 3.5%"),
  code("$env:NARRATION_VOLUME=\"1.7\"   # 나레이션 170%"),
  spacer(),
);

// ══════════════════════════════════════════════════════════════
//  7. Image-to-Video (Veo)
// ══════════════════════════════════════════════════════════════
children.push(
  divider(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "7. Image-to-Video 생성 — Google Veo (선택 기능)", font: "Malgun Gothic" })] }),
  p("run_role_video_pipeline.py에 구현된 선택적 기능으로, 실제 촬영본이 없거나 AI 생성 영상이 필요할 때 사용한다."),
  spacer(),
  label("▶ Video Generation Model"),
  p("Google Veo 3.1 Lite는 텍스트 프롬프트 또는 이미지+프롬프트를 입력받아 영상을 생성하는 확산(Diffusion) 기반 영상 생성 모델이다."),
  spacer(),
  label("▶ Image-to-Video (I2V) 방식"),
  p("입력 이미지를 첫 프레임으로 고정하고, AI가 이후 장면의 움직임을 생성한다."),
  code("[실제 촬영 JPG 프레임] + [영어 설명 프롬프트]"),
  code("         ↓"),
  code("  Veo 3.1 Lite  →  [AI 생성 MP4 영상]"),
  spacer(),
  label("▶ 비동기 Job 패턴"),
  p("영상 생성은 수 분이 걸리므로 동기 HTTP 요청으로 처리할 수 없다. REST API 표준 비동기 패턴을 따른다."),
  code("1. POST /v1/videos  →  { \"id\": \"job-xxx\", \"status\": \"pending\" }"),
  code("2. 20초마다 GET /v1/videos/job-xxx  →  { \"status\": \"processing\" }"),
  code("3.                                 →  { \"status\": \"completed\", \"unsigned_urls\": [...] }"),
  code("4. 영상 URL에서 다운로드"),
  bullet("unsigned_urls: presigned URL 없이 임시 접근 가능한 다운로드 URL"),
  bullet("failed / cancelled / expired 상태 감지 시 즉시 RuntimeError 발생"),
  spacer(),
);

// ══════════════════════════════════════════════════════════════
//  8. Ken Burns
// ══════════════════════════════════════════════════════════════
children.push(
  divider(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "8. Ken Burns 효과 — zoompan 필터", font: "Malgun Gothic" })] }),
  p("Ken Burns 효과는 사진 다큐멘터리에서 유래한 기법으로, 정지 이미지에 서서히 확대·이동하는 움직임을 주어 생동감을 부여한다. 실제 촬영본이 없는 장면에 적용된다."),
  code("zoompan=z='min(zoom+0.0015, 1.08)':d=150:s=1080x1920:fps=30"),
  spacer(),
  label("▶ 파라미터 해석"),
  makeTable([
    ["파라미터",               "값",           "의미"],
    ["z='min(zoom+0.0015, 1.08)'", "수식",     "매 프레임마다 줌 +0.15%, 최대 108%까지 확대"],
    ["d=150",                  "150프레임",    "5초(30fps) 기준으로 자연스러운 확대 속도"],
    ["s=1080x1920",            "해상도",       "세로 숏폼 표준 해상도"],
    ["-loop 1",                "입력 옵션",    "정지 이미지를 영상처럼 반복 읽기"],
  ], [3000, 2200, 4200]),
  spacer(),
);

// ══════════════════════════════════════════════════════════════
//  9. Prompt Engineering
// ══════════════════════════════════════════════════════════════
children.push(
  divider(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "9. Prompt Engineering 기법", font: "Malgun Gothic" })] }),
  spacer(),
  label("▶ Structured Output Prompting"),
  p("LLM에게 출력 포맷을 JSON 스키마로 명시해 파싱 가능한 구조화 데이터를 얻는 기법. 현재 AI 애플리케이션 설계의 핵심 패턴이다."),
  code("\"출력 JSON: { scene: 1, title: '10자 이내', subtitle: '18자 이내' }\""),
  code("\"JSON 외 텍스트는 출력하지 마라.\""),
  spacer(),
  label("▶ Hallucination 억제"),
  p("AI가 없는 것을 있다고 생성하는 Hallucination을 방지하는 3가지 기법을 적용한다."),
  bullet("불확실성 명시 요구: \"확실하지 않은 메뉴는 '추정'이라고 표현하라\""),
  bullet("컨텍스트 격리: \"파일명을 모른다고 가정하고 이미지 자체만 판단하라\" → 선입견 차단"),
  bullet("금지 규칙 명시: \"누수 없음, 위생 확실 등 직접 보이지 않는 표현 금지\""),
  spacer(),
  label("▶ Length Constraint Prompting"),
  p("다운스트림 시스템(TTS)의 물리적 제약을 업스트림 LLM 프롬프트에 직접 반영하는 기법이다."),
  code("\"나레이션은 Edge TTS로 4초 안에 읽을 수 있도록 18자 내외의 짧은 한국어 문장\""),
  bullet("한국어 기준 4초 ≈ 16~18자 (평균 발화 속도 약 4~4.5자/초)"),
  bullet("LLM이 이 제약을 어길 경우 하드 트림([:18] 슬라이싱)으로 강제 처리"),
  spacer(),
  label("▶ Tone Directive Prompting"),
  p("출력 문체와 스타일을 명시적으로 지정한다."),
  code("\"자막 스타일은 참고 쇼츠처럼 상단 대제목과 하단 짧은 자막 구조로\""),
  code("\"subtitle과 narration은 반드시 같은 문장으로 작성한다\""),
  code("\"과한 정보 나열보다 음식 비주얼, 신선함, 방문 유도 흐름을 우선한다\""),
  spacer(),
);

// ══════════════════════════════════════════════════════════════
//  10. Multimodel Benchmark
// ══════════════════════════════════════════════════════════════
children.push(
  divider(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "10. 멀티모델 벤치마킹 인프라", font: "Malgun Gothic" })] }),
  p("inspect_vision_models.py는 동일한 입력을 여러 VLM에 전송하고 결과를 비교하는 자동화된 모델 평가 시스템이다."),
  code("동일 이미지 + 동일 프롬프트"),
  code("  ├── Gemini 2.5 Flash Lite  → 결과 A"),
  code("  ├── GPT-4o mini            → 결과 B"),
  code("  └── Qwen2.5 VL 72B        → 결과 C"),
  code("            ↓"),
  code("  CSV + Markdown 비교 리포트 자동 생성"),
  spacer(),
  label("▶ LLM-as-Judge 패턴"),
  p("description_match 필드는 LLM 스스로 자신의 출력이 정답(사용자 설명)과 일치하는지 판단하게 하는 LLM-as-Judge 패턴의 단순 구현이다."),
  bullet("LLM에게 \"내 분석 결과가 사용자의 설명과 일치하는가?\" 를 함께 판단하도록 요청"),
  bullet("불일치 시 mismatch_reason 필드에 이유를 서술 → 자동 품질 검증"),
  spacer(),
  label("▶ 부분 실패 허용 설계 (Graceful Degradation)"),
  bullet("한 모델이 API 오류 또는 JSON 파싱 실패해도 해당 결과만 에러로 기록"),
  bullet("나머지 모델의 결과는 정상적으로 저장되어 비교 데이터 손실 최소화"),
  spacer(),
);

// ══════════════════════════════════════════════════════════════
//  최종 요약 표
// ══════════════════════════════════════════════════════════════
children.push(
  divider(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "전체 기술 스택 요약", font: "Malgun Gothic" })] }),
  makeTable([
    ["영역",          "기술",                         "구체적 모델/도구"],
    ["시각 AI",       "Vision-Language Model (VLM)",  "Gemini 2.5 Flash Lite"],
    ["언어 AI",       "Large Language Model (LLM)",   "Qwen3.6 Flash"],
    ["음성 합성",     "Neural TTS",                   "MS Azure Neural (Edge TTS), Grok TTS"],
    ["영상 생성",     "Diffusion / Video Gen",         "Google Veo 3.1 Lite"],
    ["AI 게이트웨이", "Model Router",                  "OpenRouter"],
    ["영상 처리",     "Filter Graph 기반 인코더",      "ffmpeg (libx264, AAC)"],
    ["오디오 믹싱",   "DSP 필터",                     "ffmpeg amix, atrim, volume"],
    ["색 보정",       "Color Grading",                "ffmpeg eq 필터"],
    ["자막 렌더링",   "폰트 래스터라이징",             "ffmpeg libavfilter drawtext"],
    ["영상 효과",     "Ken Burns (Pan & Zoom)",        "ffmpeg zoompan 필터"],
    ["파이프라인",    "Chain of Models",               "VLM → LLM → TTS → ffmpeg"],
    ["프롬프트 설계", "Structured Output, LLM-as-Judge", "JSON 스키마 강제, Hallucination 억제"],
  ], [2200, 3400, 3800]),
  spacer(),
);

// ══════════════════════════════════════════════════════════════
//  Document 조립
// ══════════════════════════════════════════════════════════════
const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          {
            level: 0, format: LevelFormat.BULLET, text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 480, hanging: 280 } } },
          },
          {
            level: 1, format: LevelFormat.BULLET, text: "–",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 900, hanging: 280 } } },
          },
        ],
      },
    ],
  },
  styles: {
    default: {
      document: { run: { font: "Malgun Gothic", size: 22 } },
    },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 38, bold: true, font: "Malgun Gothic", color: BLUE },
        paragraph: { spacing: { before: 400, after: 160 }, outlineLevel: 0 },
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
  fs.writeFileSync("C:\\Users\\hyper\\Downloads\\models\\AI_숏폼_구현기술_설명.docx", buf);
  console.log("Done: AI_숏폼_구현기술_설명.docx");
});
