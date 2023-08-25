import { useState, useEffect } from "react"
import Head from "next/head"
import NewProjectDialog from "../components/NewProjectDialog"
import useApiGet from "../hooks/useApiGet"

type Project = {
  id: string
  name: string
}

export default function Projects() {
  const [showModal, setShowModal] = useState(false)
  const [projects, loading, error] = useApiGet<Project[]>("/api/projects")

  return (
    <>
      <Head>
        <title>VizDiff - Projects</title>
        <meta name="description" content="VizDiff project list" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
        <h1>VizDiff - Projects</h1>

        {/* Add New Project Button */}
        <button onClick={() => setShowModal(true)}>Add New Project</button>

        {/* Error Message */}
        {error && <p style={{ color: "red" }}>{error.message}</p>}

        {/* Project List */}
        {loading ? (
          <p>Loading projects...</p>
        ) : (
          <ul>
            {projects?.map((project) => (
              <li key={project.id}>{project.name}</li>
            ))}
          </ul>
        )}

        {/* New Project Modal */}
        {showModal && <NewProjectDialog onClose={() => setShowModal(false)} />}
      </main>
    </>
  )
}
