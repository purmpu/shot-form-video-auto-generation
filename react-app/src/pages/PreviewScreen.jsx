import { useApp } from '../context/AppContext'
import Header from '../components/Header'

export default function PreviewScreen() {
  const { state, goBack, fullReset, navigate } = useApp()
  const { outputJobId } = state

  const videoUrl     = outputJobId ? `/api/jobs/${outputJobId}/video`     : null
  const thumbnailUrl = outputJobId ? `/api/jobs/${outputJobId}/thumbnail` : null

  const handleSave = () => {
    if (!videoUrl) return
    const a = document.createElement('a')
    a.href  = videoUrl
    a.download = `쇼츠몽_${Date.now()}.mp4`
    a.click()
  }

  const handleSaveThumbnail = () => {
    if (!thumbnailUrl) return
    const a = document.createElement('a')
    a.href  = thumbnailUrl
    a.download = `쇼츠몽_썸네일_${Date.now()}.jpg`
    a.click()
  }

  const handleRestart = () => { fullReset(); navigate('home') }

  return (
    <div className="screen anim-in">
      <Header />

      {/* 제목 */}
      <div style={{
        position: 'absolute', left: 26, top: 89, width: 350, height: 63,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, fontWeight: 600, color: '#000', textAlign: 'center',
      }}>
        영상이 완성됐어요 !
      </div>

      {/* 미리보기 */}
      <div style={{
        position: 'absolute', left: 26, top: 153,
        width: 350, height: 372,
        background: 'rgba(223,223,223,0.40)',
        borderRadius: 25, overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', left: 20, top: 20,
          width: 310, height: 332,
          background: '#fff', borderRadius: 25, overflow: 'hidden',
        }}>
          {videoUrl ? (
            <video
              src={videoUrl}
              controls
              playsInline
              autoPlay
              style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 48 }}>🎬</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#000' }}>미리보기</span>
            </div>
          )}
        </div>
      </div>

      {/* 썸네일 */}
      <div style={{
        position: 'absolute', left: 26, top: 535,
        width: 350, height: 78,
        background: '#fff',
        borderRadius: 20,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        display: 'flex', alignItems: 'stretch',
        overflow: 'hidden',
      }}>
        {/* 이미지 */}
        <div style={{ width: 44, flexShrink: 0, background: '#e8e8e8', overflow: 'hidden' }}>
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt="썸네일"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18,
            }}>🖼️</div>
          )}
        </div>

        {/* 텍스트 */}
        <div style={{ flex: 1, padding: '0 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#222' }}>썸네일</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>대표메뉴 대표 이미지</div>
        </div>

        {/* 저장 버튼 */}
        <div
          onClick={thumbnailUrl ? handleSaveThumbnail : undefined}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 16px',
            background: thumbnailUrl ? '#EB5C04' : '#ccc',
            color: '#fff', fontSize: 13, fontWeight: 700,
            cursor: thumbnailUrl ? 'pointer' : 'default',
            flexShrink: 0,
          }}
        >
          저장
        </div>
      </div>

      {/* 이전 단계로 */}
      <div style={{
        position: 'absolute', left: 26, top: 630,
        width: 350, height: 61,
        background: '#969696', borderRadius: 25,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, fontWeight: 600, color: '#fff', cursor: 'pointer',
      }} onClick={() => navigate('create')}>
        이전 단계로 돌아가기
      </div>

      {/* 저장하고 공유하기 */}
      <div style={{
        position: 'absolute', left: 26, top: 708,
        width: 350, height: 61,
        background: videoUrl ? '#EB5C04' : '#969696',
        borderRadius: 25,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, fontWeight: 600, color: '#fff',
        cursor: videoUrl ? 'pointer' : 'default',
      }} onClick={videoUrl ? handleSave : undefined}>
        저장하고 공유하기 !
      </div>
    </div>
  )
}
