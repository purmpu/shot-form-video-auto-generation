import { AppProvider, useApp } from './context/AppContext'
import HomeScreen          from './pages/HomeScreen'
import InfoInputScreen     from './pages/InfoInputScreen'
import ShootingGuideScreen from './pages/ShootingGuideScreen'
import CreateScreen        from './pages/CreateScreen'
import LoadingScreen       from './pages/LoadingScreen'
import PreviewScreen       from './pages/PreviewScreen'

const SCREENS = {
  home:    HomeScreen,
  info:    InfoInputScreen,
  guide:   ShootingGuideScreen,
  create:  CreateScreen,
  loading: LoadingScreen,
  preview: PreviewScreen,
}

function Router() {
  const { currentScreen, state } = useApp()
  const Screen = SCREENS[currentScreen] ?? HomeScreen
  return <Screen key={`${currentScreen}-${state.history.length}`} />
}

export default function App() {
  return <AppProvider><Router /></AppProvider>
}
