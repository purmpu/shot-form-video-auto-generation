import { useApp } from '../context/AppContext'
import lemongLogo from '../assets/lemong.png'

const STEP_MAP = { info: 1, guide: 2, create: 3, loading: 3, preview: 3 }

function Logo() {
  return (
    <img src={lemongLogo} alt="쇼츠몽 로고" style={{ height: 37, width: 'auto' }} />
  )
}

export default function Header() {
  const { currentScreen, goBack } = useApp()
  const isHome = currentScreen === 'home'
  const stepNum = STEP_MAP[currentScreen] ?? null

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, width: '100%',
      display: 'flex', alignItems: 'center',
      padding: '20px 26px 0',
      zIndex: 10,
    }}>
      {/* 뒤로가기 or 로고 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {!isHome && (
          <button onClick={goBack} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '0 8px 0 0',
            display: 'flex', alignItems: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M13 3L6 10L13 17" stroke="#1a1a1a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        <Logo />
      </div>

      {/* 홈: 앱 이름 */}
      {isHome && (
        <span style={{ marginLeft: 8, fontSize: 20, fontWeight: 600, color: '#EB5C04' }}>
          쇼츠몽
        </span>
      )}

      {/* 단계 표시 */}
      {!isHome && stepNum && (
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {[1, 2, 3].map(n => (
            <div key={n} style={{
              width: 82, height: 33,
              background: n === stepNum ? '#EB5C04' : '#F2F2F2',
              borderRadius: 25,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 600,
              color: n === stepNum ? '#fff' : '#969696',
              transition: 'all .2s',
            }}>
              {n}단계
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
