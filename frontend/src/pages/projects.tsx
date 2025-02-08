import { useState } from "react"
import { NavBody } from "@/components/NavBody"
import NewProjectDialog from "@/components/NewProjectDialog"
import useApiGet from "@/hooks/useApiGet"
import type { Project } from "@/lib/apiTypes"
import Head from "next/head"

export default function Projects() {
  const [showModal, setShowModal] = useState(false)
  const [projects, loading, error] = useApiGet<Project[]>("/api/projects", [showModal])

  return (
    <>
      <Head>
        <title>Projects</title>
        <meta name="description" content="Project listing" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main>
        <NavBody>
          <h1>Projects</h1>

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
                <li key={project.id}>
                  <a href={`/project?id=${project.id}`}>{project.name}</a>
                </li>
              ))}
            </ul>
          )}

          {/* New Project Modal */}
          {showModal && <NewProjectDialog onClose={() => setShowModal(false)} />}
        </NavBody>
      </main>
    </>
  )
}
