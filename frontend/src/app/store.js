import { configureStore } from "@reduxjs/toolkit"
import { clone } from "ramda"
import subscribeActionMiddleware from "redux-subscribe-action"

import users, { usersInitialState } from "slices/users"
import { loadState, saveState } from "../util/localStorage"
import projects from "slices/projects"
import jobs from "slices/jobs"
import misc from "slices/misc"
import github from "slices/github"

let extraMiddleware = [subscribeActionMiddleware]

const persistedState = loadState()
const store = configureStore({
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(extraMiddleware),
  reducer: {
    projects,
    jobs,
    users,
    github,
    misc,
  },
  preloadedState: persistedState,
})

store.subscribe(() => {
  const state = store.getState()
  const _users = clone(state.users)

  saveState({
    users: {
      ...usersInitialState,
      currentUser: _users.currentUser,
    },
  })
})

export { store }
