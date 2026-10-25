# Style 2 구현 완료 문서

## 🎯 목표
라이브러리 기반 자막 생성으로 **Qwen 호출 제거** → 속도 향상, 품질 일정.
클로즈업 씬만 **VLM** 활용해 감각묘사 단어 추출.

---

## 📋 핵심 변경사항

### 1. 자막 생성 방식 변경
| 씬 | 이전 | 현재 | API 호출 |
|---|---|---|---|
| 대표 메뉴 | Qwen | INTRO_HOOKS 라이브러리 | ❌ |
| 매장 외부 | Qwen | EXTERIOR 라이브러리 | ❌ |
| 매장 내부 | Qwen | INTERIOR 라이브러리 | ❌ |
| 조리 과정 | Qwen | COOKING 라이브러리 | ❌ |
| **메뉴 클로즈업** | Qwen | MENU_CLOSEUP + VLM 감각묘사 | **VLM만** |
| 들어올리기 | Qwen | MENU_LIFT 라이브러리 | ❌ |
| 포장 | Qwen | PACKAGING 라이브러리 | ❌ |
| 외부 전경 | Qwen | WIDE_SHOT 라이브러리 | ❌ |

---

## 📂 파일 구조

```
models/
├── sentence_library.py          # 씬별 대사 라이브러리 (8개 씬 × 10~14문장)
│   ├── EXTERIOR, INTERIOR
│   ├── COOKING_1, COOKING_2
│   ├── MENU_CLOSEUP, MENU_LIFT
│   ├── PACKAGING, WIDE_SHOT
│   ├── extract_sensory_word()   # VLM 키워드 → 감각묘사 형용사
│   ├── has_batchim()            # 받침 유무 판정
│   ├── fill_vars()              # 템플릿 변수 + 조사 치환
│   └── _JOSA_PAIRS              # 조사 자동 선택 맵
│
├── run_style2_promo.py          # 메인 파이프라인
│   ├── build_slots()            # 매장 옵션에 따라 슬롯 동적 생성
│   ├── pick_subtitle()          # 라이브러리 선택 + VLM 처리
│   └── main()                   # 렌더링 루프
│
└── web/
    ├── routers/style2.py        # FastAPI 엔드포인트
    ├── common.py                # RenderConfig (매장 정보)
    ├── static/style2.html       # UI 마크업
    ├── static/style2.js         # 상태 관리
    └── static/style2.css        # 스타일
```

---

## 🔧 핵심 구현

### 1. 템플릿 변수 치환 (조사 자동 처리)

**sentence_library.py의 `fill_vars()` 함수:**

```python
# {변수+조사} 형태로 템플릿 작성
# 예: "{메뉴명+이에요}" 

# 마라탕 (받침 ㅇ) → 마라탕이에요
# 꿔바로우 (받침 없음) → 꿔바로우예요

# 지원하는 조사:
_JOSA_PAIRS = {
    "이에요": ("이에요", "예요"),      # -이에요 / -예요
    "은": ("은", "는"),                # -은 / -는
    "을": ("을", "를"),                # -을 / -를
    "과": ("과", "와"),                # -과 / -와
    "으로": ("으로", "로"),            # -으로 / -로
    # ... 9개 조사 쌍
}
```

**사용 예:**
```python
fill_vars("{메뉴명+이에요} 상태였어요",
          메뉴명="마라탕")
# → "마라탕이에요 상태였어요"

fill_vars("{메뉴명+이에요} 상태였어요",
          메뉴명="꿔바로우")
# → "꿔바로우예요 상태였어요"
```

### 2. 클로즈업 씬의 VLM 감각묘사 처리

**run_style2_promo.py의 `pick_subtitle()` 함수:**

```python
# 메뉴 클로즈업만 is_food=True
# VLM에서 keywords 추출 → 감각묘사 단어로 변환

if slot_type == "menu_closeup" and vision:
    raw_kw = vision.get("keywords", [])  # ["매콤", "얼큰", "두부"]
    filtered_kw = [kw for kw in raw_kw if kw not in _NON_FOOD_NOISE]
    word = extract_sensory_word(filtered_kw)  # "얼큰한"
    sensory = word
```

### 3. 동적 슬롯 생성

**build_slots() 로직:**

```
1. 대표 메뉴 (훅)
   ↓
2. 매장 외부
   ↓
3. 매장 내부 (선택: has_interior=True)
   ↓
4. 조리 과정 1,2 (선택: has_cooking=True)
   ↓
5-6. 메뉴별 (클로즈업 + 들어올리기) × N
   ↓
7. 포장 (선택: has_packaging=True)
   ↓
8. 매장 외부 전경
```

---

## 💬 말투 특징 (더들리 벤치마킹)

- **과장 금지**: "최고예요" (X) → "상태가 괜찮았어요" (O)
- **헷징**: ~것 같아요, ~편이에요, ~것 같긴 한데
- **담담한 놀람**: "이 가격에 이게 된다는 게...", "이래도 되나 싶어요"
- **취향 인정**: "취향 타실 수 있지만 저는 좋았어요"
- **개인 경험**: "자꾸 생각나는 맛이에요", "또 오고 싶어지는 것 같아요"

---

## 🚀 실행 방법

### 1. 기본 실행 (UI)
```bash
cd models
python -m uvicorn web.app:app --host 0.0.0.0 --port 8002
```

브라우저: `http://localhost:8002/style2`

### 2. CLI 직접 실행
```bash
cd models
python run_style2_promo.py \
  --run-id test-001 \
  --store-name "해피마라탕" \
  --store-location "아산 신창면" \
  --menu-names "마라탕,꿔바로우" \
  --has-cooking \
  --has-packaging \
  --has-interior \
  --table-count 12 \
  --slot-files "scene_01.mov,scene_02.mov,..." \
  --tts openrouter
```

---

## 📊 성능 개선

### 시간 비교
- **이전 (Qwen 호출)**: 8개 씬 × 30초 = ~4분
- **현재 (라이브러리)**: 8개 씬 × 0초 + VLM 클로즈업만 = ~60초

### API 호출 감소
- **이전**: Qwen 8회 + Vision 2회 = 10회
- **현재**: Vision 2회 (메뉴 클로즈업만)

---

## 🎬 예제 출력

```
[대표 메뉴] → 제가 요즘 제일 자주 가는 곳 알려드릴게요
[매장 외부] → 아산 신창면에 있는 해피마라탕입니다
[매장 내부] → 자리가 많아서 대기는 적은 편이에요
[조리 과정 1] → 요리에 진심이신 것 같아요
[조리 과정 2] → 직접 만들어서 더 나은 것 같아요
[마라탕 — 클로즈업] → 얼큰한 마라탕이에요                  (VLM: "얼큰")
[마라탕 — 들어올리기] → 이 맛이 계속 생각나더라고요
[꿔바로우 — 클로즈업] → 매콤한 꿔바로우예요              (VLM: "매콤", 조사 자동)
[꿔바로우 — 들어올리기] → 젓가락이 계속 가는 맛이에요
[포장/테이크아웃] → 포장 상태도 나쁘지 않았어요
[매장 외부 전경] → 아산 신창면 오시면 한번 들려보세요
```

---

## 📝 주요 개선점

1. **조사 자동화** → 메뉴명 받침에 따라 자동 선택
2. **VLM 최소화** → 클로즈업만 사용 (속도 ↑)
3. **Qwen 제거** → 라이브러리 랜덤 선택 (속도 ↑↑)
4. **말투 일관성** → 더들리 톤 유지
5. **동적 슬롯** → 매장 옵션에 따라 유연하게 구성

---

## ⚙️ 다음 단계 (선택사항)

1. 감각묘사 단어 리스트 확장
2. 후보 문장 추가 (현재 각 10~14개)
3. 훅 문장 다양화
4. A/B 테스팅 UI 추가

