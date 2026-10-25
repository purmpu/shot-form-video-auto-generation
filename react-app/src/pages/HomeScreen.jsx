import { useApp } from '../context/AppContext'
import lemongLogo from '../assets/lemong.png'

function Logo() {
  return (
    <img src={lemongLogo} alt="쇼츠몽 로고" style={{ height: 37, width: 'auto' }} />
  )
}

export default function HomeScreen() {
  const { navigate, state } = useApp()
  const storeName = state.storeInfo.storeName || '사장님'

  return (
    <div className="screen anim-in" style={{ position: 'relative', overflow: 'hidden' }}>

      {/* 헤더 */}
      <div style={{ position: 'absolute', left: 26, top: 23, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Logo />
        <span style={{ fontSize: 20, fontWeight: 600, color: '#EB5C04' }}>
          쇼츠몽
        </span>
      </div>

      {/* 인사 블록 */}
      <div style={{
        position: 'absolute', left: 26, top: 130,
        width: 350, height: 198,
        background: 'rgba(223,223,223,0.40)',
        borderRadius: 25, overflow: 'hidden',
        display: 'flex', alignItems: 'center', paddingLeft: 44,
      }}>
        <span style={{ fontSize: 32, fontWeight: 600, lineHeight: '64px', color: '#000' }}>
          {state.storeInfo.storeName ? `${state.storeInfo.storeName} 사장님,` : '토끼 다이닝 사장님,'}<br />
          반갑습니다!
        </span>
      </div>

      {/* 숏폼 제작하기 */}
      <button
        onClick={() => navigate('info')}
        style={{
          position: 'absolute', left: 26, top: 370,
          width: 158, height: 132,
          background: 'rgba(223,223,223,0.40)',
          borderRadius: 25, border: 'none',
          cursor: 'pointer', overflow: 'hidden',
          textAlign: 'left', padding: '0 0 0 0',
          transition: 'transform .12s',
        }}
        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.96)'}
        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
        onTouchStart={e => e.currentTarget.style.transform = 'scale(0.96)'}
        onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        <div style={{
          position: 'absolute', left: 0, top: 0, width: 158, height: 55,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 600, color: '#000',
        }}>
          숏폼 제작하기 &nbsp;<strong>→</strong>
        </div>
        <div style={{
          position: 'absolute', left: 16, top: 60,
          fontSize: 40,
        }}>▶</div>
        <div style={{
          position: 'absolute', left: 79, top: 50,
          fontSize: 30, opacity: .6,
        }}>📹</div>
      </button>

      {/* 빈칸 */}
      <div style={{
        position: 'absolute', left: 218, top: 370,
        width: 158, height: 132,
        background: 'rgba(223,223,223,0.40)',
        borderRadius: 25,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, fontWeight: 600, color: '#000',
      }}>
        빈칸
      </div>

      {/* 하단 네비게이션 */}
      <div style={{
        position: 'absolute', left: 0, top: 799,
        width: 402, height: 75,
        borderTop: '0.5px solid #666',
        borderRadius: '25px 25px 0 0',
        background: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      }}>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: .5, fontSize: 24 }}>☰</button>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: .5, fontSize: 24 }}>⌂</button>
      </div>

    </div>
  )
}
