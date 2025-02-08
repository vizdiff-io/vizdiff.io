import { Inter } from "next/font/google"
import { Container, Typography, AppBar, Toolbar, Button } from "@mui/material"
import useTryApiGet from "@/hooks/useTryApiGet"

const API_ME_URL = "/api/users/me"

const inter = Inter({ subsets: ["latin"] })

interface NavBodyProps {
  children: React.ReactNode
}

interface User {
  githubUsername: string
}

export const NavBody: React.FC<NavBodyProps> = ({ children }) => {
  const [me, isMeLoading, _] = useTryApiGet<User>(API_ME_URL)

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6">vizdiff.io</Typography>
          <div style={{ flexGrow: 1 }} />
          {isMeLoading ? (
            <Button disabled>Loading...</Button>
          ) : me ? (
            <Button href="/api/auth/logout" color="customColor">
              Logout
            </Button>
          ) : (
            <Button href="/projects">Login</Button>
          )}
        </Toolbar>
      </AppBar>
      <Container>
        <div style={{ height: "2rem" }} />
        {children}
      </Container>
    </>
  )
}
