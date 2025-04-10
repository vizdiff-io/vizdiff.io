import { createContext, useState, useContext, useMemo } from "react"
import type { ReactNode, SetStateAction, Dispatch } from "react"

// Export the interface
export interface BreadcrumbData {
  projectId?: number
  projectName?: string // Fetched in the project page
  buildId?: number
  buildNumber?: number // Fetched in the build page
}

interface BreadcrumbContextType {
  breadcrumbData: BreadcrumbData
  setBreadcrumbData: Dispatch<SetStateAction<BreadcrumbData>>
}

const BreadcrumbContext = createContext<BreadcrumbContextType | undefined>(undefined)

interface BreadcrumbProviderProps {
  children: ReactNode
}

export const BreadcrumbProvider: React.FC<BreadcrumbProviderProps> = ({ children }) => {
  const [breadcrumbData, setBreadcrumbData] = useState<BreadcrumbData>({})

  // Consider more sophisticated logic if needed, e.g., clearing build
  // info automatically when projectId changes.

  const value = useMemo(() => ({ breadcrumbData, setBreadcrumbData }), [breadcrumbData])

  return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>
}

export const useBreadcrumbs = (): BreadcrumbContextType => {
  const context = useContext(BreadcrumbContext)
  if (context == undefined) {
    throw new Error("useBreadcrumbs must be used within a BreadcrumbProvider")
  }
  return context
}
