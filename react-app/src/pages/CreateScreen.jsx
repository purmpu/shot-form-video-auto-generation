import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import Header from '../components/Header'
import Modal from '../components/Modal'

// 목소리 목록 (소문자 — 파이프라인 TTS_VOICE 기본값과 일치)
const VOICES = [
  { value: 'rex', label: '렉스', desc: '남성·자신감' },
  { value: 'ara', label: '아라', desc: '여성·따뜻함' },
  { value: 'eve', label: '이브', desc: '여성·활기참' },
  { value: 'sal', label: '쌀',   desc: '남성·차분함' },
]

// BGM 무드 — 파일명 키워드로 매핑
const BGM_MOODS = [
  { label: '잔잔한', keywords: ['잔잔', '차분'] },
  { label: '산뜻한', keywords: ['산뜻', '즐거'] },
  { label: '밝은',   keywords: ['밝',   '따뜻'] },
  { label: '경쾌한', keywords: ['경쾌', '신나'] },
]

function findBgmFile(bgmList, moodIdx) {
  const mood = BGM_MOODS[moodIdx]
  if (!mood || bgmList.length === 0) return bgmList[0] || ''
  return bgmList.find(f => mood.keywords.some(k => f.includes(k))) || bgmList[0] || ''
}

export default function CreateScreen() {
  const { state, setStyle, setCafeCaption, setBgmList, setOutroList, setJob, navigate } = useApp()
  const { subtitleStyle, subtitleY, voice, bgmIndex, hasOutro, outroFile,
          cafeCaption, cafeCaptionStyle,
          sessionId, storeInfo, bgmList, outroList } = state

  if (storeInfo.bizType === 'cafe') {
    return <CafeCreateScreen
      cafeCaption={cafeCaption} cafeCaptionStyle={cafeCaptionStyle}
      bgmIndex={bgmIndex} bgmList={bgmList}
      sessionId={sessionId} subtitleY={subtitleY}
      setStyle={setStyle} setCafeCaption={setCafeCaption}
      setBgmList={setBgmList} setJob={setJob} navigate={navigate}
    />
  }

  const [panelOpen,       setPanelOpen]       = useState(false)
  const [subtitlePreview, setSubtitlePreview] = useState(null)
  const [voiceAudioUrl,   setVoiceAudioUrl]   = useState(null)
  const [bgmAudioUrl,     setBgmAudioUrl]     = useState(null)
  const [ttsLoading,      setTtsLoading]      = useState(false)
  const [autoPopup,       setAutoPopup]       = useState(false)
  const [customPopup,     setCustomPopup]     = useState(false)
  const [submitting,      setSubmitting]      = useState(false)
  const [submitError,     setSubmitError]     = useState('')
  const voiceBlobRef = useRef(null)

  // BGM / 아웃트로 목록 로드
  useEffect(() => {
    fetch('/api/bgm').then(r => r.json()).then(list => setBgmList(list)).catch(() => {})
    fetch('/api/intros').then(r => r.json()).then(list => setOutroList(list)).catch(() => {})
    return () => { if (voiceBlobRef.current) URL.revokeObjectURL(voiceBlobRef.current) }
  }, [])

  // 스타일 완성 여부
  const bgmOk = bgmList.length === 0 || bgmIndex !== null
  const styleComplete =
    subtitleStyle !== null && voice !== null && bgmOk &&
    hasOutro !== null && (hasOutro === false || outroFile !== null)

  // TTS 미리듣기
  const previewVoice = async (v) => {
    if (ttsLoading) return
    setStyle('voice', v)
    setTtsLoading(true)
    setVoiceAudioUrl(null)
    try {
      const res = await fetch('/api/tts-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engine: 'xai', voice: v, model: 'x-ai/grok-voice-tts-1.0', speed: 1.0 }),
      })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      if (voiceBlobRef.current) URL.revokeObjectURL(voiceBlobRef.current)
      const url = URL.createObjectURL(blob)
      voiceBlobRef.current = url
      setVoiceAudioUrl(url)
    } catch { /* TTS 실패 시 선택만 유지 */ }
    finally { setTtsLoading(false) }
  }

  // BGM 미리듣기
  const previewBgm = (idx) => {
    setStyle('bgmIndex', idx)
    const filename = findBgmFile(bgmList, idx)
    if (!filename) return
    setBgmAudioUrl(`/api/bgm/${encodeURIComponent(filename)}`)
  }

  // 영상 생성 요청
  const buildConfig = (isAuto) => {
    const menus   = storeInfo.menus.filter(m => m.trim())
    const autoBgm = bgmList[0] || ''
    return {
      upload_session: sessionId || '',
      store_name:     storeInfo.storeName,
      store_location: storeInfo.location,
      menu_names:     menus,
      has_cooking:    !!storeInfo.hasCooking,
      has_packaging:  !!storeInfo.hasPackaging,
      has_interior:   !!storeInfo.hasInterior,
      table_count:    parseInt(storeInfo.tableCount) || 0,
      headline:       `${storeInfo.storeName || '맛집'} 오늘도 맛있다\\n여기 꼭 와봐요!`,
      tts_engine:     'openrouter',
      tts_voice:      isAuto ? 'eve' : (voice || 'eve'),
      tts_speed:      1.0,
      subtitle_style: isAuto ? 'box' : (subtitleStyle || 'box'),
      bgm_file:       isAuto ? autoBgm : findBgmFile(bgmList, bgmIndex),
      aggro_intro:    isAuto ? '' : (hasOutro && outroFile ? outroFile : ''),
      tone_style:     'seosanam',
    }
  }

  const startRender = async (isAuto) => {
    const cfg = buildConfig(isAuto)
    console.info(`[TTS] engine=${cfg.tts_engine} voice=${cfg.tts_voice}`)
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch('/api/render-style3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      })
      if (!res.ok) throw new Error('렌더링 시작 실패')
      const data = await res.json()
      setJob(data.job_id)
      navigate('loading')
    } catch (e) {
      setSubmitError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="screen anim-in" style={{ overflowY: 'auto', paddingBottom: 100 }}>
      <Header />

      {/* 제목 */}
      <div style={{
        position: 'absolute', left: 26, top: 89, width: 350, height: 63,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, fontWeight: 600, color: '#000', textAlign: 'center',
      }}>
        편집 스타일을 설정 해볼까요 ?
      </div>

      <div style={{ position: 'absolute', left: 26, top: 152, width: 350 }}>

        {/* 알아서 만들어줘 */}
        <button className="btn-gray" style={{ width: '100%', height: 61, fontSize: 20, marginBottom: 12 }}
          onClick={() => setAutoPopup(true)} disabled={submitting}>
          그냥 알아서 만들어줘 ~
        </button>

        {/* 편집 스타일 설정하기 */}
        <button style={{
          width: '100%', height: 61,
          background: panelOpen ? '#969696' : '#EB5C04',
          color: '#fff', border: 'none', borderRadius: 25,
          fontSize: 20, fontWeight: 600, cursor: 'pointer',
          marginBottom: 16, transition: 'background .2s',
        }} onClick={() => setPanelOpen(o => !o)}>
          편집 스타일 설정하기
        </button>

        {/* 스타일 패널 */}
        {panelOpen && (
          <div style={{
            width: '100%', background: 'rgba(223,223,223,0.40)',
            borderRadius: 25, padding: '20px 20px 16px', marginBottom: 16,
          }}>

            {/* 자막 스타일 */}
            <SectionTitle>자막 스타일</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
              <SubtitleCol label="블록 자막" value="box"
                selected={subtitleStyle === 'box'} previewOpen={subtitlePreview === 'box'}
                onPlus={() => setSubtitlePreview(p => p === 'box' ? null : 'box')} />
              <SubtitleCol label="기본 자막" value="bold"
                selected={subtitleStyle === 'bold'} previewOpen={subtitlePreview === 'bold'}
                onPlus={() => setSubtitlePreview(p => p === 'bold' ? null : 'bold')} />
            </div>

            {subtitlePreview && (
              <div style={{
                background: '#fff', borderRadius: 16, padding: 16,
                marginBottom: 12, border: '1.5px solid #EB5C04',
              }}>
                <p style={{ textAlign: 'center', fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
                  자막이 이렇게 생성돼요 !
                </p>
                <div style={{
                  height: 120, background: '#222', borderRadius: 8,
                  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                  paddingBottom: 12, marginBottom: 12,
                }}>
                  {subtitlePreview === 'box'
                    ? <span style={{ background:'#000', color:'#fff', padding:'4px 16px', borderRadius:0, fontWeight:700 }}>맛있는 마라탕 🍜</span>
                    : <span style={{ color:'#fff', fontWeight:900, textShadow:'-2px -2px 0 #000,2px -2px 0 #000,-2px 2px 0 #000,2px 2px 0 #000' }}>맛있는 마라탕 🍜</span>
                  }
                </div>
                <button className="btn-orange" style={{ width: '100%', height: 30, fontSize: 15 }}
                  onClick={() => { setStyle('subtitleStyle', subtitlePreview); setSubtitlePreview(null) }}>
                  선택
                </button>
              </div>
            )}

            <Divider />

            {/* 목소리 */}
            <SectionTitle>목소리</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 4 }}>
              {VOICES.map(v => (
                <button key={v.value}
                  className={`opt-btn${voice === v.value ? ' selected' : ''}`}
                  style={{ height: 31, opacity: ttsLoading ? .6 : 1 }}
                  onClick={() => previewVoice(v.value)}
                  disabled={ttsLoading}>
                  {v.label}
                </button>
              ))}
            </div>
            {voiceAudioUrl && <MiniPlayer audioUrl={voiceAudioUrl} label={VOICES.find(v => v.value === voice)?.label} />}
            {ttsLoading && <p style={{ fontSize: 12, color: '#aaa', textAlign: 'center', marginTop: 4 }}>음성 생성 중...</p>}

            <Divider />

            {/* 노래 */}
            <SectionTitle>노래</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 4 }}>
              {BGM_MOODS.map((mood, i) => (
                <button key={mood.label}
                  className={`opt-btn${bgmIndex === i ? ' selected' : ''}`}
                  style={{ height: 31, opacity: bgmList.length === 0 ? .5 : 1 }}
                  onClick={() => previewBgm(i)}
                  disabled={bgmList.length === 0}>
                  {mood.label}
                </button>
              ))}
            </div>
            {bgmAudioUrl && <MiniPlayer audioUrl={bgmAudioUrl} label={BGM_MOODS[bgmIndex]?.label} />}
            {bgmList.length === 0 && (
              <p style={{ fontSize: 12, color: '#aaa', textAlign: 'center', marginTop: 4 }}>BGM 파일 없음</p>
            )}

            <Divider />

            {/* 아웃트로 */}
            <SectionTitle>아웃트로</SectionTitle>
            <div style={{ background: '#fff', borderRadius: 16, padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: hasOutro ? 10 : 0 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>아웃트로 영상 사용</span>
                <div style={{ display: 'flex', width: 90 }}>
                  <button className={`yn-yes${hasOutro === true ? ' active' : ''}`}
                    onClick={() => setStyle('hasOutro', true)}>예</button>
                  <button className={`yn-no${hasOutro === false ? ' active' : ''}`}
                    onClick={() => { setStyle('hasOutro', false); setStyle('outroFile', null) }}>아니오</button>
                </div>
              </div>
              {hasOutro === true && (
                outroList.length === 0
                  ? <p style={{ fontSize: 12, color: '#aaa', textAlign: 'center', padding: '4px 0' }}>등록된 아웃트로 영상이 없어요</p>
                  : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {outroList.map(f => (
                        <button key={f}
                          onClick={() => setStyle('outroFile', f)}
                          style={{
                            padding: '6px 12px', borderRadius: 12, border: 'none', cursor: 'pointer',
                            background: outroFile === f ? '#fff3ed' : '#F2F2F2',
                            color: outroFile === f ? '#EB5C04' : '#000',
                            fontWeight: 600, fontSize: 13, textAlign: 'left',
                            borderLeft: outroFile === f ? '3px solid #EB5C04' : '3px solid transparent',
                          }}>
                          {f}
                        </button>
                      ))}
                    </div>
              )}
            </div>

          </div>
        )}

        {/* 영상 만들기 버튼 */}
        {panelOpen && (
          <>
            {submitError && <p style={{ color:'#e53e3e', fontSize:13, textAlign:'center', marginBottom:8 }}>{submitError}</p>}
            <button
              className={styleComplete && !submitting ? 'btn-orange' : 'btn-gray'}
              style={{ width: '100%', height: 61, fontSize: 20, marginBottom: 24 }}
              onClick={() => styleComplete && !submitting && setCustomPopup(true)}>
              {submitting ? '처리 중...' : '영상 만들기!'}
            </button>
          </>
        )}

      </div>

      {autoPopup && (
        <Modal message={'스타일 설정 없이\n만들어 드릴까요?'}
          onConfirm={() => { setAutoPopup(false); startRender(true) }}
          onCancel={() => setAutoPopup(false)} />
      )}
      {customPopup && (
        <Modal message={'설정하신 스타일대로\n영상을 만들어드릴까요?'}
          onConfirm={() => { setCustomPopup(false); startRender(false) }}
          onCancel={() => setCustomPopup(false)} />
      )}
    </div>
  )
}

// ── 서브 컴포넌트 ──────────────────────────────────────────────

function SectionTitle({ children }) {
  return <p style={{ textAlign:'center', fontSize:16, fontWeight:600, marginBottom:10 }}>{children}</p>
}
function Divider() {
  return <div style={{ height:1, background:'#ddd', margin:'10px 0 14px' }} />
}

function SubtitleCol({ label, selected, previewOpen, onPlus }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <button className={`opt-btn${selected ? ' selected' : ''}`} style={{ height:31 }} onClick={onPlus}>
        {label}
      </button>
      <button onClick={onPlus} style={{
        height:31,
        background: previewOpen ? '#fff3ed' : '#fff',
        border: previewOpen ? '1.5px solid #EB5C04' : '1px solid #e0e0e0',
        borderRadius:25, cursor:'pointer', fontSize:16, fontWeight:600,
        color: previewOpen ? '#EB5C04' : '#000',
        boxShadow:'0 1px 3px rgba(0,0,0,0.06)',
      }}>
        {previewOpen ? '▲' : '+'}
      </button>
    </div>
  )
}

// ── 카페 전용 편집 화면 ────────────────────────────────────────
function CafeCreateScreen({
  cafeCaption, cafeCaptionStyle, bgmIndex, bgmList,
  sessionId, subtitleY, setStyle, setCafeCaption, setBgmList, setJob, navigate,
}) {
  const [bgmAudioUrl,  setBgmAudioUrl]  = useState(null)
  const [previewStyle, setPreviewStyle] = useState(null)
  const [submitting,   setSubmitting]   = useState(false)
  const [submitError,  setSubmitError]  = useState('')
  const [confirmPopup, setConfirmPopup] = useState(false)

  useEffect(() => {
    fetch('/api/bgm').then(r => r.json()).then(list => setBgmList(list)).catch(() => {})
  }, [])

  const captionOk = cafeCaption.trim().length > 0
  const ready = captionOk

  const previewBgm = (idx) => {
    setStyle('bgmIndex', idx)
    const filename = findBgmFile(bgmList, idx)
    if (filename) setBgmAudioUrl(`/api/bgm/${encodeURIComponent(filename)}`)
  }

  const startRender = async () => {
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch('/api/render-cafe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          upload_session:  sessionId || '',
          caption_text:    cafeCaption.trim(),
          subtitle_style:  cafeCaptionStyle,
          subtitle_y_pct:  subtitleY ?? -1,
          bgm_file:        findBgmFile(bgmList, bgmIndex),
        }),
      })
      if (!res.ok) throw new Error('렌더링 시작 실패')
      const data = await res.json()
      setJob(data.job_id)
      navigate('loading')
    } catch (e) {
      setSubmitError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="screen anim-in" style={{ overflowY: 'auto', paddingBottom: 100 }}>
      <Header />

      <div style={{
        position: 'absolute', left: 26, top: 89, width: 350, height: 63,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, fontWeight: 600, color: '#000', textAlign: 'center',
      }}>
        카페 영상 편집 설정
      </div>

      <div style={{ position: 'absolute', left: 26, top: 152, width: 350 }}>
        <div style={{
          width: '100%', background: 'rgba(223,223,223,0.40)',
          borderRadius: 25, padding: '20px 20px 16px', marginBottom: 16,
        }}>

          {/* 자막 문구 입력 */}
          <SectionTitle>자막 문구</SectionTitle>
          <div style={{
            background: '#fff', borderRadius: 16, padding: '12px 16px', marginBottom: 12,
          }}>
            <textarea
              value={cafeCaption}
              onChange={e => setCafeCaption(e.target.value)}
              placeholder="입력하고 싶은 문구를 적어주세요"
              maxLength={40}
              rows={3}
              style={{
                width: '100%', border: 'none', outline: 'none', resize: 'none',
                fontSize: 15, fontWeight: 500, lineHeight: 1.6,
                fontFamily: 'inherit', color: '#111',
              }}
            />
            <p style={{ textAlign: 'right', fontSize: 11, color: '#aaa', marginTop: 4 }}>
              {cafeCaption.length} / 40
            </p>
          </div>

          <Divider />

          {/* 자막 스타일 */}
          <SectionTitle>자막 스타일</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
            <SubtitleCol label="블록 자막" value="box"
              selected={cafeCaptionStyle === 'box'} previewOpen={previewStyle === 'box'}
              onPlus={() => setPreviewStyle(p => p === 'box' ? null : 'box')} />
            <SubtitleCol label="기본 자막" value="bold"
              selected={cafeCaptionStyle === 'bold'} previewOpen={previewStyle === 'bold'}
              onPlus={() => setPreviewStyle(p => p === 'bold' ? null : 'bold')} />
          </div>
          {previewStyle && (
            <div style={{
              background: '#fff', borderRadius: 16, padding: 16, marginBottom: 12,
              border: '1.5px solid #EB5C04',
            }}>
              <p style={{ textAlign: 'center', fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
                자막이 이렇게 생성돼요 !
              </p>
              <div style={{
                height: 100, background: '#222', borderRadius: 8,
                display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                paddingTop: 14, marginBottom: 12,
              }}>
                {(() => {
                  const prev = (cafeCaption || '입력한 문구').split('\n').map(l => l.trim()).filter(Boolean).slice(0, 2)
                  return previewStyle === 'box'
                    ? <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                        {prev.map((l, i) => <span key={i} style={{ background:'#000', color:'#fff', padding:'4px 16px', borderRadius:0, fontWeight:700 }}>{l}</span>)}
                      </div>
                    : <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                        {prev.map((l, i) => <span key={i} style={{ color:'#fff', fontWeight:900 }}>{l}</span>)}
                      </div>
                })()}
              </div>
              <button className="btn-orange" style={{ width: '100%', height: 30, fontSize: 15 }}
                onClick={() => { setStyle('cafeCaptionStyle', previewStyle); setPreviewStyle(null) }}>
                선택
              </button>
            </div>
          )}

          {/* 자막 위치 */}
          <SectionTitle>자막 위치</SectionTitle>
          <SubtitlePositionPicker
            yPct={subtitleY}
            onChange={pct => setStyle('subtitleY', pct)}
            style={cafeCaptionStyle}
            defaultPct={2}
            sampleText={cafeCaption}
          />

          <Divider />

          {/* BGM */}
          <SectionTitle>노래</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 4 }}>
            {BGM_MOODS.map((mood, i) => (
              <button key={mood.label}
                className={`opt-btn${bgmIndex === i ? ' selected' : ''}`}
                style={{ height: 31, opacity: bgmList.length === 0 ? .5 : 1 }}
                onClick={() => previewBgm(i)}
                disabled={bgmList.length === 0}>
                {mood.label}
              </button>
            ))}
          </div>
          {bgmAudioUrl && <MiniPlayer audioUrl={bgmAudioUrl} label={BGM_MOODS[bgmIndex]?.label} />}
          {bgmList.length === 0 && (
            <p style={{ fontSize: 12, color: '#aaa', textAlign: 'center', marginTop: 4 }}>BGM 파일 없음</p>
          )}
        </div>

        {submitError && <p style={{ color:'#e53e3e', fontSize:13, textAlign:'center', marginBottom:8 }}>{submitError}</p>}
        <button
          className={ready && !submitting ? 'btn-orange' : 'btn-gray'}
          style={{ width: '100%', height: 61, fontSize: 20, marginBottom: 24 }}
          onClick={() => ready && !submitting && setConfirmPopup(true)}>
          {submitting ? '처리 중...' : '영상 만들기!'}
        </button>
      </div>

      {confirmPopup && (
        <div onClick={() => setConfirmPopup(false)}
          style={{ position:'fixed', inset:0, zIndex:100, background:'rgba(0,0,0,0.5)',
                   display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width:300, background:'#fff', borderRadius:24, padding:'28px 24px 20px', textAlign:'center' }}>
            <p style={{ fontSize:16, fontWeight:700, marginBottom:20, lineHeight:1.6, whiteSpace:'pre-line' }}>
              {'카페 영상을\n만들어드릴까요?'}
            </p>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setConfirmPopup(false)}
                style={{ flex:1, height:46, background:'#eee', border:'none', borderRadius:14, fontSize:15, fontWeight:600, cursor:'pointer' }}>
                취소
              </button>
              <button onClick={() => { setConfirmPopup(false); startRender() }}
                style={{ flex:1, height:46, background:'#EB5C04', border:'none', borderRadius:14, fontSize:15, fontWeight:700, color:'#fff', cursor:'pointer' }}>
                만들기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 9:16 미니 프리뷰 — 클릭으로 자막 Y 위치 설정
function SubtitlePositionPicker({ yPct, onChange, style, defaultPct = 79, sampleText = '' }) {
  const W = 162
  const H = Math.round(W * 16 / 9)  // 288

  const displayPct = yPct !== null ? yPct : defaultPct

  // 실제 문구 줄 분리 (최대 2줄), 없으면 플레이스홀더
  const lines = sampleText.trim()
    ? sampleText.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 2)
    : ['자막 미리보기']

  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.round(Math.max(5, Math.min(95, ((e.clientY - rect.top) / H) * 100)))
    onChange(pct)
  }

  const isBox = style === 'box' || style === 'highlight'
  const boxBg = style === 'highlight' ? 'rgba(255,255,0,0.85)' : '#000'
  const boxColor = style === 'highlight' ? '#000' : '#fff'

  return (
    <div style={{ marginBottom: 12 }}>
      <div
        onClick={handleClick}
        style={{
          position: 'relative', width: W, height: H,
          background: 'linear-gradient(180deg,#0d0d1a 0%,#1a1a2e 50%,#111120 100%)',
          borderRadius: 12, margin: '8px auto',
          cursor: 'crosshair', overflow: 'hidden',
          border: yPct !== null ? '2px solid #EB5C04' : '1.5px solid #d0d0d0',
          userSelect: 'none',
        }}
      >
        {/* 배경 아이콘 */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36, opacity: 0.18, pointerEvents: 'none',
        }}>
          🍽️
        </div>

        {/* 클릭 힌트 */}
        {yPct === null && (
          <div style={{
            position: 'absolute', top: 8, left: 0, right: 0,
            textAlign: 'center', fontSize: 8.5, color: 'rgba(255,255,255,0.45)',
            pointerEvents: 'none', lineHeight: 1.5,
          }}>
            화면을 클릭해<br />위치 설정
          </div>
        )}

        {/* 위치 가이드 선 */}
        <div style={{
          position: 'absolute', left: 8, right: 8, height: 1,
          background: 'rgba(235,92,4,0.45)',
          top: `${displayPct}%`, pointerEvents: 'none',
        }} />

        {/* 자막 미리보기 — 줄 수만큼 렌더 */}
        <div style={{
          position: 'absolute', left: 0, right: 0,
          top: `${displayPct}%`, transform: 'translateY(-50%)',
          pointerEvents: 'none',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
        }}>
          {isBox
            ? lines.map((line, i) => (
                <span key={i} style={{
                  background: boxBg, color: boxColor,
                  fontSize: 8, fontWeight: 700, padding: '2px 8px', borderRadius: 0,
                  whiteSpace: 'nowrap', maxWidth: W - 16,
                  overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{line}</span>
              ))
            : lines.map((line, i) => (
                <span key={i} style={{
                  color: '#fff', fontSize: 8.5, fontWeight: 900,
                  whiteSpace: 'nowrap', maxWidth: W - 16,
                  overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{line}</span>
              ))
          }
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: '#666' }}>
          {yPct !== null ? `상단에서 ${yPct}% 위치` : '기본 위치'}
        </span>
        {yPct !== null && (
          <button
            onClick={(e) => { e.stopPropagation(); onChange(null) }}
            style={{ background: 'none', border: 'none', fontSize: 11, color: '#aaa', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
            초기화
          </button>
        )}
      </div>
    </div>
  )
}

// 미니 오디오 플레이어 — MiniPlayer가 Audio 단독 소유
function MiniPlayer({ audioUrl, label }) {
  const [playing,  setPlaying]  = useState(false)
  const [progress, setProgress] = useState(0)
  const [time,     setTime]     = useState('0:00')
  const audioRef = useRef(null)

  useEffect(() => {
    if (!audioUrl) return
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    setPlaying(false); setProgress(0); setTime('0:00')

    const audio = new Audio(audioUrl)
    audioRef.current = audio

    audio.addEventListener('timeupdate', () => {
      if (!audio.duration) return
      setProgress((audio.currentTime / audio.duration) * 100)
      const s = Math.floor(audio.currentTime)
      setTime(`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`)
    })
    audio.addEventListener('ended', () => { setPlaying(false); setProgress(0) })

    audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false))

    return () => { audio.pause(); audioRef.current = null }
  }, [audioUrl])

  const toggle = () => {
    const a = audioRef.current
    if (!a) return
    if (playing) { a.pause(); setPlaying(false) }
    else { a.play().then(() => setPlaying(true)).catch(() => {}) }
  }

  return (
    <div style={{
      display:'flex', alignItems:'center', gap:8,
      background:'#fff', border:'1.5px solid #EB5C04',
      borderRadius:24, padding:'5px 12px', marginTop:8,
    }}>
      <button onClick={toggle} style={{
        width:26, height:26, borderRadius:'50%',
        background:'#EB5C04', color:'#fff', border:'none',
        fontSize:10, cursor:'pointer', flexShrink:0,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>{playing ? '⏸' : '▶'}</button>
      <div style={{ flex:1, height:4, background:'#e0e0e0', borderRadius:2, overflow:'hidden' }}>
        <div style={{ height:'100%', background:'#EB5C04', width:`${progress}%`, transition:'width .2s' }} />
      </div>
      <span style={{ fontSize:12, color:'#aaa', minWidth:30 }}>{time}</span>
      {label && <span style={{ fontSize:12, color:'#aaa' }}>{label}</span>}
    </div>
  )
}
