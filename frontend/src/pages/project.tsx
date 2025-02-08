import Head from "next/head"
import { useRouter } from "next/router"
import useApiGet from "@/hooks/useApiGet"
import type { Project as ProjectData } from "@/lib/apiTypes"

export default function Project() {
  const router = useRouter()
  const { id } = router.query
  const [project, loading, error] = useApiGet<ProjectData>(`/api/projects/${id}`)

  return (
    <>
      <Head>
        <title>Projects</title>
        <meta name="description" content="Project listing" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main>
        <h1>{project?.name ?? "Loading project..."}</h1>

        {/* Error Message */}
        {error && <p style={{ color: "red" }}>{error.message}</p>}

        {/* Project Details */}
        {loading || !project ? (
          <p>Loading project...</p>
        ) : (
          <ul>
            <li>name: {project.name}</li>
            <li>url: {project.githubRepoUrl}</li>
            <li>token: {project.token}</li>
          </ul>
        )}
      </main>
    </>
  )
}
