import { useState } from 'react'
import HeroSection from '../components/home/HeroSection'
import ShowcasePanel from '../components/home/ShowcasePanel'
import DiscoveryCards from '../components/home/DiscoveryCards'
import PipelineSteps from '../components/home/PipelineSteps'

export default function HomePage() {
  const [previewFormula, setPreviewFormula] = useState('Si')

  return (
    <div className="flex flex-col w-full">
      <HeroSection onPreview={setPreviewFormula} />
      <ShowcasePanel previewFormula={previewFormula} />
      <DiscoveryCards />
      <PipelineSteps />
    </div>
  )
}
