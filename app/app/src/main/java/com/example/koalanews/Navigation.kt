package com.example.koalanews

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
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

  val isAuthenticated = viewModel.isAuthenticated
  LaunchedEffect(isAuthenticated) {
    if (!isAuthenticated) {
      // If session is cleared, force redirect to Setup screen
      try {
        backStack.clear()
        backStack.add(Setup)
      } catch (e: Exception) {
        e.printStackTrace()
      }
    }
  }

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
                  try {
                      backStack.add(Main)
                      // Prune the Setup key
                      if (backStack.size > 1) {
                          backStack.removeAt(0)
                      }
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
                  try {
                      backStack.add(Setup)
                      // Prune the Main key
                      if (backStack.size > 1) {
                          backStack.removeAt(0)
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
