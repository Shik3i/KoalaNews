package com.example.koalanews

import androidx.compose.runtime.Composable
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.ui.NavDisplay
import com.example.koalanews.ui.NewsViewModel
import com.example.koalanews.ui.dashboard.DashboardScreen
import com.example.koalanews.ui.setup.SetupScreen

@Composable
fun MainNavigation(viewModel: NewsViewModel) {
  val startingKey = if (viewModel.isAuthenticated) Main else Setup
  val backStack = rememberNavBackStack(startingKey)

  NavDisplay(
    backStack = backStack,
    onBack = {
      if (backStack.size > 1) {
        backStack.removeLastOrNull()
      }
    },
    entryProvider =
      entryProvider {
        entry<Setup> {
          SetupScreen(
              viewModel = viewModel,
              onLoginSuccess = {
                  backStack.add(Main)
                  // Optional: prune the backstack of Setup to prevent going back to it
                  try {
                      // If it's a standard list/collection we can try to filter it
                      // but typically in Navigation 3, backStack size > 1 handles it.
                  } catch (e: Exception) {
                      e.printStackTrace()
                  }
              }
          )
        }
        entry<Main> {
          DashboardScreen(
              viewModel = viewModel,
              onLogoutSuccess = {
                  backStack.add(Setup)
                  // Clean up the backstack
                  try {
                      while (backStack.size > 1) {
                          backStack.removeLastOrNull()
                      }
                  } catch (e: Exception) {
                      e.printStackTrace()
                  }
              }
          )
        }
      },
  )
}
