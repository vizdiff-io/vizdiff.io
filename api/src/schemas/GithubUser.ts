export type GithubUser = GithubPrivateUser | GithubPublicUser

// GitLab user type
export interface GitlabUser {
  id: number
  username: string
  name: string | null
  email: string | null
  avatar_url: string | null
  web_url: string
  state: string
  bio: string | null
  location: string | null
  public_email: string | null
  skype: string | null
  linkedin: string | null
  twitter: string | null
  organization: string | null
  job_title: string | null
  created_at: string
  last_sign_in_at: string | null
  confirmed_at: string | null
  two_factor_enabled: boolean
  external: boolean
  is_admin: boolean
  [k: string]: unknown
}

// Example:
//
// {
//   "login": "octocat",
//   "id": 1,
//   "node_id": "MDQ6VXNlcjE=",
//   "avatar_url": "https://github.com/images/error/octocat_happy.gif",
//   "gravatar_id": "",
//   "url": "https://api.github.com/users/octocat",
//   "html_url": "https://github.com/octocat",
//   "followers_url": "https://api.github.com/users/octocat/followers",
//   "following_url": "https://api.github.com/users/octocat/following{/other_user}",
//   "gists_url": "https://api.github.com/users/octocat/gists{/gist_id}",
//   "starred_url": "https://api.github.com/users/octocat/starred{/owner}{/repo}",
//   "subscriptions_url": "https://api.github.com/users/octocat/subscriptions",
//   "organizations_url": "https://api.github.com/users/octocat/orgs",
//   "repos_url": "https://api.github.com/users/octocat/repos",
//   "events_url": "https://api.github.com/users/octocat/events{/privacy}",
//   "received_events_url": "https://api.github.com/users/octocat/received_events",
//   "type": "User",
//   "site_admin": false,
//   "name": "monalisa octocat",
//   "company": "GitHub",
//   "blog": "https://github.com/blog",
//   "location": "San Francisco",
//   "email": "octocat@github.com",
//   "hireable": false,
//   "bio": "There once was...",
//   "twitter_username": "monatheoctocat",
//   "public_repos": 2,
//   "public_gists": 1,
//   "followers": 20,
//   "following": 0,
//   "created_at": "2008-01-14T04:33:35Z",
//   "updated_at": "2008-01-14T04:33:35Z",
//   "private_gists": 81,
//   "total_private_repos": 100,
//   "owned_private_repos": 100,
//   "disk_usage": 10000,
//   "collaborators": 8,
//   "two_factor_authentication": true,
//   "plan": {
//     "name": "Medium",
//     "space": 400,
//     "private_repos": 20,
//     "collaborators": 0
//   }
// }

export interface GithubPrivateUser {
  login: string
  id: number
  node_id: string
  avatar_url: string
  gravatar_id: string | null
  url: string
  html_url: string
  followers_url: string
  following_url: string
  gists_url: string
  starred_url: string
  subscriptions_url: string
  organizations_url: string
  repos_url: string
  events_url: string
  received_events_url: string
  type: string
  site_admin: boolean
  name: string | null
  company: string | null
  blog: string | null
  location: string | null
  email: string | null
  hireable: boolean | null
  bio: string | null
  twitter_username?: string | null
  public_repos: number
  public_gists: number
  followers: number
  following: number
  created_at: string
  updated_at: string
  private_gists: number
  total_private_repos: number
  owned_private_repos: number
  disk_usage: number
  collaborators: number
  two_factor_authentication: boolean
  plan?: {
    collaborators: number
    name: string
    space: number
    private_repos: number
    [k: string]: unknown
  }
  suspended_at?: string | null
  business_plus?: boolean
  ldap_dn?: string
  [k: string]: unknown
}

export interface GithubPublicUser {
  login: string
  id: number
  node_id: string
  avatar_url: string
  gravatar_id: string | null
  url: string
  html_url: string
  followers_url: string
  following_url: string
  gists_url: string
  starred_url: string
  subscriptions_url: string
  organizations_url: string
  repos_url: string
  events_url: string
  received_events_url: string
  type: string
  site_admin: boolean
  name: string | null
  company: string | null
  blog: string | null
  location: string | null
  email: string | null
  hireable: boolean | null
  bio: string | null
  twitter_username?: string | null
  public_repos: number
  public_gists: number
  followers: number
  following: number
  created_at: string
  updated_at: string
  plan?: {
    collaborators: number
    name: string
    space: number
    private_repos: number
    [k: string]: unknown
  }
  suspended_at?: string | null
  private_gists?: number
  total_private_repos?: number
  owned_private_repos?: number
  disk_usage?: number
  collaborators?: number
}
