import { useState } from 'react'
import { useApp, generateSlots, generateCafeSlots } from '../context/AppContext'
import Header from '../components/Header'

const BIZ = [
  { value: 'restaurant', label: '🍜 식당' },
  { value: 'cafe',       label: '☕ 카페' },
]

export default function InfoInputScreen() {
  const { state, updateStoreInfo, setSlots, navigate } = useApp()
  const info = state.storeInfo
  const isCafe = info.bizType === 'cafe'
  const [bizOpen, setBizOpen] = useState(false)

  const valid = isCafe
    ? (info.bizType && info.storeName.trim() && info.location.trim())
    : (info.bizType && info.storeName.trim() && info.location.trim() &&
       info.menus.some(m => m.trim()) &&
       info.hasPackaging !== null && info.hasCooking !== null && info.hasInterior !== null &&
       (info.hasInterior === false || info.tableCount.trim()))

  const addMenu = () => { if (info.menus.length < 3) updateStoreInfo({ menus: [...info.menus, ''] }) }
  const setMenu = (i, v) => { const m = [...info.menus]; m[i] = v; updateStoreInfo({ menus: m }) }
  const delMenu = (i) => { if (info.menus.length > 1) updateStoreInfo({ menus: info.menus.filter((_, x) => x !== i) }) }

  const next = () => {
    if (!valid) return
    setSlots(isCafe ? generateCafeSlots() : generateSlots(info))
    navigate('guide')
  }

  return (
    <div className="screen anim-in" style={{ overflowY: 'auto' }}>
      <Header />

      <div style={{
        position: 'absolute', left: 26, top: 89,
        width: 350, height: 63,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, fontWeight: 600, color: '#000', textAlign: 'center',
      }}>
        업체 정보를 입력 해주세요 !
      </div>

      <div style={{
        position: 'absolute', left: 30, top: 148,
        width: 350,
        background: 'rgba(223,223,223,0.40)',
        borderRadius: 25, overflow: 'visible',
        paddingBottom: 24,
      }}>

        {/* 업종 선택 */}
        <div style={{ position: 'relative', margin: '24px 22px 0' }}>
          <button
            onClick={() => setBizOpen(o => !o)}
            style={{
              width: '100%', height: 47, background: '#fff',
              border: 'none', borderRadius: bizOpen ? '25px 25px 0 0' : 25,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 20px', cursor: 'pointer',
              fontSize: 16, fontWeight: 600,
              color: info.bizType ? '#000' : 'rgba(0,0,0,0.4)',
            }}
          >
            <span>{info.bizType ? BIZ.find(b => b.value === info.bizType)?.label : '업종을 선택 해주세요 !'}</span>
            <svg width="19" height="12" viewBox="0 0 19 12" fill="none"
              style={{ transform: bizOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
              <path d="M0.727 0.687L9.227 9.687L17.727 0.687" stroke="#000" strokeWidth="2"/>
            </svg>
          </button>
          {bizOpen && (
            <div style={{ background: '#fff', borderRadius: '0 0 25px 25px', overflow: 'hidden' }}>
              {BIZ.map(b => (
                <button key={b.value} onClick={() => { updateStoreInfo({ bizType: b.value }); setBizOpen(false) }}
                  style={{
                    width: '100%', height: 47, background: info.bizType === b.value ? '#fff3ed' : '#fff',
                    border: 'none', borderTop: '1px solid #eee', padding: '0 20px',
                    textAlign: 'left', cursor: 'pointer',
                    fontSize: 16, fontWeight: 600,
                    color: info.bizType === b.value ? '#EB5C04' : '#000',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}
                >
                  {b.label}
                  {info.bizType === b.value && <span style={{ color: '#EB5C04' }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 매장 이름 */}
        <div style={{ margin: '12px 22px 0', position: 'relative' }}>
          <div style={{
            width: '100%', height: 47, background: '#fff',
            borderRadius: 25, display: 'flex', alignItems: 'center',
            padding: '0 44px 0 20px',
          }}>
            <input className="inp"
              style={{ flex: 1, height: '100%', background: 'transparent', fontSize: 16, padding: 0 }}
              placeholder="매장 이름을 입력 해주세요 !"
              value={info.storeName}
              onChange={e => updateStoreInfo({ storeName: e.target.value })}
            />
          </div>
          <svg style={{ position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)' }}
            width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2L11.5 7H16.5L12.5 10.5L14 15.5L9 12.5L4 15.5L5.5 10.5L1.5 7H6.5L9 2Z" stroke="#000" strokeWidth="1.8" strokeLinejoin="round"/>
          </svg>
        </div>

        {/* 매장 위치 */}
        <div style={{ margin: '12px 22px 0', position: 'relative' }}>
          <div style={{
            width: '100%', height: 47, background: '#fff',
            borderRadius: 25, display: 'flex', alignItems: 'center',
            padding: '0 44px 0 20px',
          }}>
            <input className="inp"
              style={{ flex: 1, height: '100%', background: 'transparent', fontSize: 16, padding: 0 }}
              placeholder="매장 위치를 입력 해주세요 !"
              value={info.location}
              onChange={e => updateStoreInfo({ location: e.target.value })}
            />
          </div>
          <svg style={{ position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)' }}
            width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="8" cy="8" r="5" stroke="#000" strokeWidth="2"/>
            <line x1="12" y1="12" x2="17" y2="17" stroke="#000" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>

        {/* ── 식당 전용 필드 ── */}
        {!isCafe && (
          <>
            {/* 대표 메뉴 */}
            <div style={{ margin: '12px 22px 0', background: '#fff', borderRadius: 25, padding: '8px 15px 12px' }}>
              <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 600, paddingTop: 4 }}>
                대표 메뉴를 적어주세요 !
              </div>
              <div style={{ textAlign: 'center', fontSize: 10, color: '#000', marginBottom: 10 }}>
                최대 3개까지 적을 수 있어요
              </div>
              {info.menus.map((menu, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                  <input className="inp"
                    style={{ flex: 1, height: 31, fontSize: 13, padding: '0 12px', borderRadius: 25 }}
                    placeholder="메뉴명을 입력 해주세요"
                    value={menu}
                    onChange={e => setMenu(i, e.target.value)}
                  />
                  {info.menus.length > 1 && (
                    <button onClick={() => delMenu(i)} style={{
                      width: 28, height: 28, background: '#ddd', border: 'none',
                      borderRadius: '50%', cursor: 'pointer', fontSize: 14, color: '#666',
                    }}>×</button>
                  )}
                </div>
              ))}
              {info.menus.length < 3 && (
                <button onClick={addMenu} style={{
                  width: '100%', height: 31, background: '#F2F2F2', border: 'none',
                  borderRadius: 25, fontSize: 16, fontWeight: 600, cursor: 'pointer',
                }}>+</button>
              )}
            </div>

            <YNRow label="포장이 가능한 매장인가요?" value={info.hasPackaging}
              onChange={v => updateStoreInfo({ hasPackaging: v })} />
            <YNRow label="조리 과정도 촬영 할까요?" value={info.hasCooking}
              onChange={v => updateStoreInfo({ hasCooking: v })} />

            <div style={{ margin: '12px 22px 0', background: '#fff', borderRadius: 25, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', gap: 8 }}>
                <span style={{ flex: 1, fontSize: 16, fontWeight: 600 }}>매장 내부도 홍보할까요?</span>
                <div style={{ display: 'flex', width: 79 }}>
                  <button className={`yn-yes${info.hasInterior === true ? ' active' : ''}`}
                    onClick={() => updateStoreInfo({ hasInterior: true })}>예</button>
                  <button className={`yn-no${info.hasInterior === false ? ' active' : ''}`}
                    onClick={() => updateStoreInfo({ hasInterior: false, tableCount: '' })}>아니오</button>
                </div>
              </div>
              {info.hasInterior === true && (
                <div style={{ padding: '0 15px 12px' }}>
                  <input className="inp"
                    type="number"
                    style={{ width: '100%', height: 31, fontSize: 13, padding: '0 12px', borderRadius: 25 }}
                    placeholder="테이블 수를 입력 해주세요"
                    value={info.tableCount}
                    onChange={e => updateStoreInfo({ tableCount: e.target.value })}
                  />
                </div>
              )}
            </div>
          </>
        )}

      </div>

      {/* 하단 버튼 */}
      <div style={{
        position: 'absolute', left: 26, top: 751,
        width: 350, height: 61,
        background: valid ? '#EB5C04' : '#969696',
        borderRadius: 25, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, fontWeight: 600, color: '#fff',
        cursor: valid ? 'pointer' : 'not-allowed',
        transition: 'background .2s',
      }}
        onClick={next}
      >
        영상 촬영 가이드 보러 가기 !
      </div>

    </div>
  )
}

function YNRow({ label, value, onChange }) {
  return (
    <div style={{
      margin: '12px 22px 0', background: '#fff', borderRadius: 25,
      display: 'flex', alignItems: 'center', padding: '10px 14px', gap: 8,
    }}>
      <span style={{ flex: 1, fontSize: 16, fontWeight: 600 }}>{label}</span>
      <div style={{ display: 'flex', width: 79 }}>
        <button className={`yn-yes${value === true ? ' active' : ''}`} onClick={() => onChange(true)}>예</button>
        <button className={`yn-no${value === false ? ' active' : ''}`} onClick={() => onChange(false)}>아니오</button>
      </div>
    </div>
  )
}
