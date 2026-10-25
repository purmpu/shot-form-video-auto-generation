import { useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import Header from '../components/Header'

export default function ShootingGuideScreen() {
  const { state, setSlotFile, setSession, navigate } = useApp()
  const { slots, slotFiles, storeInfo } = state
  const isCafe = storeInfo.bizType === 'cafe'

  const [uploading,  setUploading]  = useState(false)
  const [error,      setError]      = useState('')
  const [shortPopup, setShortPopup] = useState(false)

  const allFilled = slots.length > 0 && slots.every(s => slotFiles[s.id])

  const handleNext = async () => {
    if (!allFilled || uploading) return
    setUploading(true)
    setError('')

    const totalBytes = slots.reduce((sum, s) => sum + (slotFiles[s.id]?.size || 0), 0)
    const timeoutMs  = Math.max(120_000, Math.ceil(totalBytes / (1024 ** 3)) * 120_000)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const formData = new FormData()
      slots.forEach(slot => {
        const file = slotFiles[slot.id]
        if (file) formData.append('files', file)
      })
      const res = await fetch('/api/upload', {
        method: 'POST', body: formData, signal: controller.signal,
      })
      if (!res.ok) {
        const msg = await res.text().catch(() => '')
        throw new Error(`업로드 실패 (${res.status})${msg ? ': ' + msg : ''}`)
      }
      const data = await res.json()
      setSession(data.session_id)
      navigate('create')
    } catch (e) {
      if (e.name === 'AbortError') {
        setError('업로드 시간이 초과됐어요. 백엔드 서버가 실행 중인지 확인 후 다시 시도해주세요.')
      } else if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
        setError('백엔드 서버에 연결할 수 없어요. 서버1(백엔드)을 먼저 실행해주세요.')
      } else {
        setError(`업로드 오류: ${e.message}`)
      }
    } finally {
      clearTimeout(timer)
      setUploading(false)
    }
  }

  // 카페: 인테리어 슬롯 / 메뉴 슬롯 분리 표시
  const interiorSlots = isCafe ? slots.filter(s => s.type === 'cafe_interior') : []
  const menuSlots     = isCafe ? slots.filter(s => s.type === 'cafe_menu')     : []

  const minDuration = isCafe ? 1 : 2  // 카페 1초, 식당 2초

  return (
    <div className="screen anim-in" style={{ overflowY: 'auto', paddingBottom: 120 }}>
      <Header />

      {/* 짧은 영상 팝업 */}
      {shortPopup && (
        <div
          onClick={() => setShortPopup(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 320, background: '#fff', borderRadius: 24,
              padding: '32px 28px 24px', textAlign: 'center',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            }}
          >
            <div style={{ fontSize: 44, marginBottom: 16 }}>⏱️</div>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#111', lineHeight: 1.6, marginBottom: 24 }}>
              {minDuration}초 이상 길이의 영상을 등록 해주세요!<br />
              너무 짧으면 영상을 만들기 힘들어요!
            </p>
            <div
              onClick={() => setShortPopup(false)}
              style={{
                width: '100%', height: 50, background: '#EB5C04', borderRadius: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 700, color: '#fff', cursor: 'pointer',
              }}
            >
              확인
            </div>
          </div>
        </div>
      )}

      {/* 제목 */}
      <div style={{
        position: 'absolute', left: 26, top: 89, width: 350, height: 63,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, fontWeight: 600, color: '#000', textAlign: 'center',
      }}>
        카메라를 꼭 깨끗하게 닦아주세요 !
      </div>

      <div style={{ marginTop: 164, padding: '0 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* 카페: 섹션 구분 */}
        {isCafe ? (
          <>
            <SectionHeader icon="🪑" label="인테리어 영상 (6개)" />
            {interiorSlots.map((slot, i) => (
              <SlotCard key={slot.id} index={i + 1} slot={slot}
                file={slotFiles[slot.id] || null}
                onFile={f => setSlotFile(slot.id, f)}
                onShortVideo={() => setShortPopup(true)}
                minDuration={minDuration} />
            ))}
            <SectionHeader icon="☕" label="메뉴 영상 (4개)" />
            {menuSlots.map((slot, i) => (
              <SlotCard key={slot.id} index={i + 1} slot={slot}
                file={slotFiles[slot.id] || null}
                onFile={f => setSlotFile(slot.id, f)}
                onShortVideo={() => setShortPopup(true)}
                minDuration={minDuration} />
            ))}
          </>
        ) : (
          slots.map((slot, i) => (
            <SlotCard key={slot.id} index={i + 1} slot={slot}
              file={slotFiles[slot.id] || null}
              onFile={f => setSlotFile(slot.id, f)}
              onShortVideo={() => setShortPopup(true)}
              minDuration={minDuration} />
          ))
        )}

        {error && (
          <p style={{ color: '#e53e3e', fontSize: 13, textAlign: 'center' }}>{error}</p>
        )}
      </div>

      {/* 하단 버튼 */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: 402, padding: '12px 26px 24px', background: '#fff', borderTop: '1px solid #eee',
        zIndex: 20,
      }}>
        <div onClick={handleNext} style={{
          width: '100%', height: 61,
          background: allFilled && !uploading ? '#EB5C04' : '#969696',
          borderRadius: 25, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, fontWeight: 600, color: '#fff',
          cursor: allFilled && !uploading ? 'pointer' : 'default',
          transition: 'background .2s',
        }}>
          {uploading ? '업로드 중...' : allFilled ? '편집 설정하기 !' : '영상을 전부 등록 해주세요 !'}
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ icon, label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '4px 4px 0',
    }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{ fontSize: 16, fontWeight: 700, color: '#333' }}>{label}</span>
    </div>
  )
}

// 슬롯 label → 가이드 영상 URL 매핑
function guideVideoUrl(label) {
  if (label === '대표 메뉴')       return '/가이드/대표메뉴.mp4'
  if (label === '매장 외부')       return '/가이드/매장 외부.mp4'
  if (label === '매장 내부')       return '/가이드/매장 내부.mp4'
  if (label === '매장 외부 전경')  return '/가이드/매장외부.mp4'
  if (label.includes('클로즈업'))  return '/가이드/메뉴1.mp4'
  if (label.includes('들어올리기')) return '/가이드/메뉴1클로즈업.mp4'
  return null
}

function SlotCard({ index, slot, file, onFile, onShortVideo, minDuration }) {
  const ref = useRef()
  const [preview,   setPreview]   = useState(null)
  const [videoFail, setVideoFail] = useState(false)

  const guideUrl = guideVideoUrl(slot.label)

  const handleFile = (e) => {
    const f = e.target.files[0]
    if (!f) return

    const tmpUrl = URL.createObjectURL(f)
    const tmpVid = document.createElement('video')
    tmpVid.preload = 'metadata'
    tmpVid.onloadedmetadata = () => {
      URL.revokeObjectURL(tmpUrl)
      if (tmpVid.duration <= minDuration) {
        e.target.value = ''
        onShortVideo()
        return
      }
      onFile(f)
      if (preview) URL.revokeObjectURL(preview)
      setVideoFail(false)
      setPreview(URL.createObjectURL(f))
    }
    tmpVid.onerror = () => {
      URL.revokeObjectURL(tmpUrl)
      onFile(f)
      if (preview) URL.revokeObjectURL(preview)
      setVideoFail(false)
      setPreview(URL.createObjectURL(f))
    }
    tmpVid.src = tmpUrl
  }

  const fmtSize = (bytes) => {
    if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 ** 3)).toFixed(1) + ' GB'
    if (bytes >= 1024 * 1024)        return (bytes / (1024 ** 2)).toFixed(1) + ' MB'
    return (bytes / 1024).toFixed(0) + ' KB'
  }

  return (
    <div style={{
      width: '100%', background: 'rgba(223,223,223,0.40)',
      borderRadius: 25, overflow: 'hidden', paddingBottom: 16,
    }}>
      <div style={{ background: '#fff', borderRadius: 25, margin: '12px 20px 0', padding: '8px 14px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>#{index}</span>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{slot.label} 영상을 등록 해주세요</span>
          {file && <span style={{ marginLeft: 'auto' }}>✅</span>}
        </div>
        <input ref={ref} type="file" accept="video/*,.mov,.mp4,.m4v,.avi,.mkv,.webm"
          style={{ display: 'none' }} onChange={handleFile} />

        {/* 등록 전: + 버튼 / 등록 후: 파일명 표시 */}
        <button onClick={() => !file && ref.current.click()} style={{
          width: '100%', height: 31,
          background: file ? '#fff3ed' : '#F2F2F2',
          border: file ? '1.5px solid #EB5C04' : 'none',
          borderRadius: 25, fontSize: 14, fontWeight: 600,
          cursor: file ? 'default' : 'pointer',
          color: file ? '#EB5C04' : '#000',
        }}>
          {file ? (file.name.length > 24 ? file.name.slice(0, 24) + '…' : file.name) : '+'}
        </button>

        {preview && !videoFail && (
          <video src={preview} controls playsInline muted
            style={{ width: '100%', borderRadius: 10, marginTop: 8, maxHeight: 160, objectFit: 'cover' }}
            onError={() => setVideoFail(true)} />
        )}
        {preview && videoFail && (
          <div style={{
            marginTop: 8, padding: '10px 14px', borderRadius: 10,
            background: '#fff8f0', border: '1.5px solid #EB5C04',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 28 }}>🎬</span>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#EB5C04', marginBottom: 2 }}>등록 완료 (미리보기 불가)</p>
              <p style={{ fontSize: 11, color: '#555', wordBreak: 'break-all' }}>{file.name}</p>
              <p style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>{fmtSize(file.size)} · 브라우저가 이 코덱을 지원하지 않아요</p>
              <p style={{ fontSize: 10, color: '#aaa' }}>업로드·영상 생성은 정상 진행돼요 ✅</p>
            </div>
          </div>
        )}

        {/* 다시 등록 버튼 — 파일 등록 후에만 표시 */}
        {file && (
          <button onClick={() => ref.current.click()} style={{
            width: '100%', height: 31, marginTop: 8,
            background: '#F2F2F2', border: 'none',
            borderRadius: 25, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', color: '#555',
          }}>
            다시 등록
          </button>
        )}
      </div>

      {/* 가이드 영상 — 파일 미등록 시 예시 영상 표시 */}
      {!preview && (
        <div style={{
          margin: '10px 20px 0', background: '#fff', borderRadius: 25,
          overflow: 'hidden',
        }}>
          {guideUrl ? (
            <div>
              <video src={guideUrl} playsInline muted loop autoPlay
                style={{ width: '100%', display: 'block' }} />
              <div style={{
                padding: '8px 14px 10px',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ fontSize: 11, color: '#EB5C04', fontWeight: 700 }}>예시</span>
                <span style={{ fontSize: 11, color: 'rgba(0,0,0,.4)', lineHeight: 1.5 }}>
                  {slot.hint}
                </span>
              </div>
            </div>
          ) : (
            <div style={{
              minHeight: 100, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 6, padding: 16,
            }}>
              <span style={{ fontSize: 28 }}>🎬</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>이렇게 찍으면 돼요!</span>
              <span style={{ fontSize: 11, color: 'rgba(0,0,0,.4)', textAlign: 'center', lineHeight: 1.5 }}>
                {slot.hint}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
