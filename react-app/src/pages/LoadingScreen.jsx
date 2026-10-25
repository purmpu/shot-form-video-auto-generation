import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import Header from '../components/Header'

const MESSAGES = [
  '커피 한잔 하고 계세요 ~',
  '노래 한곡 듣고 계세요 ~',
  '유튜브 잠깐만 보고계세요 ~',
]

function parseProgress(logs) {
  if (!logs?.length) return 0
  for (let i = logs.length - 1; i >= 0; i--) {
    const m = logs[i].match(/\[progress:(\d+)%\]|\[(\d+)\/(\d+)\]|(\d+)%/)
    if (m) {
      if (m[1]) return +m[1]
      if (m[2] && m[3]) return Math.round((+m[2] / +m[3]) * 100)
      if (m[4]) return +m[4]
    }
  }
  return 0
}

function detectPhase(logs) {
  let phase = 0
  for (const line of logs) {
    if (/\[progress:5%\]/.test(line) && phase < 1) phase = 1
    if ((/\[vision\]|\[vlm\]/i.test(line) || /\[progress:(1\d|2\d|3\d|4[0-4])%\]/.test(line)) && phase < 2) phase = 2
    if ((/\[script\]|\[style3\]|LLM/i.test(line) || /\[progress:50%\]/.test(line)) && phase < 3) phase = 3
    if ((/\[tts\/render\]|\[tts\]|\[render\]/i.test(line) || /\[progress:(5\d|6\d|7\d|8\d|9[01])%\]/.test(line)) && phase < 4) phase = 4
    if ((/concat|bgm|mix|믹스/i.test(line) || /\[progress:9[2-9]%\]/.test(line)) && phase < 5) phase = 5
  }
  return phase
}

function logColor(line) {
  if (/traceback|error|fail|실패/i.test(line)) return '#fc8181'
  if (/✅|완료|\[done\]/i.test(line))          return '#68d391'
  if (/\[vision\]|\[tts\]|\[render\]/i.test(line)) return '#63b3ed'
  if (/\[script\]|\[warn\]|\[style3\]/i.test(line)) return '#f6ad55'
  if (/\[progress:\d+%\]/.test(line))          return '#3d444d'
  return '#a0aec0'
}

const PHASES = [
  { num: '①', label: '클립\n분석' },
  { num: '②', label: 'VLM\n분석' },
  { num: '③', label: 'LLM\n대본' },
  { num: '④', label: 'TTS\n렌더링' },
  { num: '⑤', label: 'BGM\n믹스' },
]

const fmtTime = s =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

export default function LoadingScreen() {
  const { state, setOutput, setProgress, navigate } = useApp()
  const { jobId } = state

  const [msgIdx,      setMsgIdx]     = useState(0)
  const [displayPct,  setDisplay]    = useState(5)
  const [logs,        setLogs]       = useState([])
  const [status,      setStatus]     = useState('pending')
  const [errMsg,      setErrMsg]     = useState('')
  const [showRaw,     setShowRaw]    = useState(false)
  const [phase,       setPhase]      = useState(0)
  const [elapsed,     setElapsed]    = useState(0)
  const [stallSec,    setStallSec]   = useState(0)
  const [hasActivity, setHasActivity] = useState(false)

  const intervalRef     = useRef(null)
  const timerRef        = useRef(null)
  const startTimeRef    = useRef(null)
  const lastLogCountRef = useRef(0)
  const lastNewLogRef   = useRef(null)
  const logEndRef       = useRef(null)

  // 메시지 순환
  useEffect(() => {
    const t = setInterval(() => setMsgIdx(i => (i + 1) % MESSAGES.length), 3000)
    return () => clearInterval(t)
  }, [])

  // 로그 자동 스크롤
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // 폴링 + 라이브 타이머
  useEffect(() => {
    if (!jobId) return

    startTimeRef.current = Date.now()

    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
      if (lastNewLogRef.current) {
        setStallSec(Math.floor((Date.now() - lastNewLogRef.current) / 1000))
      }
    }, 1000)

    const poll = async () => {
      try {
        const res  = await fetch(`/api/jobs/${jobId}`)
        const data = await res.json()
        if (data.error) return

        setStatus(data.status || 'running')

        if (data.logs?.length) {
          if (data.logs.length > lastLogCountRef.current) {
            lastNewLogRef.current     = Date.now()
            lastLogCountRef.current   = data.logs.length
            setStallSec(0)
            setHasActivity(true)
          }
          setLogs(data.logs)
          setPhase(detectPhase(data.logs))
        }

        const pct = parseProgress(data.logs)
        if (pct > 0) {
          setDisplay(Math.max(pct, 5))
          setProgress(pct)
        } else {
          setDisplay(p => Math.min(p + 1.5, 90))
        }

        if (data.status === 'completed') {
          clearInterval(intervalRef.current)
          clearInterval(timerRef.current)
          setDisplay(100)
          setProgress(100)
          setPhase(5)
          setTimeout(() => { setOutput(jobId); navigate('preview') }, 600)
        } else if (data.status === 'failed') {
          clearInterval(intervalRef.current)
          clearInterval(timerRef.current)
          setErrMsg(data.error || '알 수 없는 오류')
        }
      } catch (_) {
        // 네트워크 오류 무시
      }
    }

    poll()
    intervalRef.current = setInterval(poll, 2500)
    return () => {
      clearInterval(intervalRef.current)
      clearInterval(timerRef.current)
    }
  }, [jobId])

  const retry     = () => navigate('create')
  const isFailed  = status === 'failed'
  const isStalled = status === 'running' && (
    (hasActivity  && stallSec >= 30) ||
    (!hasActivity && elapsed  >= 30)
  )
  const stallMsg  = hasActivity
    ? `${stallSec}초째 응답 없음 — TTS/API 타임아웃 의심`
    : `${elapsed}초째 로그 없음 — 파이프라인 시작 안됨`

  const displayLogs = showRaw ? logs : logs.filter(l => !/^\[progress:\d+%\]$/.test(l))

  // ── 스타일 상수 ─────────────────────────────────────────────
  const S = {
    panelBg:     '#0d1117',
    panelHdr:    '#161b22',
    border:      '#21262d',
  }

  const statusStyle = {
    pending:   { bg: '#21262d', color: '#7d8590' },
    running:   { bg: '#1f3a5f', color: '#58a6ff' },
    completed: { bg: '#1a3a2a', color: '#3fb950' },
    failed:    { bg: '#3a1a1a', color: '#f85149' },
  }[status] ?? { bg: '#21262d', color: '#7d8590' }

  const statusLabel = { pending:'● 대기 중', running:'● 실행 중', completed:'● 완료', failed:'● 실패' }[status]

  return (
    <div className="screen anim-in" style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh', overflow: 'hidden', background: '#fff',
    }}>
      <Header />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── 좌측: 메인 콘텐츠 ───────────────────────────────── */}
        <div style={{
          flex: 1, overflowY: 'auto',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '60px 26px 30px', minWidth: 0,
        }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            {isFailed ? (
              <p style={{ fontSize: 20, fontWeight: 700, color: '#e53e3e', lineHeight: '32px' }}>
                ❌ 영상 생성에 실패했어요
              </p>
            ) : (
              <p style={{ fontSize: 20, fontWeight: 600, color: '#EB5C04', lineHeight: '40px' }}>
                영상을 만들고 있어요 !<br />{MESSAGES[msgIdx]}
              </p>
            )}
          </div>

          {!isFailed && (
            <div style={{ marginBottom: 32 }}>
              <div style={{
                width: 60, height: 60,
                border: '6px solid #e0e0e0', borderTopColor: '#EB5C04',
                borderRadius: '50%', animation: 'spin .9s linear infinite',
              }} />
            </div>
          )}

          <div style={{ width: '100%', maxWidth: 300, marginBottom: 24 }}>
            <div style={{ height: 8, background: '#e8e8e8', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{
                height: '100%', borderRadius: 4, transition: 'width .5s ease-out',
                background: isFailed ? '#e53e3e' : '#EB5C04',
                width: `${displayPct}%`,
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#aaa', fontWeight: 600 }}>{Math.round(displayPct)}%</span>
              <span style={{
                fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                background: isFailed ? '#ffe5e5' : '#fff3ed',
                color: isFailed ? '#e53e3e' : '#EB5C04',
              }}>
                {statusLabel}
              </span>
            </div>
          </div>

          {isFailed && errMsg && (
            <p style={{
              fontSize: 12, color: '#e53e3e', textAlign: 'center',
              background: '#ffe5e5', padding: '8px 16px', borderRadius: 10,
              marginBottom: 16, maxWidth: 300, wordBreak: 'break-all',
            }}>
              {errMsg}
            </p>
          )}

          {(isFailed || displayPct >= 80) && (
            <button onClick={retry} style={{
              background: isFailed ? '#EB5C04' : '#fff',
              border: '2px solid #EB5C04', borderRadius: 25,
              padding: '10px 32px', fontSize: 15, fontWeight: 700,
              color: isFailed ? '#fff' : '#EB5C04', cursor: 'pointer',
            }}>
              🔄 다시 돌리기
            </button>
          )}
        </div>

        {/* ── 우측: 디버그 패널 ───────────────────────────────── */}
        <div style={{
          width: 320, flexShrink: 0,
          background: S.panelBg, borderLeft: `1px solid ${S.border}`,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>

          {/* 헤더 */}
          <div style={{
            padding: '10px 14px', background: S.panelHdr,
            borderBottom: `1px solid ${S.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#7d8590' }}>🛠 디버그 로그</span>
            <button
              onClick={() => setShowRaw(r => !r)}
              style={{
                background: showRaw ? '#1f3a5f' : 'none',
                border: `1px solid ${S.border}`, borderRadius: 6, padding: '2px 8px',
                fontSize: 10, color: showRaw ? '#58a6ff' : '#7d8590', cursor: 'pointer',
              }}
            >
              원시 로그
            </button>
          </div>

          {/* 타이머 + 잡 상태 */}
          <div style={{
            padding: '7px 14px', background: S.panelHdr,
            borderBottom: `1px solid ${S.border}`,
            display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
          }}>
            <span style={{ fontSize: 9, color: '#484f58', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              경과
            </span>
            <code style={{
              fontFamily: 'monospace', fontSize: 14, fontWeight: 700, minWidth: 42,
              color: isStalled ? '#f85149' : '#58a6ff',
            }}>
              {fmtTime(elapsed)}
            </code>
            <div style={{
              marginLeft: 'auto', fontSize: 10, fontWeight: 600,
              padding: '2px 9px', borderRadius: 10,
              background: statusStyle.bg, color: statusStyle.color,
            }}>
              {statusLabel}
            </div>
          </div>

          {/* 마지막 활동 + 스톨 경고 */}
          <div style={{
            padding: '5px 14px', background: S.panelHdr,
            borderBottom: `1px solid ${S.border}`,
            display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0,
          }}>
            <span style={{ fontSize: 10, color: '#484f58', fontFamily: 'monospace' }}>
              {!hasActivity
                ? (status === 'running' ? '로그 대기 중...' : '—')
                : stallSec < 3 ? '방금 전 활동'
                : `마지막 활동: ${stallSec}초 전`}
            </span>
            {isStalled && (
              <div style={{
                fontSize: 10, fontWeight: 600, color: '#d29922',
                background: 'rgba(210,153,34,0.08)', border: '1px solid rgba(210,153,34,0.28)',
                borderRadius: 4, padding: '3px 8px',
              }}>
                ⚠️ {stallMsg}
              </div>
            )}
          </div>

          {/* 페이즈 트래커 */}
          <div style={{
            display: 'flex', padding: '8px 10px', gap: 4,
            background: S.panelHdr, borderBottom: `1px solid ${S.border}`, flexShrink: 0,
          }}>
            {PHASES.map((ph, idx) => {
              const n        = idx + 1
              const isDone   = phase > n
              const isActive = phase === n
              const col      = isActive ? '#58a6ff' : isDone ? '#3fb950' : '#484f58'
              return (
                <div key={n} style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  padding: '5px 2px', borderRadius: 6,
                  border: `1px solid ${isActive ? 'rgba(88,166,255,0.3)' : isDone ? 'rgba(63,185,80,0.2)' : 'transparent'}`,
                  background: isActive ? 'rgba(88,166,255,0.07)' : 'transparent',
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: col }}>{ph.num}</span>
                  <span style={{ fontSize: 8, textAlign: 'center', lineHeight: 1.2, whiteSpace: 'pre-line', color: col }}>
                    {ph.label}
                  </span>
                </div>
              )
            })}
          </div>

          {/* 로그 카운트 */}
          <div style={{
            padding: '4px 14px', background: S.panelHdr,
            borderBottom: `1px solid ${S.border}`,
            display: 'flex', justifyContent: 'space-between', flexShrink: 0,
          }}>
            <span style={{ fontSize: 10, color: '#484f58', fontFamily: 'monospace' }}>
              {displayLogs.length}줄
            </span>
            <span style={{ fontSize: 10, color: '#3d444d' }}>
              {showRaw ? '전체' : '[progress] 제외'}
            </span>
          </div>

          {/* 로그 영역 */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '10px 14px',
            fontFamily: "'Consolas', 'D2Coding', monospace",
            fontSize: 11, lineHeight: 1.7,
          }}>
            {displayLogs.length === 0 ? (
              <p style={{ color: '#484f58', fontSize: 12, textAlign: 'center', marginTop: 24 }}>
                로그 대기 중...
              </p>
            ) : (
              displayLogs.map((line, i) => (
                <div key={i} style={{ color: logColor(line), wordBreak: 'break-all', marginBottom: 1 }}>
                  {line}
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>

        </div>
      </div>
    </div>
  )
}
