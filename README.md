# AI 홍보 영상 생성 파일 정리

이 폴더는 천라쿵푸 홍보 영상을 다시 만들 때 필요한 핵심 파일만 모아둔 실행용 패키지입니다.
원본 작업 폴더의 파일은 이동하지 않고 복사만 했습니다.

## 실행에 필요한 파일

| 경로 | 용도 |
|---|---|
| `rerender_single_from_summary.py` | 고정된 장면/자막/나레이션 CSV를 기준으로 최종 숏폼 영상을 다시 렌더링하는 실행 파일입니다. 현재 결과물을 재현할 때 가장 직접적으로 사용합니다. |
| `run_gemini_qwen_single_promo.py` | Gemini Vision 분석과 Qwen 스크립트 생성까지 포함해 API 기반으로 새 홍보 영상을 생성하는 실행 파일입니다. |
| `gemini_script_compare_common.py` | Vision 호출, Script 호출, OpenRouter TTS, 장면 렌더링, 자막 합성, BGM 믹싱 등 공통 기능이 들어 있는 핵심 모듈입니다. |
| `inspect_vision_models.py` | OpenRouter API 키 로드, ffmpeg 프레임 추출, Vision 모델 호출에 쓰이는 보조 모듈입니다. |
| `run_role_video_pipeline.py` | OpenRouter API 엔드포인트와 TTS 호출에 필요한 공통 상수/보조 로직을 제공합니다. |
| `test_openrouter_tts_voices.py` | OpenRouter TTS 목소리 샘플을 생성하거나 테스트할 때 사용하는 보조 파일입니다. |
| `requirements.txt` | Python 실행에 필요한 패키지 목록입니다. |
| `.env.openrouter.example` | OpenRouter API 키 입력 예시 파일입니다. 실제 키는 보안상 복사하지 않았습니다. |

## 영상 소스 파일

| 경로 | 용도 |
|---|---|
| `abc/마라탕매장 영상 원본_260304/S01_천라쿵푸왕십리_매장로고.MOV` | 1번 장면, 매장 로고/간판 오프닝에 사용합니다. |
| `abc/마라탕매장 영상 원본_260304/S03_천라쿵푸왕십리_재료(와이드).MOV` | 2번 장면, 재료 진열 와이드 컷에 사용합니다. |
| `abc/마라탕매장 영상 원본_260304/H01_천라쿵푸왕십리_신선한재료.MOV` | 3번 장면, 신선한 재료 클로즈업에 사용합니다. |
| `abc/마라탕매장 영상 원본_260304/C01_천라쿵푸왕십리_끓는마라탕.MOV` | 4번 장면, 끓는 마라탕 장면에 사용합니다. |
| `abc/마라탕매장 영상 원본_260304/C03_천라쿵푸왕십리_담는마라탕(1).MOV` | 5번 장면, 완성된 마라탕을 담는 장면에 사용합니다. |
| `abc/마라탕매장 영상 원본_260304/C04_천라쿵푸왕십리_완성된마라탕.MOV` | 6번 장면, 완성된 마라탕 한 그릇 장면에 사용합니다. |
| `abc/마라탕매장 영상 원본_260304/M05_천라쿵푸경희대_들어올리는꿔바로우.MOV` | 7번 장면, 꿔바로우를 들어 올리는 음식 비주얼 컷에 사용합니다. |
| `abc/마라탕매장 영상 원본_260304/P01_천라쿵푸왕십리_포장.MOV` | 8번 장면, 포장 홍보 컷에 사용합니다. |
| `abc/마라탕매장 영상 원본_260304/S09_천라쿵푸경희대_매장전경.MOV` | 9번 장면, 매장 방문 유도 엔딩 컷에 사용합니다. |

## 자막, TTS, BGM 자료

| 경로 | 용도 |
|---|---|
| `assets/scripts/fixed_title_scene_summary.csv` | 9개 장면의 원본 파일명, 장면 설명, 자막, 나레이션을 담은 고정 대본 파일입니다. 현재는 자막과 나레이션이 동일하게 작성되어 있습니다. |
| `assets/bgm/tunetank-no-copyright-music-349745.mp3` | 최근 최종본에 사용한 BGM입니다. |
| `assets/bgm/*.mp3` | BGM 후보 파일들입니다. 다른 분위기의 버전으로 다시 렌더링할 때 선택할 수 있습니다. |
| `assets/tts_samples/grok/x-ai_grok-voice-tts-1.0__Rex.mp3` | 최종 선택한 OpenRouter Grok TTS Rex 목소리 샘플입니다. 실제 영상 생성 시에는 API로 새 TTS를 생성합니다. |

## 렌더링 도구

| 경로 | 용도 |
|---|---|
| `abc/ffmpeg/bin/ffmpeg.exe` | 영상 자르기, 자막 합성, 오디오 믹싱, 최종 MP4 렌더링에 사용합니다. |
| `abc/ffmpeg/bin/ffprobe.exe` | 영상/오디오 길이 확인에 사용합니다. |

## 참고 결과물

| 경로 | 용도 |
|---|---|
| `outputs/reference_videos/final_with_white_fade_intro_9s_bgm_low_white_fadein.mp4` | 현재까지 만든 최신 참고 결과물입니다. 영상 생성 입력 파일은 아니고 결과 비교용입니다. |

## 실행 방법

1. `models` 폴더로 이동합니다.

```powershell
cd "C:\Users\Administrator\OneDrive\Desktop\2026\캡디\models"
```

2. 가상환경을 만들고 패키지를 설치합니다.

```powershell
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
```

3. `.env.openrouter.example`을 `.env.openrouter`로 복사한 뒤, 실제 OpenRouter API 키를 입력합니다.

```powershell
Copy-Item .env.openrouter.example .env.openrouter
notepad .env.openrouter
```

4. 현재 고정 대본 기준으로 영상을 다시 생성합니다.

```powershell
$env:BGM_VOLUME="0.035"
$env:NARRATION_VOLUME="1.7"
.\.venv\Scripts\python.exe .\rerender_single_from_summary.py `
  --summary ".\assets\scripts\fixed_title_scene_summary.csv" `
  --bgm ".\assets\bgm\tunetank-no-copyright-music-349745.mp3" `
  --run-id "rerender-test" `
  --headline "마라탕 땡기는 날`n여긴 어때?"
```

생성 결과는 `outputs/gemini-qwen_single/rerender-test/final_gemini_qwen_single.mp4`에 저장됩니다.

## 정리 기준

실행에 필요한 파일만 포함했습니다. 프레임 체크 이미지, 중간 실험 결과, 이전 비교 보고서, 임시 xlsx/md/json 파일은 포함하지 않았습니다.

최근 인트로 합성에 사용했던 `KakaoTalk_20260523_163606754.mp4` 원본은 현재 기존 경로에서 찾을 수 없어 복사하지 못했습니다. 대신 최종 인트로 포함 결과물은 `outputs/reference_videos`에 참고용으로 넣었습니다.
