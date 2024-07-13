import { configureStore } from "@reduxjs/toolkit"
import { clone } from "ramda"
import subscribeActionMiddleware from "redux-subscribe-action"

import users, { usersInitialState } from "slices/users"
import { loadState, saveState } from "../util/localStorage"
import projects from "slices/projects"
import runs from "slices/runs"
import testResults from "slices/testResults"
import misc from "slices/misc"
import github from "slices/github"

let extraMiddleware = [subscribeActionMiddleware]

const persistedState = loadState()
const store = configureStore({
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(extraMiddleware),
  reducer: {
    projects,
    runs,
    testResults,
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
