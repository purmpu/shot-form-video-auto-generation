import { createContext, useContext, useReducer } from 'react'

export function generateCafeSlots() {
  const slots = []
  for (let i = 1; i <= 6; i++) {
    slots.push({
      id: `cafe-interior-${i}`, index: i,
      label: `인테리어 ${i}`,
      hint: '카페 내부 분위기, 좌석, 소품이 잘 보이는 영상',
      type: 'cafe_interior',
    })
  }
  for (let i = 1; i <= 4; i++) {
    slots.push({
      id: `cafe-menu-${i}`, index: 6 + i,
      label: `메뉴 ${i}`,
      hint: '음료 또는 디저트 클로즈업 영상',
      type: 'cafe_menu',
    })
  }
  return slots
}

export function generateSlots(info) {
  const slots = []
  const menus = info.menus.filter(m => m.trim())
  let idx = 1
  const push = (label, hint, type) => {
    slots.push({ id: `slot-${idx}`, index: idx, label, hint, type })
    idx++
  }
  push('대표 메뉴', '매장을 대표하는 메뉴 클로즈업. 첫 장면 훅.', 'hook')
  push('매장 외부', '매장 외관 전체가 한눈에. 간판이 잘 보여야 함.', 'exterior')
  if (info.hasInterior) push('매장 내부', '매장 인테리어, 좌석 전체가 보이는 넓은 샷.', 'interior')
  if (info.hasCooking) {
    push('조리 과정 1', '요리사 조리 장면. 불꽃이나 연기가 보이면 좋음.', 'cooking')
    push('조리 과정 2', '다른 각도 또는 다른 조리 단계.', 'cooking')
  }
  menus.forEach(menu => {
    push(`${menu} — 클로즈업`, `${menu} 음식 클로즈업.`, 'menu_closeup')
    push(`${menu} — 들어올리기`, `젓가락으로 ${menu}를 천천히 들어올리는 씬.`, 'menu_lift')
  })
  if (info.hasPackaging) push('포장/테이크아웃', '포장 용기에 담긴 메뉴.', 'packaging')
  push('매장 외부 전경', '매장 전체가 한눈에 들어오는 넓은 샷.', 'wide_shot')
  return slots
}

// 새로고침해도 유지할 스타일 설정은 localStorage에 저장
function loadStyle() {
  try { return JSON.parse(localStorage.getItem('shortsmong_style') || '{}') } catch { return {} }
}
function saveStyle(s) {
  try { localStorage.setItem('shortsmong_style', JSON.stringify(s)) } catch {}
}

const _saved = loadStyle()

const initial = {
  history: ['home'],
  storeInfo: {
    bizType: '', storeName: '', location: '',
    menus: [''], hasPackaging: null, hasCooking: null, hasInterior: null, tableCount: '',
  },
  slots: [],
  slotFiles: {},
  // 백엔드 연결 상태
  sessionId:   null,
  jobId:       null,
  outputJobId: null,
  // 식당 스타일 설정
  subtitleStyle: _saved.subtitleStyle ?? null,
  subtitleY:     _saved.subtitleY     ?? null,
  voice:         _saved.voice         ?? null,
  bgmIndex:      _saved.bgmIndex      ?? null,
  hasOutro:      _saved.hasOutro      ?? null,
  outroFile:     _saved.outroFile     ?? null,
  // 카페 전용 설정
  cafeCaption:      '',
  cafeCaptionStyle: _saved.cafeCaptionStyle ?? 'box',
  // 공통 목록
  bgmList:   [],
  outroList: [],
  progress: 0,
}

function reducer(state, action) {
  switch (action.type) {
    case 'NAVIGATE':
      return { ...state, history: [...state.history, action.screen] }
    case 'GO_BACK':
      if (state.history.length <= 1) return state
      return { ...state, history: state.history.slice(0, -1) }
    case 'UPDATE_STORE_INFO':
      return { ...state, storeInfo: { ...state.storeInfo, ...action.updates } }
    case 'SET_SLOTS':
      return { ...state, slots: action.slots, slotFiles: {} }
    case 'SET_SLOT_FILE':
      return { ...state, slotFiles: { ...state.slotFiles, [action.slotId]: action.file } }
    case 'SET_SESSION':
      return { ...state, sessionId: action.sessionId }
    case 'SET_JOB':
      return { ...state, jobId: action.jobId, progress: 0 }
    case 'SET_OUTPUT':
      return { ...state, outputJobId: action.jobId }
    case 'SET_STYLE': {
      const next = { ...state, [action.field]: action.value }
      const PERSIST = ['subtitleStyle', 'subtitleY', 'voice', 'bgmIndex', 'hasOutro', 'outroFile', 'cafeCaptionStyle']
      if (PERSIST.includes(action.field)) {
        saveStyle(Object.fromEntries(PERSIST.map(k => [k, next[k]])))
      }
      return next
    }
    case 'SET_CAFE_CAPTION':
      return { ...state, cafeCaption: action.value }
    case 'SET_BGM_LIST':
      return { ...state, bgmList: action.list }
    case 'SET_OUTRO_LIST':
      return { ...state, outroList: action.list }
    case 'SET_PROGRESS':
      return { ...state, progress: action.progress }
    case 'FULL_RESET':
      return { ...initial }
    default:
      return state
  }
}

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initial)
  const currentScreen = state.history[state.history.length - 1]

  return (
    <AppContext.Provider value={{
      state, currentScreen,
      navigate:         (screen)       => dispatch({ type: 'NAVIGATE',        screen }),
      goBack:           ()              => dispatch({ type: 'GO_BACK' }),
      updateStoreInfo:  (updates)      => dispatch({ type: 'UPDATE_STORE_INFO', updates }),
      setSlots:         (slots)        => dispatch({ type: 'SET_SLOTS',        slots }),
      setSlotFile:      (slotId, file) => dispatch({ type: 'SET_SLOT_FILE',    slotId, file }),
      setSession:       (sessionId)    => dispatch({ type: 'SET_SESSION',      sessionId }),
      setJob:           (jobId)        => dispatch({ type: 'SET_JOB',          jobId }),
      setOutput:        (jobId)        => dispatch({ type: 'SET_OUTPUT',       jobId }),
      setStyle:         (field, value) => dispatch({ type: 'SET_STYLE',        field, value }),
      setCafeCaption:   (value)        => dispatch({ type: 'SET_CAFE_CAPTION', value }),
      setBgmList:       (list)         => dispatch({ type: 'SET_BGM_LIST',     list }),
      setOutroList:     (list)         => dispatch({ type: 'SET_OUTRO_LIST',   list }),
      setProgress:      (progress)     => dispatch({ type: 'SET_PROGRESS',     progress }),
      fullReset:        ()             => dispatch({ type: 'FULL_RESET' }),
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
