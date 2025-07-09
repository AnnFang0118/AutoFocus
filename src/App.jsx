import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import AutoFocus from './AutoFocus'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <AutoFocus />
    </>
  )
}

export default App
