import { useParams } from 'react-router-dom'

export default function ProjectDetail() {
  const { id } = useParams()
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Project: {id}</h1>
      <p className="text-gray-500 mt-2">Coming soon...</p>
    </div>
  )
}
